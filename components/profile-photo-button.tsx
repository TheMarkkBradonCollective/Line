"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { profileImageAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * Change or remove the profile or cover photo. Picking a file uploads it right away.
 * Profile photos are center-cropped to a square in the browser before upload; covers are shown centered with object-cover.
 */
export function ProfilePhotoButton({ which, hasPhoto, className }: { which: "avatar" | "cover"; hasPhoto: boolean; className?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function squareCrop(file: File): Promise<File> {
    if (which !== "avatar" || file.type === "image/gif") return file;
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const size = Math.min(side, 800);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
    } catch {
      return file;
    }
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !form.current) return;
    setBusy(true);
    const data = new FormData(form.current);
    data.set("file", await squareCrop(file));
    await profileImageAction(data);
  }

  const label = which === "avatar" ? "profile photo" : "cover photo";
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={`Change ${label}`}
        data-testid={`change-${which}`}
        onClick={() => (hasPhoto ? setOpen((v) => !v) : input.current?.click())}
        className={cn(
          "press flex items-center justify-center gap-1.5 font-semibold shadow-e2",
          which === "avatar"
            ? "h-9 w-9 rounded-full bg-surface-2 text-ink ring-4 ring-[rgb(var(--surface))]"
            : "h-9 rounded-full bg-black/45 px-3.5 text-[13px] text-white backdrop-blur hover:bg-black/60",
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
        {which === "cover" ? <span>{hasPhoto ? "Edit cover" : "Add cover"}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-2xl border border-line/60 bg-surface p-1.5 text-ink shadow-e2">
          <button type="button" onClick={() => { setOpen(false); input.current?.click(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold hover:bg-surface-2">
            <Camera className="h-4 w-4" aria-hidden /> Upload new
          </button>
          <form action={profileImageAction}>
            <input type="hidden" name="which" value={which} />
            <input type="hidden" name="remove" value="1" />
            <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-heart hover:bg-surface-2">
              <Trash2 className="h-4 w-4" aria-hidden /> Remove
            </button>
          </form>
        </div>
      ) : null}
      <form ref={form} className="hidden">
        <input type="hidden" name="which" value={which} />
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} aria-label={`Upload ${label}`} />
      </form>
    </div>
  );
}
