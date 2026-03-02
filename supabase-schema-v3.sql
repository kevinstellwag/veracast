-- ============================================================
-- VERACAST v3 — IMAGE POSTS + REACTIONS + EXTRAS
-- Run this as a NEW query in Supabase SQL Editor
-- ============================================================

-- Add image support to posts
alter table posts add column if not exists image_url text default null;
alter table posts add column if not exists image_caption text default null;

-- Reactions (beyond just likes — emoji reactions)
create table if not exists reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references posts(id) on delete cascade not null,
  user_id     uuid references users(id) on delete cascade not null,
  emoji       text not null default '❤️',
  created_at  timestamptz default now(),
  unique(post_id, user_id, emoji)
);

-- Comments on posts
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references posts(id) on delete cascade not null,
  user_id     uuid references users(id) on delete cascade not null,
  content     text not null,
  created_at  timestamptz default now()
);

-- Hashtags (extracted from posts for trending)
create table if not exists post_hashtags (
  post_id     uuid references posts(id) on delete cascade,
  tag         text not null,
  primary key (post_id, tag)
);

-- Verified accounts (blue check)
alter table users add column if not exists is_verified boolean default false;

-- Pinned posts
alter table users add column if not exists pinned_post_id uuid references posts(id) on delete set null;

-- Message reactions
alter table messages add column if not exists reactions jsonb default '{}';

-- Indexes
create index if not exists reactions_post_idx on reactions(post_id);
create index if not exists comments_post_idx on comments(post_id, created_at desc);
create index if not exists hashtags_tag_idx on post_hashtags(tag);

-- RLS
alter table reactions enable row level security;
alter table comments enable row level security;
alter table post_hashtags enable row level security;
create policy "service role full access" on reactions for all using (true) with check (true);
create policy "service role full access" on comments for all using (true) with check (true);
create policy "service role full access" on post_hashtags for all using (true) with check (true);
