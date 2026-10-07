"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleLikeAction } from "@/app/actions";
import { cn } from "@/lib/utils";

const DOTS = [0, 45, 90, 135, 180, 225, 270, 315];
const DOT_COLORS = ["rgb(var(--heart))", "rgb(var(--brand))", "#ffb703", "rgb(var(--heart))"];

export function LikeButton({ postId, liked, count }: { postId: number; liked: boolean; count: number }) {
  const [state, setState] = useState({ liked, count });
  const [burst, setBurst] = useState(0);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={`${state.liked ? "Unlike" : "Like"}, ${state.count} ${state.count === 1 ? "like" : "likes"}`}
      disabled={pending}
      className={cn(
        "tap press inline-flex items-center gap-1.5 rounded-full px-2.5 text-[15px] font-semibold tabular-nums",
        state.liked ? "text-heart" : "text-ink-2 hover:text-heart",
      )}
      onClick={() => {
        const next = !state.liked;
        setState((value) => ({ liked: next, count: value.count + (next ? 1 : -1) }));
        if (next) setBurst((value) => value + 1);
        startTransition(async () => {
          try {
            const saved = await toggleLikeAction(postId);
            setState({ liked: saved.liked, count: saved.likeCount });
          } catch {
            setState((value) => ({ liked: !next, count: value.count + (next ? -1 : 1) }));
          }
        });
      }}
    >
      <span className="relative inline-flex">
        <Heart
          key={burst}
          className={cn("h-[26px] w-[26px]", burst && state.liked ? "heart-pop" : "")}
          fill={state.liked ? "currentColor" : "none"}
          strokeWidth={2}
          aria-hidden
        />
        {burst && state.liked ? (
          <span key={`b${burst}`} className="pointer-events-none absolute inset-[-6px]" aria-hidden>
            <span className="burst-ring" />
            {DOTS.map((angle, index) => (
              <span
                key={angle}
                className="burst-dot"
                style={{ ["--a" as string]: `${angle}deg`, background: DOT_COLORS[index % DOT_COLORS.length] }}
              />
            ))}
          </span>
        ) : null}
      </span>
      <span>{state.count}</span>
    </button>
  );
}
