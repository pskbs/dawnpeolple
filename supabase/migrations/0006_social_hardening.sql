-- 0006_social_hardening.sql
-- 0005 적용 후 Supabase 보안 점검(advisors) 결과 반영.

-- 1) search_path 고정
alter function is_valid_media(jsonb) set search_path = public;
alter function is_valid_dm_media(jsonb) set search_path = public;
alter function guard_user_update() set search_path = public;

-- 2) 차단 여부는 "나와 상대" 관계만 확인할 수 있게(임의의 두 사람 관계 조회 차단)
create or replace function is_blocked_with(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_blocked_between(auth.uid(), p_other);
$$;

drop policy "follows_insert_own" on follows;
create policy "follows_insert_own" on follows
  for insert with check (follower_id = auth.uid() and not is_blocked_with(following_id));

drop policy "messages_insert_member" on messages;
create policy "messages_insert_member" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_a, c.user_b)
        and not is_blocked_with(case when c.user_a = auth.uid() then c.user_b else c.user_a end)
    )
  );

-- 3) 트리거 전용·내부 헬퍼 함수는 API로 직접 호출하지 못하게
revoke execute on function bump_post_like_count() from public, anon, authenticated;
revoke execute on function bump_post_comment_count() from public, anon, authenticated;
revoke execute on function touch_conversation() from public, anon, authenticated;
revoke execute on function unfollow_on_block() from public, anon, authenticated;
revoke execute on function is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- 4) 로그인 사용자 전용 RPC는 비회원(anon) 호출 차단
revoke execute on function change_nickname(text) from public, anon;
revoke execute on function complete_onboarding(text, text, int, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function delete_my_account() from public, anon;
revoke execute on function join_bungae(bigint) from public, anon;
revoke execute on function leave_bungae(bigint) from public, anon;
revoke execute on function start_conversation(uuid) from public, anon;
revoke execute on function mark_conversation_read(bigint) from public, anon;
revoke execute on function unread_message_count() from public, anon;
revoke execute on function get_bungae_participants(bigint) from public, anon;
revoke execute on function is_blocked_with(uuid) from public, anon;
revoke execute on function is_conversation_member(bigint) from public, anon;
revoke execute on function is_conversation_folder_member(text) from public, anon;

grant execute on function change_nickname(text) to authenticated;
grant execute on function complete_onboarding(text, text, int, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function delete_my_account() to authenticated;
grant execute on function join_bungae(bigint) to authenticated;
grant execute on function leave_bungae(bigint) to authenticated;
grant execute on function start_conversation(uuid) to authenticated;
grant execute on function mark_conversation_read(bigint) to authenticated;
grant execute on function unread_message_count() to authenticated;
grant execute on function get_bungae_participants(bigint) to authenticated;
grant execute on function is_blocked_with(uuid) to authenticated;
grant execute on function is_conversation_member(bigint) to authenticated;
grant execute on function is_conversation_folder_member(text) to authenticated;

-- 5) 본인이 동의한 약관 버전은 본인이 조회할 수 있게
create policy "terms_agreements_select_own" on terms_agreements
  for select using (user_id = auth.uid() or is_admin());
