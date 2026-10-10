import "server-only";
import { cache } from "react";
import postgres from "postgres";

/**
 * Postgres access for LINE. Server only.
 *
 * One small connection pool per server instance (one per Vercel function instance),
 * pointed at the Supabase pooler. Queries are written with `?` placeholders and run
 * through Db, which also memoizes a few lookups for the length of one request.
 * Nothing here is ever imported by a client component.
 */

export type Sql = postgres.Sql<Record<string, unknown>>;
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
      "DATABASE_URL is not set to a Postgres connection string. Use the Supabase transaction pooler URI (Connect → Transaction pooler).",
    );
  }
  return url;
}

const isPostgresUrl = (value: string | undefined): value is string => Boolean(value && /^postgres(ql)?:\/\//.test(value));

/** Scripts (migrations, make-founder, reset) prefer the session pooler URI in SUPABASE_DB_URL. */
export function scriptDatabaseUrl() {
  if (isPostgresUrl(process.env.SUPABASE_DB_URL)) return process.env.SUPABASE_DB_URL;
  if (isPostgresUrl(process.env.DATABASE_URL)) return process.env.DATABASE_URL;
  throw new Error("Set SUPABASE_DB_URL (session pooler URI) or DATABASE_URL to a postgres:// connection string.");
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

export function createSql(options: SqlOptions = {}): Sql {
  const url = options.url ?? databaseUrl();
  const schema = options.schema ?? process.env.DATABASE_SCHEMA;
  return postgres(url, {
    // Serverless: few connections per instance, closed quickly when idle.
    max: options.max ?? Number(process.env.DATABASE_POOL_MAX || 3),
    idle_timeout: 15,
    max_lifetime: 60 * 10,
    connect_timeout: 15,
    // The Supabase transaction pooler (port 6543) does not keep prepared statements.
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

  async all(query: string, params: Param[] = []): Promise<any[]> {
    return (await this.sql.unsafe(toPg(query), clean(params))) as unknown as unknown[];
  }

  async get(query: string, params: Param[] = []): Promise<any> {
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
export const getDb = cache(() => new Db(sharedSql()));
