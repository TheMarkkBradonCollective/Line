"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { reactAction } from "@/app/actions";
import { REACTIONS, ReactionDisc, reactionMeta } from "@/components/reactions";
import { ShareButton } from "@/components/share-button";
import { DislikeButton } from "@/components/dislike-button";
import type { ReactionKind, ReactionSummary } from "@/lib/social";
import { cn } from "@/lib/utils";

function applyLocal(summary: ReactionSummary, next: ReactionKind | null): ReactionSummary {
  const counts = { ...summary.counts };
  if (summary.mine) counts[summary.mine] = Math.max(0, (counts[summary.mine] ?? 1) - 1);
  if (next) counts[next] = (counts[next] ?? 0) + 1;
  const top = (Object.entries(counts) as [ReactionKind, number][])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([kind]) => kind)
    .slice(0, 3);
  const total = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  return { total, mine: next, top, counts };
}

function summaryText(summary: ReactionSummary) {
  if (!summary.total) return "";
  if (summary.mine && summary.total === 1) return "You";
  if (summary.mine) return `You and ${summary.total - 1} ${summary.total - 1 === 1 ? "other" : "others"}`;
  return String(summary.total);
}

/** Reaction summary, then the Like / Comment / Share bar. Reacting is checked on the server against the share rule. */
export function PostActions({
  postId,
  reactions,
  commentCount,
  shareCount,
  commentHref,
  showSummary = true,
  canShare = true,
  dislike,
}: {
  /** Shown on other people's posts in Home and Discover. */
  dislike?: { authorId: number; authorName: string } | null;
  postId: number;
  reactions: ReactionSummary;
  commentCount: number;
  shareCount: number;
  commentHref: string;
  showSummary?: boolean;
  canShare?: boolean;
}) {
  const [summary, setSummary] = useState(reactions);
  const [picker, setPicker] = useState(false);
  const [pop, setPop] = useState(0);
  const [, startTransition] = useTransition();
  const holdTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!picker) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPicker(false);
    const onDown = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setPicker(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [picker]);

  function choose(next: ReactionKind | null) {
    const before = summary;
    setSummary(applyLocal(summary, next));
    setPicker(false);
    if (next) setPop((value) => value + 1);
    startTransition(async () => {
      try {
        setSummary(await reactAction(postId, next));
      } catch {
        setSummary(before);
      }
    });
  }

  const mine = summary.mine ? reactionMeta(summary.mine) : null;
  const MineIcon = mine?.Icon ?? ThumbsUp;

  return (
    <div>
      {showSummary && (summary.total || commentCount || shareCount) ? (
        <div className="flex items-center gap-2 px-4 pb-2 pt-3 text-[13.5px] text-ink-3" data-testid="reaction-summary">
          {summary.total ? (
            <span className="flex items-center gap-1.5">
              <span className="flex -space-x-1">
                {summary.top.map((kind) => (
                  <ReactionDisc key={kind} kind={kind} />
                ))}
              </span>
              <span className="tabular-nums">{summaryText(summary)}</span>
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-3 tabular-nums">
            {commentCount ? (
              <Link href={commentHref} className="hover:underline">
                {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </Link>
            ) : null}
            {shareCount ? (
              <span>
                {shareCount} {shareCount === 1 ? "share" : "shares"}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div ref={wrap} className="relative mx-3 flex items-center gap-1 border-t border-line/70 py-1">
        {picker ? (
          <div
            role="menu"
            aria-label="Reactions"
            className="animate-pop absolute -top-14 left-0 z-20 flex items-center gap-1 rounded-full border border-line/60 bg-surface px-2 py-1.5 shadow-e3"
            data-testid="reaction-picker"
          >
            {REACTIONS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                aria-label={label}
                title={label}
                onClick={() => choose(summary.mine === kind ? null : kind)}
                className="press rounded-full p-1 transition-transform hover:-translate-y-1 hover:scale-110 focus-visible:-translate-y-1"
              >
                <ReactionDisc kind={kind} size={36} className="ring-0" />
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          aria-pressed={Boolean(summary.mine)}
          aria-haspopup="menu"
          aria-label={mine ? `${mine.label}. Tap to remove, hold for more reactions` : "Like. Hold for more reactions"}
          className={cn(
            "press inline-flex h-11 flex-1 select-none items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold hover:bg-surface-2",
            mine ? mine.text : "text-ink-2",
          )}
          onPointerDown={() => {
            longPressed.current = false;
            holdTimer.current = window.setTimeout(() => {
              longPressed.current = true;
              setPicker(true);
            }, 420);
          }}
          onPointerUp={() => holdTimer.current && window.clearTimeout(holdTimer.current)}
          onPointerLeave={() => holdTimer.current && window.clearTimeout(holdTimer.current)}
          onContextMenu={(event) => {
            event.preventDefault();
            setPicker(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setPicker(true);
            }
          }}
          onClick={() => {
            if (longPressed.current) return;
            choose(summary.mine ? null : "like");
          }}
          data-testid="react-button"
        >
          <MineIcon key={pop} className={cn("h-[19px] w-[19px]", pop ? "heart-pop" : "")} fill={summary.mine === "like" || summary.mine === "love" ? "currentColor" : "none"} strokeWidth={2.1} aria-hidden />
          {mine?.label ?? "Like"}
        </button>
        <Link
          href={commentHref}
          className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold text-ink-2 hover:bg-surface-2"
        >
          <MessageCircle className="h-[19px] w-[19px]" strokeWidth={2.1} aria-hidden />
          Comment
        </Link>
        {canShare ? <ShareButton postId={postId} count={shareCount} variant="bar" /> : null}
        {dislike ? <DislikeButton postId={postId} authorId={dislike.authorId} authorName={dislike.authorName} /> : null}
      </div>
    </div>
  );
}
