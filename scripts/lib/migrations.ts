import fs from "fs";
import path from "path";
import type { Db } from "../../lib/db";

export const LINE_TABLES = [
  "profiles",
  "permissions",
  "friendships",
  "blocks",
  "friend_groups",
  "friend_group_members",
  "friend_lists",
  "friend_list_members",
  "share_allow",
  "posts",
  "shares",
  "notifications",
  "reports",
  "tickets",
  "audit_log",
  "settings",
  "reactions",
  "comments",
  "follows",
  "follower_shares",
  "hidden_posts",
  "hidden_authors",
  "line_groups",
  "line_group_members",
  "group_posts",
  "line_v3_marker",
] as const;

const DIR = path.join(process.cwd(), "supabase", "migrations");

export function migrationFiles() {
  return fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/**
 * Applies supabase/migrations/*.sql in order to the current schema (search_path), once each.
 * Refuses to start if LINE's table names already exist without LINE's migration record,
 * so it never touches tables someone else created.
 */
export async function applyMigrations(db: Db, log: (line: string) => void = console.log) {
  const schema = ((await db.get("SELECT current_schema() AS s")) as { s: string }).s;
  const tracked = (await db.get("SELECT to_regclass('line_schema_migrations') IS NOT NULL AS ok")) as { ok: boolean };
  if (!tracked.ok) {
    const clash = (await db.all(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY(?::text[])",
      [[...LINE_TABLES]],
    )) as { table_name: string }[];
    if (clash.length) {
      throw new Error(
        `Schema "${schema}" already has tables named ${clash.map((row) => row.table_name).join(", ")} but no LINE migration record. Stopping without changes.`,
      );
    }
    await db.exec(
      "CREATE TABLE line_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE line_schema_migrations ENABLE ROW LEVEL SECURITY;",
    );
    await db.exec(
      "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE line_schema_migrations FROM anon, authenticated; END IF; END $$;",
    );
  }
  const done = new Set(((await db.all("SELECT name FROM line_schema_migrations")) as { name: string }[]).map((row) => row.name));
  let applied = 0;
  for (const name of migrationFiles()) {
    if (done.has(name)) continue;
    const text = fs.readFileSync(path.join(DIR, name), "utf8");
    await db.tx(async (tx) => {
      await tx.exec(text);
      await tx.run("INSERT INTO line_schema_migrations (name) VALUES (?)", [name]);
    });
    log(`applied ${name} to schema ${schema}`);
    applied += 1;
  }
  if (!applied) log(`schema ${schema} is up to date`);
  return applied;
}

/** Local Postgres has no Supabase auth schema or API roles. Create stand-ins so the same SQL runs. */
export async function ensureSupabaseShims(db: Db) {
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
  `);
}
