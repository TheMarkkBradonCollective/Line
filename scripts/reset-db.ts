/**
 * npm run db:reset -- --yes
 * Empties LINE: deletes the Supabase Auth accounts linked to LINE profiles, the files in the
 * line-media bucket, and every row in LINE's own tables. It does not drop tables, does not touch
 * auth accounts that aren't linked to a LINE profile, and does not touch any other table or bucket.
 * Nothing is re-seeded: LINE has no demo data.
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { MEDIA_BUCKET } from "../lib/media-rules";
import { supabaseAdmin } from "../lib/supabase/admin";
import { LINE_TABLES } from "./lib/migrations";

async function emptyBucket() {
  const storage = supabaseAdmin().storage.from(MEDIA_BUCKET);
  let removed = 0;
  const { data: folders, error } = await storage.list("u", { limit: 1000 });
  if (error) return `skipped (${error.message})`;
  for (const folder of folders ?? []) {
    for (;;) {
      const { data: files } = await storage.list(`u/${folder.name}`, { limit: 1000 });
      if (!files?.length) break;
      await storage.remove(files.map((file) => `u/${folder.name}/${file.name}`));
      removed += files.length;
      if (files.length < 1000) break;
    }
  }
  return `${removed} file(s) removed`;
}

async function main() {
  if (!process.argv.includes("--yes")) {
    throw new Error("This deletes every LINE account, post and upload. Run `npm run db:reset -- --yes` if you mean it.");
  }
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const db = new Db(sql);
    const linked = (await db.all("SELECT auth_id FROM profiles WHERE auth_id IS NOT NULL")) as { auth_id: string }[];
    const admin = supabaseAdmin();
    for (const row of linked) {
      const { error } = await admin.auth.admin.deleteUser(row.auth_id);
      if (error && !/not found/i.test(error.message)) throw error;
    }
    console.log(`auth accounts deleted: ${linked.length}`);
    console.log(`media: ${await emptyBucket()}`);
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
