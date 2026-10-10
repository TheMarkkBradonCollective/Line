import Link from "next/link";
import { ArrowRight, Lock, Send } from "lucide-react";
import { PostMenu } from "@/components/post-menu";
import { Avatar, AvatarStack } from "@/components/avatar";
import { PostActions } from "@/components/post-actions";
import { PostMedia } from "@/components/post-media";
import { ago } from "@/lib/format";
import type { TimelineItem } from "@/lib/social";

function first(name: string) {
  return name.split(" ")[0];
}

/**
 * A news-feed card. Looks like any big social app, but every card exists because someone
 * shared the post with you (or you made it). The top line says who.
 */
export function TimelineCard({ item, index = 0 }: { item: TimelineItem; index?: number }) {
  const self = item.sharedBy.id === item.toUserId;
  const chain = item.chain;
  const passers = chain.slice(1, -1);
  const reel = item.kind === "reel" || item.kind === "short";
  const href = reel ? `/loops/${item.postId}` : `/post/${item.postId}`;
  const longText = item.kind === "text" && item.body.length > 160;

  let context: React.ReactNode = null;
  if (!self && item.sharedBy.id !== item.author.id) {
    context = (
      <>
        <span className="font-semibold text-ink">{item.sharedBy.displayName}</span> passed this to you
        {passers.length ? <span className="text-ink-3"> · via {passers.map((person) => first(person.displayName)).join(", ")}</span> : null}
      </>
    );
  } else if (!item.ownPost && item.author.id !== item.toUserId) {
    context = <>You added this to your feed</>;
  }

  const audience =
    item.ownPost || item.author.id === item.toUserId
      ? item.provenance
      : item.groupName
        ? `Shared with ${item.groupName}`
        : item.sharedBy.id === item.author.id
          ? "Shared with you"
          : `Shared with you by ${first(item.sharedBy.displayName)}`;

  return (
    <article
      className="animate-rise mb-2 bg-surface md:mb-4 md:overflow-hidden md:rounded-[24px] md:border md:border-line/60 md:shadow-e1"
      style={{ ["--i" as string]: Math.min(index, 6) }}
      data-testid="feed-card"
      data-author={item.author.id}
    >
      {context ? (
        <div className="flex items-center gap-2.5 border-b border-line/60 px-4 py-2.5" title={item.provenance}>
          <AvatarStack people={chain.length > 1 && !self ? chain : [item.sharedBy]} size="xs" max={4} />
          <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{context}</p>
        </div>
      ) : null}

      <header className="flex items-center gap-3 px-4 pb-2.5 pt-3">
        <Link href={`/u/${item.author.username}`} className="shrink-0 rounded-full">
          <Avatar initials={item.author.initials} color={item.author.avatarColor} src={item.author.avatarUrl} name={item.author.displayName} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link className="block truncate text-[15px] font-semibold leading-tight text-ink hover:underline" href={`/u/${item.author.username}`}>
            {item.author.displayName}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-3">
            <Link href={href} className="text-ink-3 hover:underline">
              <time dateTime={item.sharedAt}>{ago(item.sharedAt)}</time>
            </Link>
            <span aria-hidden>·</span>
            {item.ownPost || item.author.id === item.toUserId ? (
              <Lock className="h-3 w-3" aria-hidden />
            ) : (
              <Send className="h-3 w-3" aria-hidden />
            )}
            <span className="truncate">{audience}</span>
          </p>
        </div>
        <PostMenu postId={item.postId} own={item.author.id === item.toUserId} returnTo="/timeline" />
      </header>

      {chain.length >= 3 && !self ? (
        <ol className="no-scrollbar relative mx-4 mb-2.5 flex items-center gap-1.5 overflow-x-auto text-[12px] font-semibold text-ink-2" aria-label="Share chain">
          {chain.map((person, i) => (
            <li key={`${person.id}-${i}`} className="flex shrink-0 items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2">
                <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="xs" />
                {first(person.displayName)}
              </span>
              <ArrowRight className="h-3 w-3 text-brand-strong" aria-hidden />
            </li>
          ))}
          <li className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-brand-strong">You</li>
        </ol>
      ) : null}

      {item.note ? (
        <p className="mx-4 mb-2.5 w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-brand-soft px-3.5 py-2 text-[14px] leading-snug text-ink">
          <span className="font-semibold">{first(item.sharedBy.displayName)}:</span> {item.note}
        </p>
      ) : null}

      {item.kind !== "text" || longText ? (
        <p className="whitespace-pre-wrap px-4 pb-3 text-[15.5px] leading-snug text-ink">{item.body}</p>
      ) : null}

      {!longText ? (
        <Link href={href} className="block" aria-label={`Open ${reel ? "reel" : "post"} by ${item.author.displayName}`} tabIndex={-1}>
          <PostMedia postId={item.postId} kind={item.kind} body={item.body} frames={item.frames} />
        </Link>
      ) : null}

      <PostActions
        postId={item.postId}
        reactions={item.reactions}
        commentCount={item.commentCount}
        shareCount={item.shareCount}
        commentHref={`/post/${item.postId}#comments`}
        dislike={item.author.id === item.toUserId ? null : { authorId: item.author.id, authorName: item.author.displayName }}
      />
    </article>
  );
}
