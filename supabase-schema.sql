-- ============================================================
-- VERACAST DATABASE SCHEMA
-- Paste this entire file into:
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Users
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  handle      text unique not null,
  name        text not null,
  bio         text default '',
  avatar_color text default '#c0430a',
  password_hash text not null,
  source_rate  integer default 0,  -- cached %, updated on post
  post_count   integer default 0,
  follower_count integer default 0,
  following_count integer default 0,
  created_at  timestamptz default now()
);

-- Posts
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade not null,
  content     text not null,
  category    text not null default 'General', -- News|Science|Opinion|Meme|Lifestyle
  claim_detected boolean default false,
  like_count  integer default 0,
  comment_count integer default 0,
  share_count integer default 0,
  created_at  timestamptz default now()
);

-- Sources attached to posts
create table if not exists post_sources (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references posts(id) on delete cascade not null,
  url         text not null,
  domain      text not null,
  match_status text not null default 'unknown', -- match|partial|mismatch
  match_score  integer default 0,
  is_trusted  boolean default false,
  created_at  timestamptz default now()
);

-- Follows
create table if not exists follows (
  follower_id uuid references users(id) on delete cascade,
  following_id uuid references users(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Likes
create table if not exists likes (
  user_id uuid references users(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- Bookmarks
create table if not exists bookmarks (
  user_id uuid references users(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- ── Indexes for performance ──────────────────────────────────
create index if not exists posts_user_id_idx on posts(user_id);
create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists post_sources_post_id_idx on post_sources(post_id);
create index if not exists follows_follower_idx on follows(follower_id);
create index if not exists follows_following_idx on follows(following_id);
create index if not exists likes_post_idx on likes(post_id);
create index if not exists likes_user_idx on likes(user_id);

-- ── Row Level Security ───────────────────────────────────────
-- We use service role key in API routes, so RLS is permissive.
-- You can tighten this later once you add Supabase Auth.
alter table users enable row level security;
alter table posts enable row level security;
alter table post_sources enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table bookmarks enable row level security;

-- Allow all operations via service role (used by our API routes)
create policy "service role full access" on users for all using (true) with check (true);
create policy "service role full access" on posts for all using (true) with check (true);
create policy "service role full access" on post_sources for all using (true) with check (true);
create policy "service role full access" on follows for all using (true) with check (true);
create policy "service role full access" on likes for all using (true) with check (true);
create policy "service role full access" on bookmarks for all using (true) with check (true);
