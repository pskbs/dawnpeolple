-- 0004_counters.sql
-- posts.like_count / posts.comment_count 를 애플리케이션이 아닌 DB 트리거로 유지한다.
-- (좋아요/댓글 동시 요청에도 카운트가 어긋나지 않도록)

create or replace function bump_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger post_likes_after_insert
  after insert on post_likes
  for each row execute function bump_post_like_count();

create trigger post_likes_after_delete
  after delete on post_likes
  for each row execute function bump_post_like_count();

create or replace function bump_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger comments_after_insert
  after insert on comments
  for each row execute function bump_post_comment_count();

create trigger comments_after_delete
  after delete on comments
  for each row execute function bump_post_comment_count();
