-- 0012_toss_login.sql
-- 토스 로그인 연동: api/auth/toss/login.ts가 auth.users.raw_user_meta_data.toss_user_key에
-- 심어둔 값을 온보딩 시 profiles.toss_user_key로 옮겨요. 클라이언트가 직접 넘기지 않게 해서
-- (auth.uid() 본인 메타데이터만 읽음) 다른 사람의 toss_user_key를 흉내 낼 수 없어요.

create or replace function complete_onboarding(
  p_nickname text,
  p_gender text,
  p_birth_year int,
  p_sido text,
  p_sigungu text,
  p_work_type text,
  p_off_time_band text,
  p_terms_version text,
  p_privacy_version text,
  p_avatar_url text default null,
  p_bio text default null,
  p_location_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_age int;
  v_toss_user_key text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception '이미 온보딩을 완료했어요';
  end if;

  v_age := extract(year from now()) - p_birth_year;
  if v_age < 19 then
    raise exception '만 19세 이상만 가입할 수 있어요';
  end if;

  select raw_user_meta_data->>'toss_user_key' into v_toss_user_key
  from auth.users where id = auth.uid();

  insert into profiles (
    id, nickname, gender, birth_year, sido, sigungu, work_type, off_time_band, avatar_url, bio, saved_locations, toss_user_key
  ) values (
    auth.uid(), p_nickname, p_gender, p_birth_year, p_sido, p_sigungu, p_work_type, p_off_time_band,
    p_avatar_url, nullif(btrim(p_bio), ''),
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'label', coalesce(nullif(btrim(p_location_label), ''), p_sigungu),
      'sido', p_sido,
      'sigungu', p_sigungu
    )),
    v_toss_user_key
  );

  insert into terms_agreements (user_id, terms_version, privacy_version)
  values (auth.uid(), p_terms_version, p_privacy_version);
end;
$$;

revoke execute on function complete_onboarding(text, text, int, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function complete_onboarding(text, text, int, text, text, text, text, text, text, text, text, text) to authenticated;
