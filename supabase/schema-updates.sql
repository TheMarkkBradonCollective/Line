-- LINE schema updates for an existing database. Paste each new section into the Supabase SQL Editor once, in order.
-- Every section is idempotent (safe to re-run). Fresh installs use supabase/schema.sql instead.

-- ═══ 2026-10-10: follows, Followers audience, profile & cover photos (supabase/migrations/20261010000000_follows_avatars.sql) ═══
-- LINE update 2026-10-10: follows, a Followers audience, profile and cover photos.
-- Additive and safe to run more than once.

alter table profiles add column if not exists avatar_path text;
alter table profiles add column if not exists cover_path text;

-- Anyone can follow anyone (no approval). Following never allows direct sharing.
create table if not exists follows (
  follower_id integer not null references profiles (id) on delete cascade,
  followee_id integer not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists idx_follows_followee on follows (followee_id, created_at desc);

-- A post sent to "Followers" by from_user_id: visible to everyone who follows that person,
-- including people who follow later.
create table if not exists follower_shares (
  post_id integer not null references posts (id) on delete cascade,
  from_user_id integer not null references profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (post_id, from_user_id)
);
create index if not exists idx_follower_shares_from on follower_shares (from_user_id, created_at desc);

alter table follows enable row level security;
alter table follower_shares enable row level security;
revoke all on table follows from anon, authenticated;
revoke all on table follower_shares from anon, authenticated;

-- Public bucket for profile and cover photos (public profile info). Post media stays in the private line-media bucket.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('line-profiles', 'line-profiles', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
