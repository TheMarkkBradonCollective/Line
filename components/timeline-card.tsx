import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { LikeButton } from "@/components/like-button";
import { LoopMedia } from "@/components/loop-media";
import { formatWhen } from "@/lib/format";
import type { TimelineItem } from "@/lib/social";

export function TimelineCard({ item }: { item: TimelineItem }) {
  const passed = item.author.id === item.sharedBy.id ? item.headline : `${item.provenance}`;
  return (
    <article className="feed-card">
      <div className="share-strip">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 7h11v11" />
          <path d="M18 7 6 19" />
        </svg>
        <p>
          <span className="text-ink">{item.headline}</span>
          {item.author.id !== item.sharedBy.id ? <span className="mt-0.5 block font-semibold text-[#8a8a8a]">{passed}</span> : null}
          {item.groupName ? <span className="block font-semibold">Via {item.groupName}</span> : null}
          {item.note ? <span className="block font-semibold italic text-ink">“{item.note}”</span> : null}
        </p>
      </div>
      <LoopMedia kind={item.kind} label={item.mediaLabel} tone={item.mediaTone} body={item.body} />
      <div className="flex items-start gap-3 px-3 pb-2 pt-3">
        <Avatar initials={item.author.initials} color={item.author.avatarColor} name={item.author.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <Link className="block truncate text-[15px] font-extrabold text-ink" href={`/u/${item.author.username}`}>
            {item.author.displayName}
          </Link>
          <p className="text-xs font-semibold text-[#8a8a8a]">
            @{item.author.username} · {formatWhen(item.sharedAt)}
          </p>
          {item.kind !== "text" ? <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold leading-snug text-ink">{item.body}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3 px-3 pb-4">
        <Link
          href={`/share/${item.postId}`}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pine text-white shadow-[0_6px_14px_rgba(0,191,143,0.35)] hover:bg-pine-deep"
          aria-label={`Share, sent ${item.shareCount} times`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M7 12h10" />
            <path d="M13 7l5 5-5 5" />
            <path d="M5 6v12" />
          </svg>
        </Link>
        <span className="text-sm font-extrabold text-[#6b6b6b]">{item.shareCount}</span>
        <LikeButton postId={item.postId} liked={item.liked} count={item.likeCount} />
        <Link href={`/post/${item.postId}#report`} className="ml-auto inline-flex items-center gap-1 text-xs font-extrabold text-[#8a8a8a]" aria-label="Report">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 4v16" />
            <path d="M6 5h11l-2 4 2 4H6" />
          </svg>
          Report
        </Link>
      </div>
    </article>
  );
}
