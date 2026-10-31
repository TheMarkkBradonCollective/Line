import "server-only";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { Db } from "./db";

/**
 * LINE's own accounts (replaces Supabase Auth).
 * - auth.users holds email + bcrypt hash. Hashes copied from Supabase ($2a$/$2b$) verify as-is.
 * - A signed-in browser carries one httpOnly cookie: a JWT (HS256, AUTH_SECRET) with the account id.
 * Access decisions still happen on the server pages and routes (lib/access.ts).
 */

export const SESSION_COOKIE = "line_session";
const SESSION_DAYS = 30;

export type AuthAccount = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

function secret() {
  const value = process.env.AUTH_SECRET || "";
  if (value.length < 32) throw new Error("AUTH_SECRET is not set (32+ random characters).");
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function findAccountByEmail(db: Db, email: string): Promise<AuthAccount | null> {
  return ((await db.get(
    "SELECT id::text AS id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE lower(email) = lower(?)",
    [email],
  )) ?? null) as AuthAccount | null;
}

export async function findAccountById(db: Db, id: string): Promise<AuthAccount | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return ((await db.get(
    "SELECT id::text AS id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE id = ?::uuid",
    [id],
  )) ?? null) as AuthAccount | null;
}

/** Returns the account when the password matches, else null. Always runs one bcrypt compare. */
export async function verifyLogin(db: Db, email: string, password: string) {
  const account = await findAccountByEmail(db, email);
  const hash = account?.encrypted_password || "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
  const ok = await bcrypt.compare(password, hash).catch(() => false);
  return ok && account ? account : null;
}

export async function createAccount(db: Db, email: string, password: string, meta: Record<string, unknown>) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
     VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?, ?)`,
    [id, email, await hashPassword(password), now, JSON.stringify(meta), now, now],
  );
  return id;
}

export async function setPassword(db: Db, id: string, password: string) {
  await db.run("UPDATE auth.users SET encrypted_password = ?, updated_at = now() WHERE id = ?::uuid", [await hashPassword(password), id]);
}

export async function deleteAccount(db: Db, id: string) {
  await db.run("DELETE FROM auth.users WHERE id = ?::uuid", [id]);
}

export async function startSession(accountId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The account id in this request's session cookie, or null. */
export async function sessionAccountId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Short-lived signed upload ticket: lets the signed-in author PUT one file to one path. */
export async function signUploadTicket(claims: { path: string; mime: string; size: number; uid: number }) {
  return new SignJWT({ ...claims, kind: "upload" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").sign(secret());
}

export async function readUploadTicket(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.kind !== "upload") return null;
    return payload as unknown as { path: string; mime: string; size: number; uid: number };
  } catch {
    return null;
  }
}
