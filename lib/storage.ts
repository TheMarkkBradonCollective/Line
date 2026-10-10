import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase/admin";
import { extensionFor, IMAGE_TYPES, MAX_UPLOAD_BYTES, MEDIA_BUCKET, VIDEO_TYPES } from "./media-rules";
import type { Frame } from "./types";

/**
 * Private media in Supabase Storage. The bucket has no public access and no storage policies.
 * - Uploads: the server hands the signed-in author one-time signed upload URLs inside u/<their id>/.
 * - Reads: the media route runs the access check first, then redirects to a signed URL that expires quickly.
 */

const SIGNED_URL_SECONDS = 60 * 10;

function bucket() {
  return supabaseAdmin().storage.from(MEDIA_BUCKET);
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
    const { data, error } = await bucket().createSignedUploadUrl(path);
    if (error || !data) throw new Error("Uploads are unavailable right now.");
    targets.push({ path: data.path, token: data.token, mime: file.type });
  }
  return targets;
}

/** Confirms each upload exists in the author's folder and takes the stored content type. */
export async function confirmUploads(userId: number, frames: Frame[]): Promise<Frame[]> {
  const confirmed: Frame[] = [];
  for (const frame of frames) {
    if (!frame.path.startsWith(`u/${userId}/`) || frame.path.includes("..")) throw new Error("That upload doesn’t belong to you.");
    const { data, error } = await bucket().info(frame.path);
    if (error || !data) throw new Error("An upload didn’t finish. Try adding it again.");
    const mime = String(data.contentType || frame.mime);
    if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(mime)) throw new Error("That file type isn’t supported.");
    confirmed.push({ path: frame.path, mime });
  }
  return confirmed;
}

/** Only call after the access check passed. */
export async function signedMediaUrl(path: string) {
  const { data, error } = await bucket().createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeMedia(paths: string[]) {
  if (paths.length) await bucket().remove(paths);
}

/** Creates the private bucket if the storage migration hasn't. Safe to run again. */
export async function ensureMediaBucket() {
  const admin = supabaseAdmin();
  const { data } = await admin.storage.getBucket(MEDIA_BUCKET);
  const options = {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
  };
  if (data) {
    const { error } = await admin.storage.updateBucket(MEDIA_BUCKET, options);
    if (error) throw error;
    return "updated";
  }
  const { error } = await admin.storage.createBucket(MEDIA_BUCKET, options);
  if (error) throw error;
  return "created";
}
