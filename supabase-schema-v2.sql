-- ============================================================
-- VERACAST v2 — SCHEMA ADDITIONS
-- Paste this as a NEW query in Supabase SQL Editor → Run
-- (Do NOT re-run the original schema, just this file)
-- ============================================================

-- ── Admin flag on users ───────────────────────────────────
alter table users add column if not exists is_admin boolean default false;
alter table users add column if not exists is_banned boolean default false;
alter table users add column if not exists avatar_url text default null;
alter table users add column if not exists website text default null;
alter table users add column if not exists location text default null;
alter table users add column if not exists banner_color text default '#1a1916';

-- ── Notifications ─────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade not null,
  actor_id    uuid references users(id) on delete cascade,
  type        text not null, -- 'like' | 'follow' | 'mention' | 'message' | 'system'
  post_id     uuid references posts(id) on delete cascade,
  message     text,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ── Conversations (DM + group) ────────────────────────────
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  name        text,                    -- null for DMs, set for groups
  is_group    boolean default false,
  avatar_url  text,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz default now(),
  last_message_at timestamptz default now()
);

-- ── Conversation members ──────────────────────────────────
create table if not exists conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  role            text default 'member',  -- 'admin' | 'member'
  joined_at       timestamptz default now(),
  last_read_at    timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- ── Messages ──────────────────────────────────────────────
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  user_id         uuid references users(id) on delete cascade not null,
  content         text not null,
  deleted         boolean default false,
  created_at      timestamptz default now()
);

-- ── Chat invites ──────────────────────────────────────────
create table if not exists chat_invites (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  invited_by      uuid references users(id) on delete cascade not null,
  invited_user    uuid references users(id) on delete cascade not null,
  status          text default 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at      timestamptz default now(),
  unique(conversation_id, invited_user)
);

-- ── Indexes ───────────────────────────────────────────────
create index if not exists notifs_user_idx on notifications(user_id, created_at desc);
create index if not exists messages_conv_idx on messages(conversation_id, created_at asc);
create index if not exists conv_members_user_idx on conversation_members(user_id);
create index if not exists invites_user_idx on chat_invites(invited_user, status);

-- ── RLS policies ──────────────────────────────────────────
alter table notifications enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table chat_invites enable row level security;

create policy "service role full access" on notifications for all using (true) with check (true);
create policy "service role full access" on conversations for all using (true) with check (true);
create policy "service role full access" on conversation_members for all using (true) with check (true);
create policy "service role full access" on messages for all using (true) with check (true);
create policy "service role full access" on chat_invites for all using (true) with check (true);

-- ── Set yourself as admin ─────────────────────────────────
-- After creating your account, run this with your email:
-- update users set is_admin = true where email = 'your@email.com';
