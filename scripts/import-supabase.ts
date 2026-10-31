/**
 * npm run db:import -- /path/outside/repo/supabase_dump.json [--media-dir /path/to/files] [--write]
 *
 * One-time copy of LINE's Supabase data into Neon. Reads a JSON export (made read-only from Supabase:
 * auth.users id/email/encrypted_password/email_confirmed_at/raw_user_meta_data/created_at, plus rows of
 * LINE's tables) and inserts it with the same ids. bcrypt hashes carry over, so existing members keep
 * their passwords. Without --write it only prints what it would copy. Never touches Supabase.
 *
 * --media-dir: a folder laid out like the buckets (p/<id>/…, u/<id>/…). Files go to media_objects
 * (the Postgres fallback store). With R2 enabled, upload them to the line-media bucket instead.
 */
import fs from "fs";
import path from "path";
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { LINE_TABLES } from "./lib/migrations";

type Row = Record<string, unknown>;

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

async function main() {
  const file = process.argv[2];
  const write = process.argv.includes("--write");
  const mediaAt = process.argv.indexOf("--media-dir");
  const mediaDir = mediaAt > 0 ? process.argv[mediaAt + 1] : null;
  if (!file || !fs.existsSync(file)) throw new Error("Usage: npm run db:import -- dump.json [--media-dir dir] [--write]");
  const dump = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Row[] | null>;
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const db = new Db(sql);
    await db.tx(async (tx) => {
      for (const user of dump.auth_users ?? []) {
        console.log(`auth.users: ${write ? "copy" : "would copy"} 1 account`);
        if (write) {
          await tx.run(
            `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at)
             VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?) ON CONFLICT (id) DO NOTHING`,
            [user.id as string, user.email as string, user.encrypted_password as string, user.email_confirmed_at as string, JSON.stringify(user.raw_user_meta_data ?? {}), user.created_at as string],
          );
        }
      }
      // Parents before children: LINE_TABLES is in dependency order.
      for (const table of LINE_TABLES) {
        const rows = dump[table] ?? [];
        if (!rows.length) continue;
        console.log(`${table}: ${write ? "copy" : "would copy"} ${rows.length} row(s)`);
        if (!write) continue;
        for (const row of rows) {
          const cols = Object.keys(row);
          const values = cols.map((col) => {
            const v = row[col];
            return v !== null && typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean | null);
          });
          await tx.run(
            `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`,
            values,
          );
        }
        const hasId = (await tx.get(
          "SELECT pg_get_serial_sequence(?, 'id') AS seq",
          [table],
        )) as { seq: string | null } | undefined;
        if (hasId?.seq) await tx.exec(`SELECT setval('${hasId.seq}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);
      }
      if (mediaDir) {
        for (const rel of walk(mediaDir)) {
          const key = rel.split(path.sep).join("/");
          const mime = MIME[key.split(".").pop() ?? ""] ?? "application/octet-stream";
          const body = fs.readFileSync(path.join(mediaDir, rel));
          console.log(`media: ${write ? "copy" : "would copy"} ${key} (${body.length} bytes)`);
          if (write) {
            await tx.run(
              "INSERT INTO media_objects (path, mime, size, body) VALUES (?, ?, ?, ?) ON CONFLICT (path) DO NOTHING",
              [key, mime, body.length, body],
            );
          }
        }
      }
    });
    if (!write) console.log("Dry run. Add --write to copy.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
