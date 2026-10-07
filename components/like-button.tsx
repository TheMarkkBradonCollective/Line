"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";

export function LikeButton({ postId, liked, count }: { postId: number; liked: boolean; count: number }) {
  const [state, setState] = useState({ liked, count });
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-extrabold ${state.liked ? "text-[#e0457b]" : "text-[#8a8a8a] hover:text-[#e0457b]"}`}
      onClick={() => {
        startTransition(async () => {
          const next = await toggleLikeAction(postId);
          setState({ liked: next.liked, count: next.likeCount });
        });
      }}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill={state.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
      </svg>
      <span>{state.count}</span>
    </button>
  );
}
