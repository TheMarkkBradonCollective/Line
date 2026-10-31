"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Video } from "lucide-react";
import { prepareUploadsAction } from "@/app/actions";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, VIDEO_TYPES } from "@/lib/media-rules";
import { cn } from "@/lib/utils";

type Item = { key: string; name: string; mime: string; preview: string; path: string | null; state: "uploading" | "done" | "error"; message?: string };

/** Sends one file to /api/upload with the server-signed ticket. */
async function uploadWithTicket(token: string, file: File): Promise<{ error?: { message: string } }> {
  try {
    const res = await fetch(`/api/upload?ticket=${encodeURIComponent(token)}`, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (res.ok) return {};
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: { message: data.error || "Upload failed." } };
  } catch {
    return { error: { message: "Upload failed." } };
  }
}

/**
 * Photo and video picker for Create. Each file goes from the browser to /api/upload with a
 * one-file ticket the server signed, and lands in the private R2 bucket.
 * The form then submits only the storage paths, and the server confirms them.
 */
export function MediaUploader({ initialKind }: { initialKind: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState(initialKind);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = items.some((item) => item.state === "uploading");
  const photo = kind === "photo";
  const video = kind === "video" || kind === "reel";

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.name === "kind") {
        setKind(target.value);
        setItems([]);
        setError(null);
      }
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const onSubmit = (event: Event) => {
      if (busy) {
        event.preventDefault();
        setError("Wait for uploads to finish.");
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [busy]);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const files = Array.from(list).slice(0, photo ? 6 - items.length : 1);
    const allowed = photo ? IMAGE_TYPES : VIDEO_TYPES;
    const bad = files.find((file) => !allowed.includes(file.type) || file.size > MAX_UPLOAD_BYTES);
    if (bad) {
      setError(bad.size > MAX_UPLOAD_BYTES ? "Files can be up to 50 MB." : photo ? "Photos must be JPEG, PNG, WebP or GIF." : "Videos must be MP4, WebM or MOV.");
      return;
    }
    if (!files.length) {
      setError("Up to 6 photos per post.");
      return;
    }
    const fresh: Item[] = files.map((file, index) => ({
      key: `${Date.now()}-${index}`,
      name: file.name,
      mime: file.type,
      preview: URL.createObjectURL(file),
      path: null,
      state: "uploading",
    }));
    setItems((current) => (video ? fresh : [...current, ...fresh]));
    const result = await prepareUploadsAction(
      kind,
      files.map((file) => ({ type: file.type, size: file.size })),
    );
    if ("error" in result) {
      setError(result.error);
      setItems((current) => current.filter((item) => !fresh.some((added) => added.key === item.key)));
      return;
    }
    await Promise.all(
      files.map(async (file, index) => {
        const target = result.targets[index];
        const { error: uploadError } = await uploadWithTicket(target.token, file);
        setItems((current) =>
          current.map((item) =>
            item.key === fresh[index].key
              ? { ...item, path: uploadError ? null : target.path, state: uploadError ? "error" : "done", message: uploadError?.message }
              : item,
          ),
        );
      }),
    );
  }

  if (!photo && !video) return <div ref={root} hidden />;

  return (
    <div ref={root} data-testid="uploader">
      {items
        .filter((item) => item.state === "done" && item.path)
        .map((item) => (
          <input key={item.key} type="hidden" name="upload" value={JSON.stringify({ path: item.path, mime: item.mime })} />
        ))}
      <div className="no-scrollbar relative -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <figure key={item.key} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface-3">
            {item.mime.startsWith("video/") ? (
              <video src={item.preview} muted playsInline className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.preview} alt={item.name} className="h-full w-full object-cover" />
            )}
            {item.state === "uploading" ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <span className="sr-only">Uploading {item.name}</span>
              </span>
            ) : null}
            {item.state === "error" ? (
              <span className="absolute inset-x-0 bottom-0 bg-heart px-1.5 py-1 text-[10.5px] font-semibold text-white">Upload failed</span>
            ) : null}
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
              className="press absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </figure>
        ))}
        {(photo && items.length < 6) || (video && items.length === 0) ? (
          <label
            className={cn(
              "press flex h-28 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line text-center text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand-strong",
            )}
          >
            {photo ? <ImagePlus className="h-6 w-6" aria-hidden /> : <Video className="h-6 w-6" aria-hidden />}
            {photo ? (items.length ? "Add more" : "Add photos") : "Add video"}
            <input
              type="file"
              className="sr-only"
              accept={(photo ? IMAGE_TYPES : VIDEO_TYPES).join(",")}
              multiple={photo}
              onChange={(event) => {
                void pick(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">
        {photo ? "Up to 6 photos, 50 MB each." : kind === "reel" ? "One vertical video, up to 50 MB." : "One video, up to 50 MB."} Files stay private: only people you share the post with can open them.
      </p>
      {error ? (
        <p className="mt-2 text-[13px] font-semibold text-heart" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
