/**
 * npm run db:reset -- --yes
 * Empties LINE: deletes the LINE accounts (auth.users) linked to LINE profiles, the stored media
 * rows in media_objects, and every row in LINE's own tables. R2 objects are not touched (empty the
 * line-media bucket from the Cloudflare dashboard or wrangler if you need to). Nothing is re-seeded.
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { LINE_TABLES } from "./lib/migrations";

async function main() {
  if (!process.argv.includes("--yes")) {
    throw new Error("This deletes every LINE account, post and upload. Run `npm run db:reset -- --yes` if you mean it.");
  }
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const db = new Db(sql);
    const linked = await db.run("DELETE FROM auth.users WHERE id IN (SELECT auth_id FROM profiles WHERE auth_id IS NOT NULL)");
    console.log(`auth accounts deleted: ${linked.count}`);
    await db.exec("TRUNCATE media_objects");
    await db.exec(`TRUNCATE ${LINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
    console.log(`emptied tables: ${LINE_TABLES.join(", ")}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
