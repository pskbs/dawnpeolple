-- 0002_onboarding.sql
-- 온보딩 완료 RPC: profiles + terms_agreements를 원자적으로 생성

create or replace function complete_onboarding(
  p_nickname text,
  p_gender text,
  p_birth_year int,
  p_sido text,
  p_sigungu text,
  p_work_type text,
  p_off_time_band text,
  p_terms_version text,
  p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_age int;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception '이미 온보딩을 완료했어요';
  end if;

  v_age := extract(year from now()) - p_birth_year;
  if v_age < 19 then
    raise exception '만 19세 이상만 가입할 수 있어요';
  end if;

  insert into profiles (
    id, nickname, gender, birth_year, sido, sigungu, work_type, off_time_band
  ) values (
    auth.uid(), p_nickname, p_gender, p_birth_year, p_sido, p_sigungu, p_work_type, p_off_time_band
  );

  insert into terms_agreements (user_id, terms_version, privacy_version)
  values (auth.uid(), p_terms_version, p_privacy_version);
end;
$$;
