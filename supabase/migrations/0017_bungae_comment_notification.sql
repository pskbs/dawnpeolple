-- 0017_bungae_comment_notification.sql
-- 2026-09-24 사용자 요청: 소모임 참석자 댓글(bungae_comments)에도 알림.
-- 대상은 두 경우뿐이에요(참석자 전원에게는 보내지 않아요).
--   1) 내가 연 소모임에 누가 댓글·답글을 남겼을 때 → 리더
--   2) 내가 소모임에 단 댓글에 누가 답글(대댓글)을 남겼을 때 → 부모 댓글 작성자
-- 두 경우 모두 'bungae_comment' 한 종류로 묶어 알림 설정 항목·토스 캠페인이 하나예요.

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'dm', 'bungae_join', 'comment_reply', 'bungae_comment'));

alter table notification_settings add column bungae_comment boolean not null default true;

create or replace function create_notification(
  p_user_id uuid, p_actor_id uuid, p_type text, p_title text, p_body text, p_link text, p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  if p_user_id is null or p_actor_id is null or p_user_id = p_actor_id then
    return;
  end if;
  if is_blocked_between(p_user_id, p_actor_id) then
    return;
  end if;
  select case p_type
           when 'comment' then comment
           when 'dm' then dm
           when 'bungae_join' then bungae_join
           when 'comment_reply' then comment_reply
           when 'bungae_comment' then bungae_comment
         end
    into v_enabled
  from notification_settings where user_id = p_user_id;
  if v_enabled is false then
    return;
  end if;
  insert into notifications (user_id, actor_id, type, title, body, link, meta)
  values (p_user_id, p_actor_id, p_type, p_title, p_body, p_link, p_meta);
end;
$$;

create or replace function notify_on_bungae_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_title text;
  v_parent_author uuid;
  v_nick text;
  v_preview text := notification_preview(new.body);
begin
  select host_id, title into v_host, v_title from bungaes where id = new.bungae_id;
  select nickname into v_nick from profiles where id = new.author_id;

  -- 리더에게: 내 소모임에 댓글·답글이 달렸어요.
  perform create_notification(
    v_host, new.author_id, 'bungae_comment', '새 소모임 댓글',
    coalesce(v_nick, '누군가') || '님이 ''' || v_title || ''' 소모임에 댓글을 남겼어요: ' || v_preview,
    '/bungae/' || new.bungae_id,
    jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'preview', v_preview, 'title', v_title)
  );

  -- 대댓글이면 부모 댓글 작성자에게도(리더가 이미 위에서 받았으면 중복 방지, 지금 참석 중인 사람만).
  if new.parent_id is not null then
    select author_id into v_parent_author from bungae_comments where id = new.parent_id;
    if v_parent_author is not null
       and v_parent_author <> v_host
       and exists (
         select 1 from bungae_participants
         where bungae_id = new.bungae_id and user_id = v_parent_author and status = 'joined'
       ) then
      perform create_notification(
        v_parent_author, new.author_id, 'bungae_comment', '새 소모임 댓글',
        coalesce(v_nick, '누군가') || '님이 ''' || v_title || ''' 소모임에서 내 댓글에 답글을 남겼어요: ' || v_preview,
        '/bungae/' || new.bungae_id,
        jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'preview', v_preview, 'title', v_title)
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger bungae_comments_notify
  after insert on bungae_comments
  for each row execute function notify_on_bungae_comment();

revoke execute on function notify_on_bungae_comment() from public, anon, authenticated;
