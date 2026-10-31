import "server-only";
import { randomUUID } from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { signUploadTicket } from "./auth";
import { getDb } from "./db";
import { extensionFor, IMAGE_TYPES, MAX_UPLOAD_BYTES, VIDEO_TYPES } from "./media-rules";
import type { Frame } from "./types";

/**
 * LINE media: Cloudflare R2 (binding MEDIA, bucket line-media), one bucket, two prefixes.
 * - u/<user id>/…  private post media. Served only by /media/[postId]/[index] after lib/access.ts passes.
 * - p/<user id>/…  public profile and cover photos, served by /pm/….
 * The bucket is never public. Uploads go browser → /api/upload with a 15-minute ticket the server
 * signs for the signed-in author's own folder, then the post form submits only the paths.
 *
 * If no R2 bucket is bound (R2 not enabled on the account yet), the same calls store the bytes in
 * Postgres (media_objects). Same rules, same routes; meant for previews and small tests.
 */

type Stored = { body: BodyInit; mime: string; size: number };

type R2Like = {
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
};

function r2(): R2Like | null {
  try {
    const env = getCloudflareContext().env as unknown as { MEDIA?: R2Like };
    return env.MEDIA ?? null;
  } catch {
    return null;
  }
}

export function storageBackend() {
  return r2() ? "r2" : "postgres";
}

async function putObject(path: string, body: ArrayBuffer | Uint8Array, mime: string) {
  const bucket = r2();
  if (bucket) {
    await bucket.put(path, body, { httpMetadata: { contentType: mime } });
    return;
  }
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  await getDb().run(
    "INSERT INTO media_objects (path, mime, size, body) VALUES (?, ?, ?, ?) ON CONFLICT (path) DO UPDATE SET mime = EXCLUDED.mime, size = EXCLUDED.size, body = EXCLUDED.body",
    [path, mime, bytes.byteLength, Buffer.from(bytes)],
  );
}

async function headObject(path: string): Promise<{ mime: string; size: number } | null> {
  const bucket = r2();
  if (bucket) {
    const head = await bucket.head(path);
    return head ? { mime: head.httpMetadata?.contentType ?? "", size: head.size } : null;
  }
  const row = (await getDb().get("SELECT mime, size FROM media_objects WHERE path = ?", [path])) as { mime: string; size: number } | undefined;
  return row ?? null;
}

export async function getObject(path: string): Promise<Stored | null> {
  const bucket = r2();
  if (bucket) {
    const obj = await bucket.get(path);
    return obj ? { body: obj.body, mime: obj.httpMetadata?.contentType ?? "application/octet-stream", size: obj.size } : null;
  }
  const row = (await getDb().get("SELECT mime, size, body FROM media_objects WHERE path = ?", [path])) as
    | { mime: string; size: number; body: Uint8Array }
    | undefined;
  return row ? { body: new Uint8Array(row.body) as unknown as BodyInit, mime: row.mime, size: row.size } : null;
}

async function deleteObjects(paths: string[]) {
  if (!paths.length) return;
  const bucket = r2();
  if (bucket) {
    await bucket.delete(paths);
    return;
  }
  await getDb().run("DELETE FROM media_objects WHERE path = ANY(?::text[])", [paths]);
}

export type UploadRequest = { type: string; size: number };
export type UploadTarget = { path: string; token: string; mime: string };

export async function createUploadTargets(userId: number, kind: string, files: UploadRequest[]): Promise<UploadTarget[]> {
  const images = kind === "photo";
  const videos = kind === "video" || kind === "reel";
  if (!images && !videos) throw new Error("Text posts don’t take files.");
  if (!files.length) throw new Error("Pick a file.");
  if (images && files.length > 6) throw new Error("Up to 6 photos per post.");
  if (videos && files.length > 1) throw new Error("One video per post.");
  const allowed = images ? IMAGE_TYPES : VIDEO_TYPES;
  const targets: UploadTarget[] = [];
  for (const file of files) {
    if (!allowed.includes(file.type)) {
      throw new Error(images ? "Photos must be JPEG, PNG, WebP or GIF." : "Videos must be MP4, WebM or MOV.");
    }
    if (!(file.size > 0) || file.size > MAX_UPLOAD_BYTES) throw new Error("Files can be up to 50 MB.");
    const path = `u/${userId}/${randomUUID()}.${extensionFor(file.type)}`;
    const token = await signUploadTicket({ path, mime: file.type, size: file.size, uid: userId });
    targets.push({ path, token, mime: file.type });
  }
  return targets;
}

/** Stores one ticketed upload. The caller already checked the ticket and that it belongs to the signed-in user. */
export async function storeUpload(path: string, mime: string, body: ArrayBuffer) {
  if (!(body.byteLength > 0) || body.byteLength > MAX_UPLOAD_BYTES) throw new Error("Files can be up to 50 MB.");
  await putObject(path, body, mime);
}

/** Confirms each upload exists in the author's folder and takes the stored content type. */
export async function confirmUploads(userId: number, frames: Frame[]): Promise<Frame[]> {
  const confirmed: Frame[] = [];
  for (const frame of frames) {
    if (!frame.path.startsWith(`u/${userId}/`) || frame.path.includes("..")) throw new Error("That upload doesn’t belong to you.");
    const info = await headObject(frame.path);
    if (!info) throw new Error("An upload didn’t finish. Try adding it again.");
    const mime = String(info.mime || frame.mime);
    if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(mime)) throw new Error("That file type isn’t supported.");
    confirmed.push({ path: frame.path, mime });
  }
  return confirmed;
}

export async function removeMedia(paths: string[]) {
  await deleteObjects(paths);
}

// ── Profile and cover photos: public profile info ─────────────
const PROFILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PROFILE_BYTES = 8 * 1024 * 1024;

export async function uploadProfileImage(userId: number, which: "avatar" | "cover", file: File) {
  if (!PROFILE_TYPES.includes(file.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_PROFILE_BYTES) throw new Error("Photos can be up to 8 MB.");
  const path = `p/${userId}/${which}-${randomUUID()}.${extensionFor(file.type)}`;
  try {
    await putObject(path, await file.arrayBuffer(), file.type);
  } catch {
    throw new Error("That photo didn’t upload. Try again.");
  }
  return path;
}

export async function removeProfileImage(path: string | null) {
  if (!path || !path.startsWith("p/")) return;
  await deleteObjects([path]);
}
