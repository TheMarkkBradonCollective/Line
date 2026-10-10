"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { EyeOff, ThumbsDown, Undo2 } from "lucide-react";
import { dislikeAction, hideAuthorAction, undoDislikeAction, unhideAuthorAction } from "@/app/actions";

/**
 * Private Dislike. Hides the card right away and shows a toast with Undo and
 * "Hide all posts from <name>". No counts anywhere; the author is never told.
 */
export function DislikeButton({ postId, authorId, authorName }: { postId: number; authorId: number; authorName: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<null | "post" | "author">(null);
  const [, start] = useTransition();
  const first = authorName.split(" ")[0];

  function card() {
    return ref.current?.closest("article") as HTMLElement | null;
  }
  function hideCards(selector: string) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.style.display = "none"));
  }
  function showCards(selector: string) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.style.display = ""));
  }

  function dislike() {
    const el = card();
    if (el) el.style.display = "none";
    setToast("post");
    start(async () => {
      const result = await dislikeAction(postId);
      if (!result.ok) {
        if (el) el.style.display = "";
        setToast(null);
      }
    });
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={dislike}
        aria-label="Dislike — hide this post"
        title="Dislike — hide this post"
        data-testid="dislike-button"
        className="press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <ThumbsDown className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
      </button>
      {toast && typeof document !== "undefined"
        ? createPortal(
            <div
              role="status"
              data-testid="dislike-toast"
              className="animate-rise fixed inset-x-3 bottom-[calc(var(--tabbar-h,60px)+24px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl bg-ink p-3 text-[rgb(var(--surface))] shadow-e3 md:bottom-6"
            >
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                <p className="min-w-0 flex-1 text-[14px] font-semibold">
                  {toast === "post" ? "Post hidden. You won’t see it in Home or Discover." : `Hiding all posts from ${first}.`}
                </p>
                <button
                  type="button"
                  className="press inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold"
                  onClick={() => {
                    const was = toast;
                    setToast(null);
                    start(async () => {
                      if (was === "author") {
                        await unhideAuthorAction(authorId);
                        showCards(`[data-author="${authorId}"]`);
                      }
                      await undoDislikeAction(postId);
                      const el = card();
                      if (el) el.style.display = "";
                    });
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
                </button>
                <button type="button" aria-label="Dismiss" className="px-1 text-lg leading-none opacity-70" onClick={() => setToast(null)}>
                  ×
                </button>
              </div>
              {toast === "post" ? (
                <button
                  type="button"
                  data-testid="hide-author"
                  onClick={() => {
                    setToast("author");
                    hideCards(`[data-author="${authorId}"]`);
                    start(async () => {
                      await hideAuthorAction(authorId);
                    });
                  }}
                  className="press mt-2 w-full rounded-xl bg-white/10 px-3 py-2 text-left text-[13.5px] font-semibold hover:bg-white/15"
                >
                  Hide all posts from {authorName}
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
