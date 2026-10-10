"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { deletePostAction } from "@/app/actions";
import { cn } from "@/lib/utils";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="confirm-delete"
      className="press h-12 flex-1 rounded-full bg-heart text-[15px] font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

/** The ⋯ menu on a post: Report for everyone, Delete (with a confirmation) for the author. */
export function PostMenu({ postId, own, returnTo, className }: { postId: number; own: boolean; returnTo?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setConfirm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  return (
    <div ref={wrap} className={cn("relative -mr-2 shrink-0", className)}>
      <button
        type="button"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="post-menu"
        onClick={() => setOpen((value) => !value)}
        className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="animate-rise absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-line/60 bg-surface p-1.5 shadow-e2">
          {own ? (
            <button
              type="button"
              role="menuitem"
              data-testid="delete-post"
              onClick={() => {
                setOpen(false);
                setConfirm(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-heart hover:bg-surface-2"
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden /> Delete post
            </button>
          ) : null}
          <Link
            role="menuitem"
            href={`/post/${postId}#report`}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold text-ink hover:bg-surface-2"
          >
            <Flag className="h-[18px] w-[18px] text-ink-3" aria-hidden /> Report post
          </Link>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center" role="presentation" onClick={() => setConfirm(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${postId}`}
            data-testid="delete-dialog"
            onClick={(event) => event.stopPropagation()}
            className="animate-rise safe-bottom w-full max-w-sm rounded-t-[28px] bg-surface p-6 shadow-e2 sm:rounded-[28px]"
          >
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-heart/10 text-heart">
              <Trash2 className="h-7 w-7" aria-hidden />
            </span>
            <h2 id={`delete-title-${postId}`} className="text-center font-display text-[22px] font-bold tracking-tight text-ink">
              Delete this post?
            </h2>
            <p className="mt-2 text-center text-[14.5px] leading-relaxed text-ink-2">
              It disappears for everyone you shared it with, along with its shares, comments, reactions and photos or video. This can’t be undone.
            </p>
            <form action={deletePostAction} className="mt-6 flex gap-3">
              <input type="hidden" name="postId" value={postId} />
              <input type="hidden" name="returnTo" value={returnTo ?? "/timeline"} />
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="press h-12 flex-1 rounded-full bg-surface-2 text-[15px] font-semibold text-ink"
              >
                Cancel
              </button>
              <DeleteButton />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
