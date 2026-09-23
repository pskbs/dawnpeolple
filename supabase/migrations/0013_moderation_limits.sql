-- 0013_moderation_limits.sql
-- CLAUDE.md 주요 결정에 있던 "하루 2건·동시 3건 개설 한도"와 "신고 3건 누적 시 자동 비노출"을
-- 실제로 강제해요. 값 자체는 0001_init.sql의 app_settings.BUNGAE_LIMITS에 처음부터 있었지만
-- 지금까지 강제하는 로직이 없었어요(docs/decisions.md 여러 항목에 TODO로 남아있던 것).

-- =========================================================
-- 1. 소모임 개설 한도(하루 2건·동시 3건)
-- =========================================================

create or replace function enforce_bungae_create_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_daily_limit int;
  v_concurrent_limit int;
  v_daily_count int;
  v_concurrent_count int;
begin
  select value into v_limits from app_settings where key = 'BUNGAE_LIMITS';
  v_daily_limit := coalesce((v_limits->>'daily_create')::int, 2);
  v_concurrent_limit := coalesce((v_limits->>'concurrent')::int, 3);

  select count(*) into v_daily_count
  from bungaes
  where host_id = new.host_id
    and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;

  if v_daily_count >= v_daily_limit then
    raise exception '오늘은 소모임을 더 만들 수 없어요(하루 %건까지)', v_daily_limit;
  end if;

  select count(*) into v_concurrent_count
  from bungaes
  where host_id = new.host_id
    and status in ('open', 'full');

  if v_concurrent_count >= v_concurrent_limit then
    raise exception '동시에 진행 중인 소모임이 너무 많아요(최대 %개)', v_concurrent_limit;
  end if;

  return new;
end;
$$;

create trigger bungaes_enforce_create_limits
  before insert on bungaes
  for each row execute function enforce_bungae_create_limits();

-- =========================================================
-- 2. 신고 누적 시 자동 비노출(서로 다른 신고자 기준 3명 이상)
--    사용자(target_type='user') 신고는 자동 정지 기능이 아직 없어(decisions.md 2026-09-22 항목),
--    관리자 수동 처리만 남겨두고 자동 조치는 하지 않아요.
-- =========================================================

create or replace function enforce_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_threshold int;
  v_distinct_reporters int;
begin
  select value into v_limits from app_settings where key = 'BUNGAE_LIMITS';
  v_threshold := coalesce((v_limits->>'report_threshold')::int, 3);

  select count(distinct reporter_id) into v_distinct_reporters
  from reports
  where target_type = new.target_type
    and target_id = new.target_id;

  if v_distinct_reporters < v_threshold then
    return new;
  end if;

  if new.target_type = 'post' then
    update posts set status = 'hidden' where id = new.target_id::bigint and status = 'visible';
  elsif new.target_type = 'comment' then
    update comments set status = 'hidden' where id = new.target_id::bigint and status = 'visible';
  elsif new.target_type = 'bungae' then
    update bungaes set status = 'cancelled' where id = new.target_id::bigint and status in ('open', 'full');
  elsif new.target_type = 'bungae_comment' then
    update bungae_comments set status = 'hidden' where id = new.target_id::bigint and status = 'visible';
  end if;

  return new;
end;
$$;

create trigger reports_enforce_threshold
  after insert on reports
  for each row execute function enforce_report_threshold();

-- 트리거 전용 함수라 RPC로 직접 호출될 필요가 없어요(기존 카운터 트리거와 동일 패턴, 0006 참고).
revoke execute on function enforce_bungae_create_limits() from public, anon, authenticated;
revoke execute on function enforce_report_threshold() from public, anon, authenticated;
