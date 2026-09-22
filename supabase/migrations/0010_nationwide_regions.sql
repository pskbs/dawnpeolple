-- 0010_nationwide_regions.sql
-- 지역을 "부천 고정 바인딩"에서 전국(시/도·시/군/구·읍면동) 오픈으로 확장 (2026-09-22 결정, docs/decisions.md)

-- 1) 소모임: 시/도·시/군/구·읍/면/동 컬럼 추가.
--    region_code(기존 'bucheon' 고정 컬럼)는 더 이상 앱에서 쓰지 않지만, 마이그레이션 단순화를 위해 그대로 둬요.
alter table bungaes
  add column sido text not null default '경기',
  add column sigungu text not null default '부천시',
  add column eupmyeondong text check (eupmyeondong is null or char_length(eupmyeondong) <= 20);

create index bungaes_region_idx on bungaes (sido, sigungu);

-- 2) 프로필: 즐겨찾는 동네(최대 3개, 이름 지정 가능 — 집/회사 등). 당근마켓 "동네 설정"과 비슷한 개념.
alter table profiles
  add column saved_locations jsonb not null default '[]'::jsonb,
  add constraint saved_locations_max3 check (jsonb_array_length(saved_locations) <= 3);

-- profiles_guard_update 트리거가 허용하는 컬럼 목록에 saved_locations 추가.
drop trigger profiles_guard_update on profiles;
create trigger profiles_guard_update
  before update on profiles
  for each row execute function guard_user_update(
    'avatar_url', 'bio', 'sido', 'sigungu', 'work_type', 'show_work_badge', 'off_time_band', 'saved_locations'
  );
