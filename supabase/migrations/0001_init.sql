-- 0001_init.sql
-- "새벽사람들 in 부천" 초기 스키마 초안 (요청서 6장 기준)
-- ⚠️ 이 파일은 초안입니다. 실제 Supabase 프로젝트에는 아직 적용되지 않았습니다.
--    사용자 검토 후 Supabase SQL Editor 또는 `supabase db push`로 적용하세요.

-- =========================================================
-- 1. 테이블
-- =========================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  nickname_changed_at timestamptz not null default now(),
  gender text check (gender in ('male', 'female')),
  birth_year int,
  sido text,
  sigungu text,
  work_type text,
  show_work_badge boolean not null default true,
  off_time_band text,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'withdrawn')),
  toss_user_key text unique,
  created_at timestamptz not null default now()
);

create table terms_agreements (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  agreed_at timestamptz not null default now()
);

create table posts (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(body) <= 500),
  kind text not null default 'user' check (kind in ('user', 'system')),
  is_pinned boolean not null default false,
  like_count int not null default 0,
  comment_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'pending_review')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  parent_id bigint references comments(id) on delete cascade,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'pending_review')),
  created_at timestamptz not null default now()
);

create table post_likes (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table comment_likes (
  user_id uuid not null references profiles(id) on delete cascade,
  comment_id bigint not null references comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create table bungaes (
  id bigint generated always as identity primary key,
  host_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 30),
  body text not null check (char_length(body) <= 500),
  starts_at timestamptz not null,
  region_code text not null default 'bucheon',
  place_hint text check (char_length(place_hint) <= 30),
  capacity int not null check (capacity between 2 and 10),
  min_confirm int,
  status text not null default 'open' check (status in ('open', 'full', 'closed', 'cancelled', 'cancelled_min')),
  created_at timestamptz not null default now()
);

create table bungae_participants (
  bungae_id bigint not null references bungaes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'cancelled')),
  joined_at timestamptz not null default now(),
  primary key (bungae_id, user_id)
);

create table bungae_comments (
  id bigint generated always as identity primary key,
  bungae_id bigint not null references bungaes(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'bungae', 'bungae_comment', 'user')),
  target_id text not null,
  reason text not null,
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table user_sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('warning', 'suspension', 'permanent')),
  reason text not null,
  until timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid not null references profiles(id),
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

create table banned_words (
  word text primary key,
  severity int not null default 1
);

create table presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create table work_status (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text not null check (status in ('work', 'off', 'rest')),
  updated_at timestamptz not null default now()
);

create table region_waitlist (
  user_id uuid not null references profiles(id) on delete cascade,
  sigungu text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sigungu)
);

create table app_settings (
  key text primary key,
  value jsonb not null
);

insert into app_settings (key, value) values
  ('bungae_create_role', '"all"'),
  ('OPEN_REGIONS', '["bucheon"]'),
  ('NICKNAME_CHANGE_DAYS', '7'),
  ('BUNGAE_LIMITS', '{"daily_create": 2, "concurrent": 3, "min_hours_ahead": 1, "max_days_ahead": 14, "cancel_hours_before": 3, "report_threshold": 3}');

-- =========================================================
-- 2. RLS 활성화 (기본 거부)
-- =========================================================

alter table profiles enable row level security;
alter table terms_agreements enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_likes enable row level security;
alter table comment_likes enable row level security;
alter table bungaes enable row level security;
alter table bungae_participants enable row level security;
alter table bungae_comments enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;
alter table user_sanctions enable row level security;
alter table admin_actions enable row level security;
alter table banned_words enable row level security;
alter table presence enable row level security;
alter table work_status enable row level security;
alter table region_waitlist enable row level security;
alter table app_settings enable row level security;

-- 헬퍼: 현재 사용자가 admin인지
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- --- profiles ---
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());
-- insert는 온보딩 RPC(security definer)를 통해서만 수행하고, 직접 insert 정책은 열지 않음.

-- --- posts / comments (공개 콘텐츠) ---
create policy "posts_select_visible" on posts
  for select using (status = 'visible' or author_id = auth.uid() or is_admin());
create policy "posts_insert_own" on posts
  for insert with check (author_id = auth.uid());
create policy "posts_update_own_or_admin" on posts
  for update using (author_id = auth.uid() or is_admin());

create policy "comments_select_visible" on comments
  for select using (status = 'visible' or author_id = auth.uid() or is_admin());
create policy "comments_insert_own" on comments
  for insert with check (author_id = auth.uid());
create policy "comments_update_own_or_admin" on comments
  for update using (author_id = auth.uid() or is_admin());

create policy "post_likes_select_own" on post_likes
  for select using (user_id = auth.uid());
create policy "post_likes_insert_own" on post_likes
  for insert with check (user_id = auth.uid());
create policy "post_likes_delete_own" on post_likes
  for delete using (user_id = auth.uid());

create policy "comment_likes_select_own" on comment_likes
  for select using (user_id = auth.uid());
create policy "comment_likes_insert_own" on comment_likes
  for insert with check (user_id = auth.uid());
create policy "comment_likes_delete_own" on comment_likes
  for delete using (user_id = auth.uid());

-- --- bungaes (목록/상세 공개 정보만) ---
create policy "bungaes_select_visible" on bungaes
  for select using (status <> 'pending_review' or host_id = auth.uid() or is_admin());
create policy "bungaes_insert_own" on bungaes
  for insert with check (host_id = auth.uid());
create policy "bungaes_update_own_or_admin" on bungaes
  for update using (host_id = auth.uid() or is_admin());

-- 참석자 목록: 참석자 본인 + 리더 + 관리자만 조회 가능 (요청서 6-2 핵심 규칙)
create policy "bungae_participants_select_restricted" on bungae_participants
  for select using (
    user_id = auth.uid()
    or is_admin()
    or exists (select 1 from bungaes b where b.id = bungae_id and b.host_id = auth.uid())
  );
-- insert/delete는 join_bungae/leave_bungae RPC(security definer)로만 수행 — 직접 정책 없음.

-- 벙개 댓글: 참석자 + 리더 + 관리자만
create policy "bungae_comments_select_restricted" on bungae_comments
  for select using (
    is_admin()
    or exists (select 1 from bungaes b where b.id = bungae_id and b.host_id = auth.uid())
    or exists (
      select 1 from bungae_participants p
      where p.bungae_id = bungae_comments.bungae_id and p.user_id = auth.uid() and p.status = 'joined'
    )
  );
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
  );

-- --- reports / blocks / sanctions (본인 것만 + 관리자) ---
create policy "reports_select_own_or_admin" on reports
  for select using (reporter_id = auth.uid() or is_admin());
create policy "reports_insert_own" on reports
  for insert with check (reporter_id = auth.uid());
create policy "reports_update_admin_only" on reports
  for update using (is_admin());

create policy "blocks_select_own" on blocks
  for select using (blocker_id = auth.uid());
create policy "blocks_insert_own" on blocks
  for insert with check (blocker_id = auth.uid());
create policy "blocks_delete_own" on blocks
  for delete using (blocker_id = auth.uid());

create policy "user_sanctions_select_own_or_admin" on user_sanctions
  for select using (user_id = auth.uid() or is_admin());
create policy "user_sanctions_admin_write" on user_sanctions
  for all using (is_admin()) with check (is_admin());

create policy "admin_actions_admin_only" on admin_actions
  for all using (is_admin()) with check (is_admin());

create policy "banned_words_select_all" on banned_words
  for select using (true);
create policy "banned_words_admin_write" on banned_words
  for insert with check (is_admin());
create policy "banned_words_admin_update" on banned_words
  for update using (is_admin());
create policy "banned_words_admin_delete" on banned_words
  for delete using (is_admin());

create policy "presence_select_own" on presence
  for select using (user_id = auth.uid() or is_admin());
create policy "presence_upsert_own" on presence
  for insert with check (user_id = auth.uid());
create policy "presence_update_own" on presence
  for update using (user_id = auth.uid());

create policy "work_status_select_own" on work_status
  for select using (user_id = auth.uid() or is_admin());
create policy "work_status_upsert_own" on work_status
  for insert with check (user_id = auth.uid());
create policy "work_status_update_own" on work_status
  for update using (user_id = auth.uid());

create policy "region_waitlist_select_own_or_admin" on region_waitlist
  for select using (user_id = auth.uid() or is_admin());
create policy "region_waitlist_insert_own" on region_waitlist
  for insert with check (user_id = auth.uid());

create policy "app_settings_select_all" on app_settings
  for select using (true);
create policy "app_settings_admin_write" on app_settings
  for update using (is_admin());

-- =========================================================
-- 3. 원자적 쓰기 RPC (security definer)
-- =========================================================

-- 벙개 참석 신청: 정원 초과를 트랜잭션 내에서 차단 (동시 신청 경합 처리)
create or replace function join_bungae(p_bungae_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_status text;
  v_joined_count int;
begin
  select capacity, status into v_capacity, v_status
  from bungaes where id = p_bungae_id
  for update; -- 행 잠금으로 동시 신청 경합 방지

  if v_status not in ('open') then
    raise exception '모집 중인 벙개가 아니에요';
  end if;

  select count(*) into v_joined_count
  from bungae_participants
  where bungae_id = p_bungae_id and status = 'joined';

  if v_joined_count >= v_capacity then
    raise exception '정원이 가득 찼어요';
  end if;

  insert into bungae_participants (bungae_id, user_id, status)
  values (p_bungae_id, auth.uid(), 'joined')
  on conflict (bungae_id, user_id) do update set status = 'joined', joined_at = now();

  if v_joined_count + 1 >= v_capacity then
    update bungaes set status = 'full' where id = p_bungae_id;
  end if;
end;
$$;

-- 벙개 참석 취소: 시작 N시간 전까지만 가능
create or replace function leave_bungae(p_bungae_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starts_at timestamptz;
  v_cancel_hours int;
begin
  select starts_at into v_starts_at from bungaes where id = p_bungae_id for update;
  select (value->>'cancel_hours_before')::int into v_cancel_hours from app_settings where key = 'BUNGAE_LIMITS';

  if v_starts_at - now() < make_interval(hours => coalesce(v_cancel_hours, 3)) then
    raise exception '취소 가능 시간이 지났어요';
  end if;

  update bungae_participants set status = 'cancelled'
  where bungae_id = p_bungae_id and user_id = auth.uid();

  update bungaes set status = 'open' where id = p_bungae_id and status = 'full';
end;
$$;

-- 남은 자리만 반환 (미참석자에게 참석자 수/행 노출 금지)
create or replace function get_bungae_remaining_slots(p_bungae_id bigint)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select b.capacity - count(p.user_id)
  from bungaes b
  left join bungae_participants p on p.bungae_id = b.id and p.status = 'joined'
  where b.id = p_bungae_id
  group by b.capacity;
$$;

-- 닉네임 변경: 쿨다운 검사
create or replace function change_nickname(p_new_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_changed timestamptz;
  v_cooldown_days int;
begin
  select nickname_changed_at into v_last_changed from profiles where id = auth.uid() for update;
  select (value)::int into v_cooldown_days from app_settings where key = 'NICKNAME_CHANGE_DAYS';

  if now() - v_last_changed < make_interval(days => coalesce(v_cooldown_days, 7)) then
    raise exception '닉네임은 %일에 한 번만 바꿀 수 있어요', coalesce(v_cooldown_days, 7);
  end if;

  update profiles set nickname = p_new_nickname, nickname_changed_at = now() where id = auth.uid();
end;
$$;
