/**
 * npm run db:import [--write]
 *
 * Copies LINE from Supabase into Neon (dry-run by default).
 *
 * Postgres (set SOURCE_DATABASE_URL to the Supabase Postgres URI):
 *   Reads auth.users and LINE tables from the source DB and inserts into DIRECT_DATABASE_URL / DATABASE_URL.
 *
 * JSON fallback:
 *   npm run db:import -- /path/to/dump.json [--media-dir dir] [--write]
 *
 * Storage (optional, with --write):
 *   Supabase REST: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, bucket line-media (default).
 *   Or S3-compatible: SOURCE_S3_ENDPOINT, SOURCE_S3_ACCESS_KEY_ID, SOURCE_S3_SECRET_ACCESS_KEY, SOURCE_S3_BUCKET.
 *   Destination R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (default line-media).
 *   Without R2 credentials, files go to media_objects in Postgres.
 */
import fs from "fs";
import path from "path";
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { LINE_TABLES } from "./lib/migrations";

type Row = Record<string, unknown>;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

function sourceDatabaseUrl() {
  const url = process.env.SOURCE_DATABASE_URL || "";
  if (!/^postgres(ql)?:\/\//.test(url)) return null;
  return url;
}

async function copyAuthUsers(source: Db, target: Db, write: boolean) {
  const rows = (await source.all(
    "SELECT id::text AS id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at FROM auth.users",
  )) as Row[];
  console.log(`auth.users: ${write ? "copy" : "would copy"} ${rows.length} account(s)`);
  if (!write) return;
  for (const user of rows) {
    await target.run(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at)
       VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?) ON CONFLICT (id) DO NOTHING`,
      [
        user.id as string,
        user.email as string,
        user.encrypted_password as string,
        user.email_confirmed_at as string,
        JSON.stringify(user.raw_user_meta_data ?? {}),
        user.created_at as string,
      ],
    );
  }
}

async function copyLineTables(source: Db, target: Db, write: boolean) {
  for (const table of LINE_TABLES) {
    const rows = (await source.all(`SELECT * FROM ${table}`)) as Row[];
    if (!rows.length) continue;
    console.log(`${table}: ${write ? "copy" : "would copy"} ${rows.length} row(s)`);
    if (!write) continue;
    for (const row of rows) {
      const cols = Object.keys(row);
      const values = cols.map((col) => {
        const v = row[col];
        return v !== null && typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean | null);
      });
      await target.run(
        `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`,
        values,
      );
    }
    const hasId = (await target.get("SELECT pg_get_serial_sequence(?, 'id') AS seq", [table])) as { seq: string | null } | undefined;
    if (hasId?.seq) await target.exec(`SELECT setval('${hasId.seq}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);
  }
}

async function copyFromPostgres(write: boolean) {
  const sourceUrl = sourceDatabaseUrl();
  if (!sourceUrl) throw new Error("Set SOURCE_DATABASE_URL to the Supabase Postgres connection string.");
  const sourceSql = createSql({ url: sourceUrl, max: 1 });
  const targetSql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const source = new Db(sourceSql);
    const target = new Db(targetSql);
    await copyAuthUsers(source, target, write);
    await copyLineTables(source, target, write);
  } finally {
    await sourceSql.end({ timeout: 5 });
    await targetSql.end({ timeout: 5 });
  }
}

async function copyFromJson(file: string, mediaDir: string | null, write: boolean) {
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
            [
              user.id as string,
              user.email as string,
              user.encrypted_password as string,
              user.email_confirmed_at as string,
              JSON.stringify(user.raw_user_meta_data ?? {}),
              user.created_at as string,
            ],
          );
        }
      }
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
        const hasId = (await tx.get("SELECT pg_get_serial_sequence(?, 'id') AS seq", [table])) as { seq: string | null } | undefined;
        if (hasId?.seq) await tx.exec(`SELECT setval('${hasId.seq}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);
      }
      if (mediaDir) {
        for (const rel of walk(mediaDir)) {
          const key = rel.split(path.sep).join("/");
          const mime = MIME[key.split(".").pop() ?? ""] ?? "application/octet-stream";
          const body = fs.readFileSync(path.join(mediaDir, rel));
          console.log(`media: ${write ? "copy" : "would copy"} ${key} (${body.length} bytes)`);
          if (write) {
            await tx.run("INSERT INTO media_objects (path, mime, size, body) VALUES (?, ?, ?, ?) ON CONFLICT (path) DO NOTHING", [
              key,
              mime,
              body.length,
              body,
            ]);
          }
        }
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

type StorageObject = { name: string; id?: string };

async function listSupabaseStorage(prefix: string): Promise<string[]> {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "line-media";
  if (!base || !key) return [];
  const keys: string[] = [];
  const queue = [prefix];
  while (queue.length) {
    const folder = queue.pop()!;
    const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0 }),
    });
    if (!res.ok) throw new Error(`Supabase storage list failed: ${res.status}`);
    const items = (await res.json()) as StorageObject[];
    for (const item of items) {
      if (!item.name) continue;
      const full = folder ? `${folder}/${item.name}` : item.name;
      if (item.id) keys.push(full);
      else queue.push(full);
    }
  }
  return keys;
}

async function downloadSupabaseObject(key: string): Promise<ArrayBuffer> {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "line-media";
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
    headers: { Authorization: `Bearer ${token}`, apikey: token },
  });
  if (!res.ok) throw new Error(`Download ${key}: ${res.status}`);
  return res.arrayBuffer();
}

async function putR2(key: string, body: ArrayBuffer, mime: string, write: boolean) {
  const account = process.env.R2_ACCOUNT_ID || "";
  const access = process.env.R2_ACCESS_KEY_ID || "";
  const secret = process.env.R2_SECRET_ACCESS_KEY || "";
  const bucket = process.env.R2_BUCKET || "line-media";
  const size = body.byteLength;
  console.log(`storage: ${write ? "copy" : "would copy"} ${key} (${size} bytes) → ${account && access && secret ? `R2 ${bucket}` : "media_objects"}`);
  if (!write) return;
  if (account && access && secret) {
    const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: access, secretAccessKey: secret },
    });
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(body), ContentType: mime }),
    );
    return;
  }
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    await new Db(sql).run(
      "INSERT INTO media_objects (path, mime, size, body) VALUES (?, ?, ?, ?) ON CONFLICT (path) DO UPDATE SET mime = EXCLUDED.mime, size = EXCLUDED.size, body = EXCLUDED.body",
      [key, mime, size, Buffer.from(body)],
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function copyStorage(write: boolean) {
  if (!process.argv.includes("--storage")) return;
  const keys = await listSupabaseStorage("");
  if (!keys.length) {
    console.log("storage: no objects listed (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or skip --storage)");
    return;
  }
  console.log(`storage: ${write ? "copy" : "would copy"} ${keys.length} object(s)`);
  for (const key of keys) {
    const mime = MIME[key.split(".").pop() ?? ""] ?? "application/octet-stream";
    if (!write) {
      await putR2(key, new ArrayBuffer(0), mime, false);
      continue;
    }
    const body = await downloadSupabaseObject(key);
    await putR2(key, body, mime, true);
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const jsonFile = process.argv.find((arg, i) => i >= 2 && !arg.startsWith("-") && arg.endsWith(".json"));
  const mediaAt = process.argv.indexOf("--media-dir");
  const mediaDir = mediaAt > 0 ? process.argv[mediaAt + 1] : null;

  if (sourceDatabaseUrl()) {
    await copyFromPostgres(write);
    await copyStorage(write);
  } else if (jsonFile && fs.existsSync(jsonFile)) {
    await copyFromJson(jsonFile, mediaDir, write);
  } else {
    throw new Error(
      "Set SOURCE_DATABASE_URL for live Postgres copy, or: npm run db:import -- dump.json [--media-dir dir] [--storage] [--write]",
    );
  }
  if (!write) console.log("Dry run. Add --write to copy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
