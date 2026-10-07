import Link from "next/link";
import { ArrowRight, Flag, Users } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { LikeButton } from "@/components/like-button";
import { LoopMedia } from "@/components/loop-media";
import { ShareButton } from "@/components/share-button";
import { formatWhen } from "@/lib/format";
import type { TimelineItem } from "@/lib/social";

function first(name: string) {
  return name.split(" ")[0];
}

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return formatWhen(iso).split(",")[0];
}

export function TimelineCard({ item, index = 0 }: { item: TimelineItem; index?: number }) {
  const self = item.sharedBy.id === item.toUserId;
  const madeByYou = item.author.id === item.toUserId;
  const chain = item.chain;
  const passers = chain.slice(1, -1);

  let lead: React.ReactNode;
  if (self && madeByYou) lead = <>You put this on your timeline</>;
  else if (self) lead = <>You added this to your timeline</>;
  else
    lead = (
      <>
        <span className="font-semibold text-ink">{item.sharedBy.displayName}</span> shared with you
      </>
    );

  let trail: string | null = null;
  if (!self && item.author.id !== item.sharedBy.id) {
    trail = passers.length
      ? `via ${passers.map((person) => first(person.displayName)).join(", ")} · made by ${first(item.author.displayName)}`
      : `made by ${item.author.displayName}`;
  }

  return (
    <article
      className="animate-rise border-b border-line/60 bg-surface md:mb-5 md:overflow-hidden md:rounded-[28px] md:border md:shadow-e2"
      style={{ ["--i" as string]: Math.min(index, 6) }}
      data-testid="feed-card"
    >
      {/* Shared-by chip: who carried this to you */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5" title={item.provenance}>
          <span className="rounded-full bg-surface-2 p-1">
            <AvatarStack
              people={self ? [item.sharedBy] : chain.length > 1 ? chain : [item.sharedBy]}
              size="sm"
              max={4}
            />
          </span>
          <p className="min-w-0 text-[13.5px] leading-tight text-ink-2">
            <span className="block truncate">{lead}</span>
            {trail ? <span className="block truncate text-[12.5px] text-ink-3">{trail}</span> : null}
            {item.groupName ? (
              <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-3">
                <Users className="h-3 w-3" aria-hidden /> {item.groupName}
              </span>
            ) : null}
          </p>
        </div>
        <time dateTime={item.sharedAt} className="shrink-0 text-[12.5px] font-medium text-ink-3">
          {ago(item.sharedAt)}
        </time>
      </div>

      {chain.length >= 3 && !self ? (
        <ol className="no-scrollbar mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto text-[12px] font-semibold text-ink-2" aria-label="Share chain">
          {chain.map((person, i) => (
            <li key={`${person.id}-${i}`} className="flex shrink-0 items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2">
                <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="xs" />
                {first(person.displayName)}
              </span>
              <ArrowRight className="h-3 w-3 text-brand-strong" aria-hidden />
            </li>
          ))}
          <li className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-brand-strong">You</li>
        </ol>
      ) : null}

      {item.note ? (
        <div className="mx-4 mb-3 flex items-start gap-2">
          <span className="relative rounded-2xl rounded-tl-md bg-brand-soft px-3.5 py-2 text-[14px] leading-snug text-ink">
            {item.note}
          </span>
        </div>
      ) : null}

      <Link href={`/post/${item.postId}`} className="block" aria-label={`Open post by ${item.author.displayName}`} tabIndex={-1}>
        <LoopMedia kind={item.kind} label={item.mediaLabel} tone={item.mediaTone} body={item.body} />
      </Link>

      <div className="flex items-start gap-3 px-4 pt-3.5">
        <Link href={`/u/${item.author.username}`} className="shrink-0 rounded-full">
          <Avatar initials={item.author.initials} color={item.author.avatarColor} name={item.author.displayName} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <Link className="truncate text-[15px] font-semibold text-ink hover:underline" href={`/u/${item.author.username}`}>
              {item.author.displayName}
            </Link>
            <span className="truncate text-[13px] text-ink-3">@{item.author.username}</span>
          </p>
          {item.kind !== "text" ? <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug text-ink">{item.body}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 pb-3.5 pt-3">
        <ShareButton postId={item.postId} count={item.shareCount} className="ml-1" />
        <LikeButton postId={item.postId} liked={item.liked} count={item.likeCount} />
        <Link
          href={`/post/${item.postId}#report`}
          aria-label="Report this post"
          className="tap press ml-auto flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <Flag className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
