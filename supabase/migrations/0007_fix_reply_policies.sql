-- 0007_fix_reply_policies.sql
-- 0005의 대댓글 검사에서 서브쿼리 안의 parent_id가 부모 행(p) 컬럼으로 해석돼 대댓글 등록이 막혔어요.
-- 새 행 컬럼을 테이블 이름으로 명시해요.

drop policy "comments_insert_own" on comments;
create policy "comments_insert_own" on comments
  for insert with check (
    author_id = auth.uid()
    and (
      comments.parent_id is null
      or exists (select 1 from comments p where p.id = comments.parent_id and p.post_id = comments.post_id)
    )
  );

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
      or exists (
        select 1 from bungae_comments p
        where p.id = bungae_comments.parent_id and p.bungae_id = bungae_comments.bungae_id
      )
    )
  );
