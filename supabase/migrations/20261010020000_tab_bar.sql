-- LINE update 2026-10-10 (c): per-user bottom tab bar. Additive and safe to run more than once.
-- Comma-separated tab keys, e.g. 'home,discover,reels,profile'. Null means the default bar.
alter table profiles add column if not exists tab_bar text;
