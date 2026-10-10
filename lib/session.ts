import "server-only";
import { cache } from "react";
import { getDb, type Db } from "./db";
import { supabaseServer } from "./supabase/server";
import { AVATAR_COLORS, getUserByAuthId } from "./social";
import type { User } from "./types";

export type AuthIdentity = { id: string; email: string | null; meta: Record<string, unknown> };

/** The Supabase Auth account behind this request, verified on the server. */
export const getAuthIdentity = cache(async (): Promise<AuthIdentity | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; user_metadata?: Record<string, unknown> };
  return { id: claims.sub, email: claims.email ?? null, meta: claims.user_metadata ?? {} };
});

/** The LINE profile of the signed-in person. Created on first sign-in from the sign-up details. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const identity = await getAuthIdentity();
  if (!identity) return null;
  return ensureProfile(getDb(), identity);
});

export function cleanUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
}

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

export async function ensureProfile(db: Db, identity: AuthIdentity): Promise<User> {
  const existing = await getUserByAuthId(db, identity.id);
  if (existing) return existing;
  const emailName = (identity.email ?? "").split("@")[0] ?? "";
  const displayName = String(identity.meta.display_name || emailName || "New member").trim().slice(0, 80);
  let base = cleanUsername(String(identity.meta.username || emailName || "member"));
  if (base.length < 3) base = `${base}member`.slice(0, 24);
  let username = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const taken = await db.get("SELECT 1 AS ok FROM profiles WHERE username = ?", [username]);
    if (!taken) break;
    username = `${base.slice(0, 20)}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const color = AVATAR_COLORS[Math.abs(hash(identity.id)) % AVATAR_COLORS.length];
  await db.run(
    `INSERT INTO profiles (auth_id, username, display_name, avatar_color, initials, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (auth_id) DO NOTHING`,
    [identity.id, username, displayName, color, initialsOf(displayName), new Date().toISOString()],
  );
  const created = await getUserByAuthId(db, identity.id);
  if (!created) throw new Error("Could not set up your profile.");
  return created;
}

function hash(text: string) {
  let value = 0;
  for (const ch of text) value = (value * 31 + ch.charCodeAt(0)) | 0;
  return value;
}
