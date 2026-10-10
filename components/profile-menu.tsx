"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, EyeOff, Eye, Flag, MoreHorizontal } from "lucide-react";
import { blockAction, hideAuthorAction, unhideAuthorAction } from "@/app/actions";

/** ⋯ on someone else's profile: hide their posts, report, block. */
export function ProfileMenu({ userId, username, name, blocked, hidden }: { userId: number; username: string; name: string; blocked: boolean; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [isHidden, setHidden] = useState(hidden);
  const [, start] = useTransition();
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const first = name.split(" ")[0];
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold hover:bg-surface-2";
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="profile-menu"
        onClick={() => setOpen((v) => !v)}
        className="press inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink hover:bg-surface-3"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="animate-rise absolute right-0 top-12 z-30 w-64 rounded-2xl border border-line/60 bg-surface p-1.5 text-ink shadow-e2">
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              const next = !isHidden;
              setHidden(next);
              start(async () => {
                await (next ? hideAuthorAction(userId) : unhideAuthorAction(userId));
                router.refresh();
              });
            }}
          >
            {isHidden ? <Eye className="h-[18px] w-[18px] text-ink-3" aria-hidden /> : <EyeOff className="h-[18px] w-[18px] text-ink-3" aria-hidden />}
            {isHidden ? `Show ${first}’s posts again` : `Hide posts from ${first}`}
          </button>
          <Link role="menuitem" href={`/u/${username}/report`} className={item}>
            <Flag className="h-[18px] w-[18px] text-ink-3" aria-hidden /> Report profile
          </Link>
          {!blocked ? (
            <form action={blockAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="returnTo" value={`/u/${username}`} />
              <button type="submit" role="menuitem" className={`${item} text-heart`}>
                <Ban className="h-[18px] w-[18px]" aria-hidden /> Block {first}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
