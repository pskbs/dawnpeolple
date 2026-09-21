-- 0003_public_profile_view.sql
-- profiles 테이블의 RLS는 "본인 또는 관리자만 조회"로 잠겨있어서(0001_init.sql),
-- 수다방 글쓴이 닉네임처럼 다른 사용자에게도 보여야 하는 최소 정보를 위한 공개 뷰를 추가한다.
-- 성별·출생연도(정확한 나이)는 이 뷰에 포함하지 않는다(요청서 6-1: 참석 후 화면에서만 연령대로 노출).

create view profile_cards
with (security_invoker = false) as
select id, nickname, work_type, show_work_badge
from profiles;

grant select on profile_cards to anon, authenticated;
