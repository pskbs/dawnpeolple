-- 0008_fix_bungae_reply_recursion.sql
-- bungae_comments insert 정책이 자기 테이블을 다시 읽어 "infinite recursion" 오류가 났어요.
-- 부모 댓글 검사를 security definer 함수로 옮겨 정책 재귀를 끊어요.

create or replace function is_bungae_comment_in(p_comment_id bigint, p_bungae_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from bungae_comments where id = p_comment_id and bungae_id = p_bungae_id);
$$;

revoke execute on function is_bungae_comment_in(bigint, bigint) from public, anon;
grant execute on function is_bungae_comment_in(bigint, bigint) to authenticated;

drop policy "bungae_comments_insert_restricted" on bungae_comments;
create policy "bungae_comments_insert_restricted" on bungae_comments
  for insert with check (
    author_id = auth.uid()
    and (
      exists (select 1 from bungaes b where b.id = bungae_comments.bungae_id and b.host_id = auth.uid())
      or exists (
        select 1 from bungae_participants x
        where x.bungae_id = bungae_comments.bungae_id and x.user_id = auth.uid() and x.status = 'joined'
      )
    )
    and (
      bungae_comments.parent_id is null
      or is_bungae_comment_in(bungae_comments.parent_id, bungae_comments.bungae_id)
    )
  );
