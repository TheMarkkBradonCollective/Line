-- Neon prelude. Runs first.
--
-- LINE moved off Supabase (Oct 31, 2026). Neon has no Supabase auth schema or API roles,
-- so this creates them: the later migrations still revoke from anon/authenticated and
-- profiles.auth_id still references auth.users(id). auth.users is now LINE's own account
-- table (email + bcrypt hash), read and written only by the server. On a database that
-- already has these (Supabase) every statement is a no-op.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;
alter table auth.users add column if not exists created_at timestamptz not null default now();
alter table auth.users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists users_email_lower_key on auth.users (lower(email));
