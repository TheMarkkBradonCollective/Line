/**
 * npm run db:migrate
 * Applies db/line_schema.sql to Neon (DIRECT_DATABASE_URL or DATABASE_URL).
 * Creates no users and no content. Media lives in R2 (wrangler.jsonc binding MEDIA).
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { applyMigrations } from "./lib/migrations";

async function main() {
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    await applyMigrations(new Db(sql));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
