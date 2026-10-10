import Link from "next/link";
import { MessageCircle, Users } from "lucide-react";
import { removeGroupPostAction } from "@/app/group-actions";
import { Avatar } from "@/components/avatar";
import { PostActions } from "@/components/post-actions";
import { PostMedia } from "@/components/post-media";
import { PostMenu } from "@/components/post-menu";
import { ago } from "@/lib/format";
import type { GroupFeedItem, GroupRole } from "@/lib/groups";

/** A post in a group feed. Its comment button opens the members-only group thread. */
export function GroupPostCard({ item, groupId, viewerId, role }: { item: GroupFeedItem; groupId: number; viewerId: number; role: GroupRole }) {
  const { post, author, sharedBy } = item;
  const thread = `/groups/${groupId}/post/${post.id}`;
  const canRemove = author.id === viewerId || sharedBy.id === viewerId || role !== "member";
  return (
    <article className="mb-2 bg-surface md:mb-4 md:overflow-hidden md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" data-testid="group-post" data-author={author.id}>
      {sharedBy.id !== author.id ? (
        <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 text-[13px] text-ink-2">
          <Users className="h-3.5 w-3.5 text-[#0ea5a4]" aria-hidden />
          <span className="truncate">
            <span className="font-semibold text-ink">{sharedBy.displayName}</span> shared this in the group
          </span>
        </div>
      ) : null}
      <header className="flex items-center gap-3 px-4 pb-2.5 pt-3">
        <Avatar initials={author.initials} color={author.avatarColor} src={author.avatarUrl} name={author.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={author.id === viewerId ? "/profile" : `/u/${author.username}`} className="block truncate text-[15px] font-semibold leading-tight hover:underline">
            {author.displayName}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            <Link href={thread} className="hover:underline">
              <time dateTime={item.at}>{ago(item.at)}</time>
            </Link>{" "}
            · Group
          </p>
        </div>
        <PostMenu postId={post.id} own={author.id === viewerId} returnTo={`/groups/${groupId}`} authorId={author.id} authorName={author.displayName} groupId={groupId} />
      </header>
      {item.note && sharedBy.id !== author.id ? (
        <p className="mx-4 mb-2.5 w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-brand-soft px-3.5 py-2 text-[14px] leading-snug">
          <span className="font-semibold">{sharedBy.displayName.split(" ")[0]}:</span> {item.note}
        </p>
      ) : null}
      {post.body && post.kind !== "text" ? <p className="whitespace-pre-wrap px-4 pb-3 text-[15.5px] leading-snug">{post.body}</p> : null}
      <Link href={thread} className="block" tabIndex={-1} aria-label="Open group thread">
        <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} />
      </Link>
      <PostActions postId={post.id} reactions={item.reactions} commentCount={item.threadCount} shareCount={item.shareCount} commentHref={`${thread}#comment-box`} />
      <div className="flex items-center justify-between gap-2 border-t border-line/60 px-4 py-2 text-[13px]">
        <Link href={thread} className="flex items-center gap-1.5 font-semibold text-brand-strong hover:underline" data-testid="group-thread-link">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {item.threadCount ? `${item.threadCount} in the group thread` : "Start the group thread"}
        </Link>
        {canRemove ? (
          <form action={removeGroupPostAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="postId" value={post.id} />
            <button className="text-ink-3 hover:text-danger hover:underline">Remove from group</button>
          </form>
        ) : null}
      </div>
    </article>
  );
}
