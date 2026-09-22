-- 0005_social.sql
-- SNS 기능 확장(2026-09-22 사용자 요청): 프로필 사진·한줄소개, 글·댓글 첨부(이미지·영상·파일),
-- 대댓글·댓글 수정/삭제, 팔로우, DM, 소모임 참석 현황 집계, 회원탈퇴.
-- 요청서와 다른 결정(DM 도입, 참석 전 성별·연령대 집계 공개)은 docs/decisions.md 2026-09-22 항목 참고.

-- =========================================================
-- 0. 공용 헬퍼
-- =========================================================

-- 공개 버킷(media)에 올린 파일 URL만 허용해요(외부 추적 이미지 등 임의 URL 차단).
create or replace function is_valid_media(m jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(m) = 'array'
    and jsonb_array_length(m) <= 10
    and not exists (
      select 1 from jsonb_array_elements(m) e
      where not (
        e->>'type' in ('image', 'video', 'file')
        and coalesce(e->>'url', '') ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/media/'
      )
    );
$$;

-- DM 첨부는 비공개 버킷(dm-media) 경로만 저장해요: "{conversation_id}/{sender_id}/{파일}".
create or replace function is_valid_dm_media(m jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(m) = 'array'
    and jsonb_array_length(m) <= 10
    and not exists (
      select 1 from jsonb_array_elements(m) e
      where not (
        e->>'type' in ('image', 'video', 'file')
        and coalesce(e->>'path', '') ~ '^[0-9]+/[0-9a-f-]{36}/'
      )
    );
$$;

-- 두 사용자 사이에 어느 한쪽이라도 차단했는지(blocks는 본인 행만 조회 가능해서 definer로 확인).
create or replace function is_blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- 일반 사용자가 수정할 수 있는 컬럼만 바뀌었는지 검사해요.
-- 트리거(카운터)·RPC(security definer)는 소유자 권한으로 실행되므로 검사 대상이 아니에요.
create or replace function guard_user_update()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[] := tg_argv;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_key text;
begin
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return new;
  end if;
  foreach v_key in array v_allowed loop
    v_old := v_old - v_key;
    v_new := v_new - v_key;
  end loop;
  if v_old is distinct from v_new then
    raise exception '수정할 수 없는 항목이 포함되어 있어요';
  end if;
  if (to_jsonb(new) ? 'edited_at')
     and (to_jsonb(new)->'body' is distinct from to_jsonb(old)->'body'
          or to_jsonb(new)->'media' is distinct from to_jsonb(old)->'media') then
    new := jsonb_populate_record(new, jsonb_build_object('edited_at', now()));
  end if;
  return new;
end;
$$;

-- =========================================================
-- 1. 프로필: 사진·한줄소개 + 수정 가능 컬럼 제한
-- =========================================================

alter table profiles
  add column avatar_url text
    check (avatar_url is null or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/media/'),
  add column bio text check (char_length(bio) <= 150);

-- 기존 profiles_update_own 정책은 role·status까지 바꿀 수 있었어요. 허용 컬럼만 열어요.
-- 닉네임은 7일 제한이 있는 change_nickname RPC로만 바꿔요.
create trigger profiles_guard_update
  before update on profiles
  for each row execute function guard_user_update(
    'avatar_url', 'bio', 'sido', 'sigungu', 'work_type', 'show_work_badge', 'off_time_band'
  );

-- 공개 카드에 사진·소개 추가(성별·출생연도는 여전히 제외)
create or replace view profile_cards
with (security_invoker = false) as
select id, nickname, work_type, show_work_badge, avatar_url, bio
from profiles;

grant select on profile_cards to anon, authenticated;

-- =========================================================
-- 2. 수다방 글: 글자수 제한 해제(기술적 상한만), 첨부, 삭제
-- =========================================================

alter table posts drop constraint posts_body_check;
alter table posts alter column body set default '';
alter table posts
  add column media jsonb not null default '[]'::jsonb,
  add constraint posts_body_check check (char_length(body) <= 20000),
  add constraint posts_media_check check (is_valid_media(media)),
  add constraint posts_content_check check (char_length(btrim(body)) > 0 or jsonb_array_length(media) > 0);

create trigger posts_guard_update
  before update on posts
  for each row execute function guard_user_update('body', 'media', 'edited_at');

create policy "posts_delete_own_or_admin" on posts
  for delete using (author_id = auth.uid() or is_admin());

-- =========================================================
-- 3. 수다방 댓글: 대댓글(같은 글 안에서만), 이미지, 수정·삭제
-- =========================================================

alter table comments alter column body set default '';
alter table comments
  add column media jsonb not null default '[]'::jsonb,
  add column edited_at timestamptz,
  add constraint comments_body_check check (char_length(body) <= 5000),
  add constraint comments_media_check check (is_valid_media(media)),
  add constraint comments_content_check check (char_length(btrim(body)) > 0 or jsonb_array_length(media) > 0);

create index comments_post_idx on comments (post_id, created_at);
create index comments_author_idx on comments (author_id, created_at desc);

drop policy "comments_insert_own" on comments;
create policy "comments_insert_own" on comments
  for insert with check (
    author_id = auth.uid()
    and (
      parent_id is null
      or exists (select 1 from comments p where p.id = parent_id and p.post_id = comments.post_id)
    )
  );

create policy "comments_delete_own_or_admin" on comments
  for delete using (author_id = auth.uid() or is_admin());

create trigger comments_guard_update
  before update on comments
  for each row execute function guard_user_update('body', 'media', 'edited_at');

-- =========================================================
-- 4. 소모임 참석자 대화: 수다방 댓글과 같은 구조
-- =========================================================

alter table bungae_comments alter column body set default '';
alter table bungae_comments
  add column parent_id bigint references bungae_comments(id) on delete cascade,
  add column media jsonb not null default '[]'::jsonb,
  add column edited_at timestamptz,
  add constraint bungae_comments_body_check check (char_length(body) <= 5000),
  add constraint bungae_comments_media_check check (is_valid_media(media)),
  add constraint bungae_comments_content_check check (char_length(btrim(body)) > 0 or jsonb_array_length(media) > 0);

create index bungae_comments_bungae_idx on bungae_comments (bungae_id, created_at);

drop policy "bungae_comments_insert_restricted" on bungae_comments;
create policy "bungae_comments_insert_restricted" on bungae_comments
  for insert with check (
    author_id = auth.uid()
    and (
      exists (select 1 from bungaes b where b.id = bungae_id and b.host_id = auth.uid())
      or exists (
        select 1 from bungae_participants p
        where p.bungae_id = bungae_comments.bungae_id and p.user_id = auth.uid() and p.status = 'joined'
      )
    )
    and (
      parent_id is null
      or exists (select 1 from bungae_comments p where p.id = parent_id and p.bungae_id = bungae_comments.bungae_id)
    )
  );

create policy "bungae_comments_update_own" on bungae_comments
  for update using (author_id = auth.uid() or is_admin());
create policy "bungae_comments_delete_own_or_admin" on bungae_comments
  for delete using (author_id = auth.uid() or is_admin());

create trigger bungae_comments_guard_update
  before update on bungae_comments
  for each row execute function guard_user_update('body', 'media', 'edited_at');

-- 참석 전에도 볼 수 있는 성별·연령대 "집계"(개인 식별 정보 없음)
create or replace function get_bungae_demographics(p_bungae_id bigint)
returns table (gender text, age_band text, cnt int)
language sql
security definer
set search_path = public
stable
as $$
  select p.gender,
         case when p.birth_year is null then null
              else (floor((extract(year from now())::int - p.birth_year) / 10) * 10)::int || '대' end,
         count(*)::int
  from bungae_participants bp
  join profiles p on p.id = bp.user_id
  where bp.bungae_id = p_bungae_id and bp.status = 'joined'
  group by 1, 2;
$$;

-- 참석자 명단(닉네임·사진·성별·세부 연령대): 참석자·리더·관리자만 결과를 받아요.
create or replace function get_bungae_participants(p_bungae_id bigint)
returns table (user_id uuid, nickname text, avatar_url text, gender text, age_band text, is_host boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (
    is_admin()
    or exists (select 1 from bungaes b where b.id = p_bungae_id and b.host_id = auth.uid())
    or exists (
      select 1 from bungae_participants x
      where x.bungae_id = p_bungae_id and x.user_id = auth.uid() and x.status = 'joined'
    )
  ) then
    return;
  end if;

  return query
  select p.id, p.nickname, p.avatar_url, p.gender,
         case when p.birth_year is null then null
              else (floor((extract(year from now())::int - p.birth_year) / 10) * 10)::int || '대 '
                   || case when (extract(year from now())::int - p.birth_year) % 10 <= 3 then '초반'
                           when (extract(year from now())::int - p.birth_year) % 10 <= 6 then '중반'
                           else '후반' end end,
         p.id = b.host_id
  from bungae_participants bp
  join profiles p on p.id = bp.user_id
  join bungaes b on b.id = bp.bungae_id
  where bp.bungae_id = p_bungae_id and bp.status = 'joined'
  order by (p.id = b.host_id) desc, bp.joined_at;
end;
$$;

-- =========================================================
-- 5. 팔로우
-- =========================================================

create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on follows (following_id, created_at desc);

alter table follows enable row level security;

create policy "follows_select_all" on follows for select using (true);
create policy "follows_insert_own" on follows
  for insert with check (follower_id = auth.uid() and not is_blocked_between(follower_id, following_id));
create policy "follows_delete_own" on follows
  for delete using (follower_id = auth.uid());

-- 차단하면 서로의 팔로우를 끊어요.
create or replace function unfollow_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_after_insert
  after insert on blocks
  for each row execute function unfollow_on_block();

-- =========================================================
-- 6. DM (1:1 대화)
-- =========================================================

create table conversations (
  id bigint generated always as identity primary key,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_sender_id uuid,
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  body text not null default '' check (char_length(body) <= 5000),
  media jsonb not null default '[]'::jsonb check (is_valid_dm_media(media)),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (char_length(btrim(body)) > 0 or jsonb_array_length(media) > 0)
);

create index messages_conversation_idx on messages (conversation_id, created_at);
create index conversations_user_a_idx on conversations (user_a, last_message_at desc);
create index conversations_user_b_idx on conversations (user_b, last_message_at desc);

alter table conversations enable row level security;
alter table messages enable row level security;

create or replace function is_conversation_member(p_conversation_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation_id and auth.uid() in (c.user_a, c.user_b)
  );
$$;

create policy "conversations_select_member" on conversations
  for select using (auth.uid() in (user_a, user_b));
-- 대화방 생성은 start_conversation RPC로만.

create policy "messages_select_member" on messages
  for select using (is_conversation_member(conversation_id));
create policy "messages_insert_member" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_a, c.user_b)
        and not is_blocked_between(c.user_a, c.user_b)
    )
  );
-- 읽음 처리는 mark_conversation_read RPC로만.

create or replace function touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set last_message_at = new.created_at,
      last_message_preview = case when char_length(btrim(new.body)) > 0 then left(new.body, 80) else null end,
      last_sender_id = new.sender_id
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on messages
  for each row execute function touch_conversation();

create or replace function start_conversation(p_other uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id bigint;
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_other = v_me then
    raise exception '나에게는 메시지를 보낼 수 없어요';
  end if;
  if not exists (select 1 from profiles where id = p_other and status = 'active') then
    raise exception '메시지를 보낼 수 없는 사용자예요';
  end if;
  if is_blocked_between(v_me, p_other) then
    raise exception '메시지를 보낼 수 없는 사용자예요';
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  insert into conversations (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select id into v_id from conversations where user_a = v_a and user_b = v_b;
  return v_id;
end;
$$;

create or replace function mark_conversation_read(p_conversation_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and read_at is null
    and sender_id is distinct from auth.uid()
    and is_conversation_member(p_conversation_id);
$$;

create or replace function unread_message_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from messages m
  join conversations c on c.id = m.conversation_id
  where auth.uid() in (c.user_a, c.user_b)
    and m.read_at is null
    and m.sender_id is distinct from auth.uid();
$$;

alter publication supabase_realtime add table messages;

-- =========================================================
-- 7. 온보딩: 프로필 사진·한줄소개 추가
-- =========================================================

drop function complete_onboarding(text, text, int, text, text, text, text, text, text);

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
  p_bio text default null
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
    id, nickname, gender, birth_year, sido, sigungu, work_type, off_time_band, avatar_url, bio
  ) values (
    auth.uid(), p_nickname, p_gender, p_birth_year, p_sido, p_sigungu, p_work_type, p_off_time_band,
    p_avatar_url, nullif(btrim(p_bio), '')
  );

  insert into terms_agreements (user_id, terms_version, privacy_version)
  values (auth.uid(), p_terms_version, p_privacy_version);
end;
$$;

-- =========================================================
-- 8. 회원탈퇴: 계정·프로필·작성 글·댓글·소모임·대화 삭제 (요청서 6-3)
--    스토리지 파일은 DB에서 직접 지울 수 없어서(storage 보호 트리거) 클라이언트가 먼저 지워요.
-- =========================================================

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception '로그인이 필요해요';
  end if;

  -- 내가 참석해서 정원이 찼던 소모임은 다시 모집 중으로 돌려요.
  update bungaes set status = 'open'
  where status = 'full'
    and id in (select bungae_id from bungae_participants where user_id = v_me and status = 'joined');

  delete from comments where author_id = v_me;
  delete from posts where author_id = v_me;
  delete from bungae_comments where author_id = v_me;
  delete from bungaes where host_id = v_me;
  delete from conversations where v_me in (user_a, user_b);
  delete from auth.users where id = v_me; -- profiles 등은 on delete cascade
end;
$$;

-- =========================================================
-- 9. 스토리지 버킷
--    media: 공개(글·댓글·프로필 사진), 경로 "{user_id}/{파일}", 파일당 50MB
--    dm-media: 비공개(대화 참여자만), 경로 "{conversation_id}/{sender_id}/{파일}", 파일당 20MB
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dm-media', 'dm-media', false, 20971520)
on conflict (id) do nothing;

create or replace function is_conversation_folder_member(p_folder text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_folder !~ '^[0-9]+$' then
    return false;
  end if;
  return is_conversation_member(p_folder::bigint);
end;
$$;

create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dm_media_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dm-media'
    and is_conversation_folder_member((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "dm_media_select_member" on storage.objects
  for select to authenticated
  using (bucket_id = 'dm-media' and is_conversation_folder_member((storage.foldername(name))[1]));
create policy "dm_media_delete_member" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dm-media' and is_conversation_folder_member((storage.foldername(name))[1]));
