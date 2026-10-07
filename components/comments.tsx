import Link from "next/link";
import { addCommentAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { ago } from "@/lib/format";
import type { CommentNode } from "@/lib/social";
import type { User } from "@/lib/types";

function CommentForm({ postId, viewer, parentId, placeholder, autoFocus }: { postId: number; viewer: User; parentId?: number; placeholder: string; autoFocus?: boolean }) {
  return (
    <form action={addCommentAction} className="flex items-start gap-2.5" id={parentId ? `reply-${parentId}` : "comment-box"}>
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <Avatar initials={viewer.initials} color={viewer.avatarColor} name={viewer.displayName} size={parentId ? "xs" : "sm"} />
      <label className="sr-only" htmlFor={parentId ? `reply-body-${parentId}` : "comment-body"}>
        {placeholder}
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[20px] bg-surface-2 py-1 pl-3.5 pr-1">
        <input
          id={parentId ? `reply-body-${parentId}` : "comment-body"}
          name="body"
          required
          maxLength={1000}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
        />
        <button type="submit" className="press h-9 shrink-0 rounded-full bg-brand px-3.5 text-[13.5px] font-semibold text-brand-on">
          Post
        </button>
      </div>
    </form>
  );
}

function Bubble({ comment, postId, replyTo }: { comment: CommentNode; postId: number; replyTo: number | null }) {
  return (
    <div id={`c-${comment.id}`} className="scroll-mt-24">
      <div className="flex items-start gap-2.5">
        <Link href={`/u/${comment.author.username}`} className="shrink-0 rounded-full">
          <Avatar initials={comment.author.initials} color={comment.author.avatarColor} name={comment.author.displayName} size="sm" />
        </Link>
        <div className="min-w-0">
          <div className="w-fit max-w-full rounded-[18px] bg-surface-2 px-3.5 py-2">
            <Link href={`/u/${comment.author.username}`} className="block text-[13.5px] font-semibold text-ink hover:underline">
              {comment.author.displayName}
            </Link>
            <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug text-ink">{comment.body}</p>
          </div>
          <p className="mt-1 flex items-center gap-3 pl-3 text-[12px] font-semibold text-ink-3">
            <time dateTime={comment.createdAt}>{ago(comment.createdAt)}</time>
            <Link href={`/post/${postId}?reply=${replyTo ?? comment.id}#reply-${replyTo ?? comment.id}`} className="hover:underline" scroll={false}>
              Reply
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Comment thread. The page only renders this after the access check passes; listComments checks again. */
export function Comments({
  postId,
  comments,
  viewer,
  replyingTo,
  canComment,
}: {
  postId: number;
  comments: CommentNode[];
  viewer: User;
  replyingTo: number | null;
  canComment: boolean;
}) {
  const total = comments.reduce((sum, item) => sum + 1 + item.replies.length, 0);
  return (
    <section id="comments" className="scroll-mt-20 px-4 pb-4 pt-2" aria-labelledby="comments-title">
      <h2 id="comments-title" className="sr-only">
        Comments ({total})
      </h2>
      <p className="mb-3 text-[12.5px] text-ink-3">Only people this post was shared with can see these comments.</p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
        {comments.map((comment) => (
          <li key={comment.id}>
            <Bubble comment={comment} postId={postId} replyTo={null} />
            {comment.replies.length || replyingTo === comment.id ? (
              <ul className="ml-[46px] mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-2.5 border-l-2 border-line/70 pl-3">
                {comment.replies.map((reply) => (
                  <li key={reply.id}>
                    <Bubble comment={reply} postId={postId} replyTo={comment.id} />
                  </li>
                ))}
                {canComment && replyingTo === comment.id ? (
                  <li>
                    <CommentForm postId={postId} viewer={viewer} parentId={comment.id} placeholder={`Reply to ${comment.author.displayName.split(" ")[0]}…`} autoFocus />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {comments.length === 0 ? <p className="py-2 text-[14px] text-ink-3">No comments yet.</p> : null}
      {canComment ? (
        <div className="mt-4">
          <CommentForm postId={postId} viewer={viewer} placeholder="Write a comment…" />
        </div>
      ) : null}
    </section>
  );
}
