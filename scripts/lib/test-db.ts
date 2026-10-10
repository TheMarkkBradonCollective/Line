import { randomBytes } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { createSql, Db } from "../../lib/db";
import { applyMigrations, ensureSupabaseShims } from "./migrations";

/**
 * A throwaway Postgres schema for tests. It never touches LINE's live tables:
 * - TEST_DATABASE_URL set: a fresh schema line_test_<random> on that server, dropped afterwards.
 * - Otherwise: a private Postgres started from the embedded-postgres dev dependency in a temp folder.
 */
export async function withTestDatabase(run: (db: Db) => Promise<void>) {
  let url = process.env.TEST_DATABASE_URL;
  let stop: (() => Promise<void>) | null = null;
  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "line-pg-"));
    const port = 55000 + Math.floor(Math.random() * 5000);
    const pg = new EmbeddedPostgres({ databaseDir: dir, port, user: "postgres", password: "postgres", persistent: false, onLog: () => {} });
    await pg.initialise();
    await pg.start();
    url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    stop = async () => {
      await pg.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    };
  }
  const schema = `line_test_${randomBytes(4).toString("hex")}`;
  const admin = createSql({ url, max: 1 });
  const adminDb = new Db(admin);
  try {
    const hasAuth = (await adminDb.get("SELECT to_regclass('auth.users') IS NOT NULL AS ok")) as { ok: boolean };
    if (!hasAuth.ok) await ensureSupabaseShims(adminDb);
    await adminDb.exec(`CREATE SCHEMA ${schema}`);
    const sql = createSql({ url, schema, max: 4 });
    try {
      const db = new Db(sql);
      await applyMigrations(db, () => {});
      await run(db);
    } finally {
      await sql.end({ timeout: 5 });
    }
  } finally {
    await adminDb.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
    await admin.end({ timeout: 5 });
    if (stop) await stop();
  }
}
