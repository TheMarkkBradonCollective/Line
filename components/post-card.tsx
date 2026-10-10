import Link from "next/link";
import { Lock, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostActions } from "@/components/post-actions";
import { PostMenu } from "@/components/post-menu";
import { PostMedia } from "@/components/post-media";
import { ago } from "@/lib/format";
import type { ProfilePost } from "@/lib/social";
import type { User } from "@/lib/types";

/** A post on a profile. Same look as the feed; only rendered for posts that passed the access check. */
export function PostCard({ item, author, viewerId, allowDislike = false }: { item: ProfilePost; author: User; viewerId: number; allowDislike?: boolean }) {
  const { post } = item;
  const reel = post.kind === "reel" || post.kind === "short";
  const href = reel ? `/reels/${post.id}` : `/post/${post.id}`;
  const longText = post.kind === "text" && post.body.length > 160;
  const own = author.id === viewerId;
  return (
    <article className="mb-2 bg-surface md:mb-4 md:overflow-hidden md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" data-testid="profile-post" data-author={author.id}>
      {item.reachedBy && item.reachedBy.id !== author.id ? (
        <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 text-[13px] text-ink-2">
          <Avatar initials={item.reachedBy.initials} color={item.reachedBy.avatarColor} src={item.reachedBy.avatarUrl} name={item.reachedBy.displayName} size="xs" />
          <span className="truncate">
            <span className="font-semibold text-ink">{item.reachedBy.displayName}</span> passed this to you
          </span>
        </div>
      ) : null}
      <header className="flex items-center gap-3 px-4 pb-2.5 pt-3">
        <Avatar initials={author.initials} color={author.avatarColor} src={author.avatarUrl} name={author.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={own ? "/profile" : `/u/${author.username}`} className="block truncate text-[15px] font-semibold leading-tight text-ink hover:underline">
            {author.displayName}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-3">
            <Link href={href} className="text-ink-3 hover:underline">
              <time dateTime={post.createdAt}>{ago(post.createdAt)}</time>
            </Link>
            <span aria-hidden>·</span>
            {own ? <Lock className="h-3 w-3" aria-hidden /> : <Send className="h-3 w-3" aria-hidden />}
            <span className="truncate">{own ? "Only people you share with" : item.reachedBy ? "Shared with you" : "Followers"}</span>
          </p>
        </div>
        <PostMenu postId={post.id} own={own} returnTo={own ? "/profile" : `/u/${author.username}`} />
      </header>
      {post.kind !== "text" || longText ? <p className="whitespace-pre-wrap px-4 pb-3 text-[15.5px] leading-snug text-ink">{post.body}</p> : null}
      {!longText ? (
        <Link href={href} className="block" tabIndex={-1} aria-label={`Open ${reel ? "reel" : "post"}`}>
          <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} />
        </Link>
      ) : null}
      <PostActions postId={post.id} reactions={item.reactions} commentCount={item.commentCount} shareCount={item.shareCount} commentHref={`/post/${post.id}#comments`} dislike={allowDislike && !own ? { authorId: author.id, authorName: author.displayName } : null} />
    </article>
  );
}
