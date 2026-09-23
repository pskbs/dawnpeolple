-- 0015_notifications.sql
-- 알림(앱 안 알림 목록 + 토스 푸시). 2026-09-23 사용자 요청 3가지만 만들어요:
--   comment      : 내 수다글에 누가 댓글을 달았을 때 → 글쓴이
--   dm           : 누가 나에게 메시지를 보냈을 때 → 받는 사람
--   bungae_join  : 내가 연 소모임에 누가 참가했을 때 → 리더
-- 알림 행은 트리거로만 만들어요(클라이언트가 임의로 못 만들게). 푸시 발송은 api/push/dispatch.ts가
-- 이 행을 읽어 보내요(내용을 서버가 DB에서 읽으니 클라이언트가 문구를 위조할 수 없어요).

create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('comment', 'dm', 'bungae_join')),
  title text not null,
  body text not null,
  link text not null,
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'skipped', 'failed')),
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_actor_pending_idx on notifications (actor_id, created_at) where push_status = 'pending';

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on notifications
  for update using (user_id = auth.uid());
create policy "notifications_delete_own" on notifications
  for delete using (user_id = auth.uid());

-- 사용자는 읽음 표시(read_at)만 바꿀 수 있어요.
create trigger notifications_guard_update
  before update on notifications
  for each row execute function guard_user_update('read_at');

alter publication supabase_realtime add table notifications;

-- 종류별 알림 끄기. 행이 없으면 전부 켜진 것으로 봐요.
create table notification_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  comment boolean not null default true,
  dm boolean not null default true,
  bungae_join boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_settings enable row level security;

create policy "notification_settings_select_own" on notification_settings
  for select using (user_id = auth.uid());
create policy "notification_settings_insert_own" on notification_settings
  for insert with check (user_id = auth.uid());
create policy "notification_settings_update_own" on notification_settings
  for update using (user_id = auth.uid());

-- 공용: 알림 한 건 만들기(끈 종류·자기 자신·차단 관계면 만들지 않아요).
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

-- 알림 미리보기: 공백 정리 후 40자까지, 본문이 없으면(사진만) '사진'.
create or replace function notification_preview(p_body text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(btrim(p_body), '') = '' then '사진'
    when char_length(regexp_replace(btrim(p_body), '\s+', ' ', 'g')) > 40
      then left(regexp_replace(btrim(p_body), '\s+', ' ', 'g'), 40) || '…'
    else regexp_replace(btrim(p_body), '\s+', ' ', 'g')
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
  return new;
end;
$$;

create trigger comments_notify
  after insert on comments
  for each row execute function notify_on_comment();

create or replace function notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_nick text;
  v_preview text := notification_preview(new.body);
begin
  select case when user_a = new.sender_id then user_b else user_a end
    into v_recipient
  from conversations where id = new.conversation_id;
  select nickname into v_nick from profiles where id = new.sender_id;
  perform create_notification(
    v_recipient, new.sender_id, 'dm', '새 메시지',
    coalesce(v_nick, '누군가') || '님: ' || v_preview,
    '/dm/' || new.conversation_id,
    jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'preview', v_preview)
  );
  return new;
end;
$$;

create trigger messages_notify
  after insert on messages
  for each row execute function notify_on_message();

create or replace function notify_on_bungae_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_title text;
  v_nick text;
begin
  if new.status <> 'joined' or (tg_op = 'UPDATE' and old.status = 'joined') then
    return new;
  end if;
  select host_id, title into v_host, v_title from bungaes where id = new.bungae_id;
  select nickname into v_nick from profiles where id = new.user_id;
  perform create_notification(
    v_host, new.user_id, 'bungae_join', '새 참가자',
    coalesce(v_nick, '누군가') || '님이 ''' || v_title || ''' 소모임에 참가했어요.',
    '/bungae/' || new.bungae_id,
    jsonb_build_object('nickname', coalesce(v_nick, '누군가'), 'title', v_title)
  );
  return new;
end;
$$;

create trigger bungae_participants_notify
  after insert or update of status on bungae_participants
  for each row execute function notify_on_bungae_join();

-- 트리거·서버 전용 함수는 API로 직접 못 부르게 막아요(0006과 같은 패턴).
revoke execute on function create_notification(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function notify_on_comment() from public, anon, authenticated;
revoke execute on function notify_on_message() from public, anon, authenticated;
revoke execute on function notify_on_bungae_join() from public, anon, authenticated;
