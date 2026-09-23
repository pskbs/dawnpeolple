-- 0016_comment_reply_notification.sql
-- 2026-09-23 사용자 요청: 내가 단 댓글에 누가 답글(대댓글)을 남겼을 때도 알림.
-- 범위는 기존 'comment' 알림과 동일하게 수다방 글(comments)만. 소모임 채팅(bungae_comments)은
-- 원래 'comment' 알림도 없어서(참석자끼리 보는 공간) 이번에도 그대로 둬요.

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'dm', 'bungae_join', 'comment_reply'));

alter table notification_settings add column comment_reply boolean not null default true;

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

create or replace function notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
  v_nick text;
  v_preview text := notification_preview(new.body);
begin
  select author_id into v_post_author from posts where id = new.post_id;
  select nickname into v_nick from profiles where id = new.author_id;
  perform create_notification(
    v_post_author, new.author_id, 'comment', '새 댓글',
    coalesce(v_nick, '누군가') || '님이 댓글을 남겼어요: ' || v_preview,
    '/feed/' || new.post_id,
    jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'preview', v_preview)
  );

  -- 대댓글이면 부모 댓글 작성자에게도 알려요(글쓴이가 이미 위에서 받았으면 중복 방지).
  if new.parent_id is not null then
    select author_id into v_parent_author from comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> v_post_author then
      perform create_notification(
        v_parent_author, new.author_id, 'comment_reply', '새 답글',
        coalesce(v_nick, '누군가') || '님이 답글을 남겼어요: ' || v_preview,
        '/feed/' || new.post_id,
        jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'preview', v_preview)
      );
    end if;
  end if;

  return new;
end;
$$;
