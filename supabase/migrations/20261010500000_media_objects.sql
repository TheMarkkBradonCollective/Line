-- Fallback media store for deployments without an R2 bucket bound (MEDIA).
-- Holds the bytes of private post media (u/...) and public profile photos (p/...).
-- Only the server reads it, and post media is served only after lib/access.ts passes.
create table if not exists media_objects (
  path text primary key,
  mime text not null,
  size integer not null,
  body bytea not null,
  created_at timestamptz not null default now()
);
alter table media_objects enable row level security;
revoke all on table media_objects from anon, authenticated;
