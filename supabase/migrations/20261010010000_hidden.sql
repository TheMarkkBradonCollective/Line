-- LINE update 2026-10-10 (b): private Dislike and "Hide all posts from <name>".
-- Additive and safe to run more than once. Never shown publicly; nobody is notified.

create table if not exists hidden_posts (
  user_id integer not null references profiles (id) on delete cascade,
  post_id integer not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists hidden_authors (
  user_id integer not null references profiles (id) on delete cascade,
  author_id integer not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, author_id),
  check (user_id <> author_id)
);

alter table hidden_posts enable row level security;
alter table hidden_authors enable row level security;
revoke all on table hidden_posts from anon, authenticated;
revoke all on table hidden_authors from anon, authenticated;
