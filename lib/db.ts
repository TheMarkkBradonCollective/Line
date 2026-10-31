import "server-only";
import { cache } from "react";
import { neonConfig, Pool } from "@neondatabase/serverless";
import postgres from "postgres";

/**
 * Postgres access for LINE. Server only.
 *
 * Neon (@neondatabase/serverless) for remote databases; postgres.js for local Postgres
 * (embedded DB in core-rule tests). On Cloudflare Workers each request opens its own pool
 * connection. Queries use `?` placeholders via Db, with per-request memoization.
 * Nothing here is ever imported by a client component.
 */

export type Sql = {
  unsafe(query: string, params?: unknown[]): Promise<unknown[] & { count: number }>;
  begin<T>(work: (inner: Sql) => Promise<T>): Promise<T>;
  end(options?: { timeout?: number }): Promise<void>;
};
type Param = string | number | boolean | null | undefined | Date | object;

export type SqlOptions = {
  url?: string;
  /** Run against a schema other than public. The core-rule test uses a throwaway schema. */
  schema?: string;
  max?: number;
};

export function databaseUrl() {
  const url = process.env.DATABASE_URL || "";
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL is not set to a Postgres connection string. Use the Neon pooled connection string.",
    );
  }
  return url;
}

const isPostgresUrl = (value: string | undefined): value is string => Boolean(value && /^postgres(ql)?:\/\//.test(value));

/** Scripts (migrations, make-founder, reset) prefer the direct (non-pooled) URI in DIRECT_DATABASE_URL. */
export function scriptDatabaseUrl() {
  if (isPostgresUrl(process.env.DIRECT_DATABASE_URL)) return process.env.DIRECT_DATABASE_URL;
  if (isPostgresUrl(process.env.DATABASE_URL)) return process.env.DATABASE_URL;
  throw new Error("Set DIRECT_DATABASE_URL (Neon direct URI) or DATABASE_URL to a postgres:// connection string.");
}

function isLocal(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const INT8 = 20;
const TIMESTAMP = 1114;
const TIMESTAMPTZ = 1184;

/** postgres.js passes unknown URL params to the server; Neon's channel_binding isn't a server setting. */
function stripUrl(raw: string) {
  try {
    const url = new URL(raw);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return raw;
  }
}

/** Cloudflare Workers can't reuse a socket across requests, so each request opens its own. */
export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function neonRows<T extends Record<string, unknown>>(rows: T[], rowCount: number | null) {
  const list = rows as unknown[] & { count: number };
  list.count = rowCount ?? rows.length;
  return list as unknown[] & { count: number };
}

function createNeonSql(url: string, max: number, schema?: string): Sql {
  if (onWorkers) neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 15_000,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
  const unsafe = async (query: string, params: unknown[] = []) => {
    const result = await pool.query(query, params);
    return neonRows(result.rows as Record<string, unknown>[], result.rowCount);
  };
  return {
    unsafe,
    async begin<T>(work: (inner: Sql) => Promise<T>) {
      const client = await pool.connect();
      const innerUnsafe = async (query: string, params: unknown[] = []) => {
        const result = await client.query(query, params);
        return neonRows(result.rows as Record<string, unknown>[], result.rowCount);
      };
      const inner = { unsafe: innerUnsafe, begin: async (fn) => fn(inner), end: async () => {} } as Sql;
      try {
        await client.query("BEGIN");
        const out = await work(inner);
        await client.query("COMMIT");
        return out;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

export function createSql(options: SqlOptions = {}): Sql {
  const url = stripUrl(options.url ?? databaseUrl());
  const schema = options.schema ?? process.env.DATABASE_SCHEMA;
  const max = options.max ?? Number(process.env.DATABASE_POOL_MAX || 3);
  if (!isLocal(url)) return createNeonSql(url, max, schema);
  return postgres(url, {
    // Serverless: few connections per instance, closed quickly when idle.
    max,
    idle_timeout: 15,
    max_lifetime: 60 * 10,
    connect_timeout: 15,
    // Neon's pooler (PgBouncer, transaction mode) does not keep prepared statements.
    prepare: false,
    ssl: isLocal(url) ? false : "require",
    onnotice: () => {},
    connection: {
      TimeZone: "UTC",
      application_name: "line",
      ...(schema ? { search_path: schema } : {}),
    },
    types: {
      // COUNT(*) and friends come back as int8. Every LINE count fits in a JS number.
      count: { to: INT8, from: [INT8], serialize: (value: number) => String(value), parse: (value: string) => Number(value) },
      // Timestamps travel as ISO strings, the same shape the app always used.
      time: {
        to: TIMESTAMPTZ,
        from: [TIMESTAMPTZ, TIMESTAMP],
        serialize: (value: string | Date) => (value instanceof Date ? value.toISOString() : value),
        parse: (value: string) => new Date(value.includes("T") || /[+-]\d\d(:?\d\d)?$/.test(value) ? value : `${value}Z`).toISOString(),
      },
    },
  }) as unknown as Sql;
}

/** `?` placeholders become `$1, $2…`. Quoted text is left alone. */
const converted = new Map<string, string>();
export function toPg(query: string) {
  const hit = converted.get(query);
  if (hit) return hit;
  let out = "";
  let n = 0;
  let quote: string | null = null;
  for (const ch of query) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "?") {
      out += `$${++n}`;
    } else {
      out += ch;
    }
  }
  converted.set(query, out);
  return out;
}

function clean(params: Param[]) {
  return params.map((value) => (value === undefined ? null : value)) as postgres.ParameterOrJSON<never>[];
}

export class Db {
  /** Per-request memo for read lookups. Any write clears it. */
  readonly memoized = new Map<string, Promise<unknown>>();

  constructor(
    private readonly sql: Sql,
    private readonly inTransaction = false,
  ) {}

  async all(query: string, params: Param[] = []): Promise<unknown[]> {
    return (await this.sql.unsafe(toPg(query), clean(params))) as unknown as unknown[];
  }

  async get(query: string, params: Param[] = []): Promise<unknown> {
    const rows = await this.all(query, params);
    return rows[0];
  }

  async run(query: string, params: Param[] = []) {
    this.memoized.clear();
    const result = await this.sql.unsafe(toPg(query), clean(params));
    return { count: result.count };
  }

  /** INSERT … RETURNING id. */
  async insert(query: string, params: Param[] = []): Promise<number> {
    this.memoized.clear();
    const rows = (await this.sql.unsafe(`${toPg(query)} RETURNING id`, clean(params))) as unknown as { id: number }[];
    return rows[0].id;
  }

  /** Raw multi-statement SQL, no parameters. Used by migrations. */
  async exec(text: string) {
    this.memoized.clear();
    await this.sql.unsafe(text);
  }

  async tx<T>(work: (db: Db) => Promise<T>): Promise<T> {
    if (this.inTransaction) return work(this);
    this.memoized.clear();
    try {
      return (await this.sql.begin((inner) => work(new Db(inner as unknown as Sql, true)))) as T;
    } finally {
      this.memoized.clear();
    }
  }

  memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.memoized.get(key);
    if (hit) return hit as Promise<T>;
    const pending = load().catch((error) => {
      this.memoized.delete(key);
      throw error;
    });
    this.memoized.set(key, pending);
    return pending;
  }
}

const globalForDb = globalThis as unknown as { lineSql?: Sql };

function sharedSql() {
  if (!globalForDb.lineSql) globalForDb.lineSql = createSql();
  return globalForDb.lineSql;
}

/** The request's Db. React's cache() gives each server request its own memo. */
export const getDb = cache(() => new Db(onWorkers ? createSql({ max: 1 }) : sharedSql()));
