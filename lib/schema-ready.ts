import type { Db } from "./db";

/**
 * True once the owner has run the 2026-10-10 update SQL (line_update3.sql).
 * Until then the app keeps working as before and the new features say they're waiting for it.
 * A positive answer is cached for the life of the server; a negative one is rechecked every 30 seconds.
 */
let ready = false;
let checkedAt = 0;

export async function v3Ready(db: Db) {
  if (ready) return true;
  if (Date.now() - checkedAt < 30_000) return false;
  return db.memo("v3ready", async () => {
    const row = (await db.get("SELECT to_regclass('line_v3_marker') IS NOT NULL AS ok")) as { ok: boolean };
    checkedAt = Date.now();
    ready = Boolean(row.ok);
    return ready;
  });
}

/** Tests and scripts that just applied migrations can skip the wait. */
export function resetSchemaReady() {
  ready = false;
  checkedAt = 0;
}
