-- Marks that every 2026-10-10 v3 update above has run. Keep this file sorting last.
create table if not exists line_v3_marker (id integer primary key);
alter table line_v3_marker enable row level security;
revoke all on table line_v3_marker from anon, authenticated;
