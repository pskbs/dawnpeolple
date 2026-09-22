-- 0009: 차단 안내, 비밀번호 재발급 요청 기록, 관리자 신고 보기, 업로드 용량
-- (2026-09-22 사용자 요청: "상대방이 차단했어요" 안내, 이메일로 새 비밀번호 발송, 어드민에서 신고 보기)

-- =========================================================
-- 1. 상대방이 나를 차단했는지 (팔로우·메시지 시도 시 안내용)
--    blocks는 본인 행만 조회할 수 있어서 definer로 확인해요. 결과는 true/false만 돌려줘요.
-- =========================================================
create or replace function blocked_me(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from blocks where blocker_id = p_other and blocked_id = auth.uid()
  );
$$;

revoke execute on function blocked_me(uuid) from public, anon;
grant execute on function blocked_me(uuid) to authenticated;

-- 메시지 시작 시 차단 방향에 따라 안내를 나눠요.
create or replace function start_conversation(p_other uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id bigint;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_other = v_me then
    raise exception '나에게는 메시지를 보낼 수 없어요';
  end if;
  if not exists (select 1 from profiles where id = p_other and status = 'active') then
    raise exception '메시지를 보낼 수 없는 사용자예요';
  end if;
  if exists (select 1 from blocks where blocker_id = p_other and blocked_id = v_me) then
    raise exception '상대방이 차단했어요';
  end if;
  if exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_other) then
    raise exception '차단한 사용자예요. 차단을 풀면 메시지를 보낼 수 있어요';
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  insert into conversations (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select id into v_id from conversations where user_a = v_a and user_b = v_b;
  return v_id;
end;
$$;

revoke execute on function start_conversation(uuid) from public, anon;
grant execute on function start_conversation(uuid) to authenticated;

-- =========================================================
-- 2. 비밀번호 재발급 (api/auth/reset-password.ts, service role 전용)
--    이메일 원문은 저장하지 않고 sha256 해시만 남겨 요청 횟수를 제한해요.
-- =========================================================
create table if not exists password_reset_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_requests_hash_idx on password_reset_requests (email_hash, created_at desc);
alter table password_reset_requests enable row level security;
-- 정책 없음: anon/authenticated는 접근 불가, service role만 사용해요.

-- 이메일로 auth 사용자 id 찾기 (service role만 실행 가능)
create or replace function find_auth_user_id(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function find_auth_user_id(text) from public, anon, authenticated;
grant execute on function find_auth_user_id(text) to service_role;

-- =========================================================
-- 3. 신고 보기 (Supabase 대시보드 Table Editor에서도 한눈에 보이도록)
--    security_invoker라 앱에서는 관리자만 전체 행을 볼 수 있어요(reports RLS 그대로).
-- =========================================================
create or replace view reports_overview
with (security_invoker = true)
as
select
  r.id,
  r.created_at,
  r.status,
  r.target_type,
  r.target_id,
  r.reason,
  r.detail,
  p.nickname as reporter_nickname,
  r.reporter_id,
  r.handled_at
from reports r
left join profiles p on p.id = r.reporter_id
order by r.created_at desc;

-- 관리자가 처리 상태를 바꾸면 처리 시각을 남겨요.
create or replace function touch_report_handled_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('resolved', 'dismissed') then
    new.handled_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists reports_before_update on reports;
create trigger reports_before_update
  before update on reports
  for each row execute function touch_report_handled_at();

revoke execute on function touch_report_handled_at() from public, anon, authenticated;

-- 직접 입력 사유는 너무 길지 않게
alter table reports drop constraint if exists reports_detail_length;
alter table reports add constraint reports_detail_length check (detail is null or char_length(detail) <= 500);

-- =========================================================
-- 4. 업로드 용량: 동영상 업로드를 막고(이미지·파일만) 파일당 20MB로 낮춰요.
--    (앱에서도 FEATURES.videoUpload=false로 막아요. 다시 열면 이 값도 함께 조정)
-- =========================================================
update storage.buckets set file_size_limit = 20971520 where id = 'media';
