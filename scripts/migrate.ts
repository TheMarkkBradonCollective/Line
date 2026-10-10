/**
 * npm run db:migrate
 * Applies supabase/migrations to the database in DATABASE_URL (or SUPABASE_DB_URL), then makes sure
 * the private media bucket exists. Creates no users and no content: the live site starts empty.
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { ensureMediaBucket, ensureProfileBucket } from "../lib/storage";
import { applyMigrations } from "./lib/migrations";

async function main() {
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    await applyMigrations(new Db(sql));
  } finally {
    await sql.end({ timeout: 5 });
  }
  if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log(`media bucket: ${await ensureMediaBucket()}`);
    console.log(`profile bucket: ${await ensureProfileBucket()}`);
  } else {
    console.log("media bucket: skipped (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to check it)");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
