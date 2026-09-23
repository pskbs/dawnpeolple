-- 0014_admin_delete_account.sql
-- 토스 로그인 "연결 끊기(UNLINK)" 콜백 대응(CLAUDE.md 절대규칙 4: 토스 연결 해제 시 데이터 삭제).
-- 사용자가 토스앱 설정에서 직접 연결을 끊으면 우리 서버(api/auth/toss/unlink.ts)가 콜백을 받아
-- 이 함수를 호출해요. delete_my_account()와 로직은 같지만 auth.uid() 대신 특정 사용자 id를 받아요
-- (웹훅 요청에는 로그인 세션이 없어서 auth.uid()를 쓸 수 없음).

create or replace function admin_delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 내가 참석해서 정원이 찼던 소모임은 다시 모집 중으로 돌려요.
  update bungaes set status = 'open'
  where status = 'full'
    and id in (select bungae_id from bungae_participants where user_id = p_user_id and status = 'joined');

  delete from comments where author_id = p_user_id;
  delete from posts where author_id = p_user_id;
  delete from bungae_comments where author_id = p_user_id;
  delete from bungaes where host_id = p_user_id;
  delete from conversations where p_user_id in (user_a, user_b);
  delete from auth.users where id = p_user_id; -- profiles 등은 on delete cascade
end;
$$;

-- 서버(service role)에서만 호출해요. 일반 로그인 사용자가 다른 사람 id로 호출하면 안 되니 완전히 막아요.
revoke execute on function admin_delete_account(uuid) from public, anon, authenticated;
