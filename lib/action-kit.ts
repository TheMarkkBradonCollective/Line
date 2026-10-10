import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { User } from "./types";

/** Shared helpers for server action files. */
export function withQuery(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

export function safePath(value: FormDataEntryValue | null | undefined, fallback: string) {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

function isNextRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

export async function run(returnPath: string, fn: (user: User) => void | Promise<void>) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.suspended) redirect(withQuery("/", "error", "This account is suspended."));
  try {
    await fn(user);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(withQuery(returnPath, "error", error instanceof Error ? error.message : "Something went wrong."));
  }
}

/** For actions called from client components: returns { ok, error } instead of redirecting. */
export async function attempt<T>(fn: (user: User) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.suspended) return { ok: false, error: "Sign in again." };
  try {
    return { ok: true, value: await fn(user) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export function ids(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}
