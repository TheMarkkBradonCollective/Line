import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Info, Lock, Send } from "lucide-react";
import { setReshareAction } from "@/app/actions";
import { PostMenu } from "@/components/post-menu";
import { Avatar } from "@/components/avatar";
import { Comments } from "@/components/comments";
import { Notice } from "@/components/notice";
import { PostActions } from "@/components/post-actions";
import { PostMedia } from "@/components/post-media";
import { ReportForm } from "@/components/report-form";
import { Button } from "@/components/ui/button";
import { postAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { formatWhen, isVideoKind, kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getPost, getTimeline, listComments, mustUser, postEngagement, shareHistory } from "@/lib/social";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; reply?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const post = await getPost(db, Number(id));
  // One gate. Staff may open a post as a case file; nobody else gets past without a share.
  const access = post ? await postAccess(db, user, post) : null;
  if (!post || !access) notFound();
  const author = await mustUser(db, post.authorId);
  const mine = access === "author";
  const staffView = access === "staff";
  const counts = await postEngagement(db, user.id, post.id);
  const comments = await listComments(db, user.id, post.id, { allowStaff: true }) ?? [];
  const reached = !mine && !staffView ? (await getTimeline(db, user.id)).find((item) => item.postId === post.id) : undefined;
  const history = mine ? await shareHistory(db, post.id) : [];
  const replyingTo = Number(query.reply) || null;
  const text = post.kind === "text" && post.body.length <= 160;

  return (
    <div className="md:pt-6">
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <article className="bg-surface md:overflow-hidden md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
        {reached && reached.sharedBy.id !== user.id ? (
          <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 text-[13px] text-ink-2">
            <Send className="h-3.5 w-3.5 text-brand-strong" aria-hidden />
            <span className="truncate">
              <span className="font-semibold text-ink">{reached.sharedBy.displayName}</span> shared this with you
            </span>
          </div>
        ) : null}
        <header className="flex items-center gap-3 px-4 pb-2.5 pt-3">
          <Link href={`/u/${author.username}`} className="shrink-0 rounded-full">
            <Avatar initials={author.initials} color={author.avatarColor} src={author.avatarUrl} name={author.displayName} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link className="block truncate text-[15px] font-semibold text-ink hover:underline" href={`/u/${author.username}`}>
              {author.displayName}
            </Link>
            <p className="flex items-center gap-1 truncate text-[12.5px] text-ink-3">
              {kindLabel(post.kind)} · {formatWhen(post.createdAt)} · <Lock className="h-3 w-3" aria-hidden />
              {mine ? "Only people you share with" : staffView ? "Case view" : reached ? "Shared with you" : "Followers"}
            </p>
          </div>
          {!staffView ? <PostMenu postId={post.id} own={mine} returnTo={`/post/${post.id}`} /> : null}
        </header>
        {staffView ? (
          <p className="mx-4 mb-3 flex items-start gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
            <span>
              Opened from a case file. This post was not shared with you, so it is not in your feed and you can’t react or comment.
              {post.hidden && post.hiddenReason ? ` Hidden: ${post.hiddenReason}` : ""}
            </span>
          </p>
        ) : null}
        {mine && post.hidden ? (
          <p className="banner-warn mx-4 mb-3 px-3.5 py-2.5 text-[13px]">Hidden by moderation{post.hiddenReason ? `: ${post.hiddenReason}` : ""}.</p>
        ) : null}
        {reached?.note && reached.sharedBy.id !== user.id ? (
          <p className="mx-4 mb-2.5 w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-brand-soft px-3.5 py-2 text-[14px] leading-snug text-ink">
            <span className="font-semibold">{reached.sharedBy.displayName.split(" ")[0]}:</span> {reached.note}
          </p>
        ) : null}
        {!text ? <p className="whitespace-pre-wrap px-4 pb-3 text-[16px] leading-relaxed">{post.body}</p> : null}
        <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} variant="detail" />
        {counts && !post.hidden ? (
          <PostActions
            postId={post.id}
            reactions={counts.reactions}
            commentCount={counts.commentCount}
            shareCount={counts.shareCount}
            commentHref={`/post/${post.id}#comment-box`}
          />
        ) : null}
        <div className="border-t border-line/60 md:mx-0">
          <Comments postId={post.id} comments={comments} viewer={user} replyingTo={replyingTo} canComment={Boolean(counts) && !post.hidden && !user.restricted} />
        </div>
      </article>

      {reached && reached.chain.length > 1 ? (
        <section className="mt-6 px-4 md:px-0">
          <h2 className="font-display text-lg font-bold tracking-tight">How it reached you</h2>
          <p className="text-[13px] text-ink-3">Each hop is a person choosing a person. You only see the path that led to you.</p>
          <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink-2">
            {reached.chain.map((person, i) => (
              <li key={`${person.id}-${i}`} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-0.5 pr-2.5 shadow-e1">
                  <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="xs" />
                  {person.displayName}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-brand-strong" aria-hidden />
              </li>
            ))}
            <li className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-strong">You</li>
          </ol>
        </section>
      ) : null}

      {mine ? (
        <section className="mt-6 px-4 md:px-0">
          <h2 className="font-display text-lg font-bold tracking-tight">Who has it</h2>
          <p className="text-[13px] text-ink-3">Only you see this list. Every hop is a person choosing a person.</p>
          {history.length === 0 ? <p className="mt-3 text-sm text-ink-3">You haven’t shared this with anyone yet, so only you can see it.</p> : null}
          <ol className="relative mt-4 grid gap-4 pl-6 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-[2px] before:rounded-full before:bg-brand-tint">
            {history.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-on ring-4 ring-[rgb(var(--bg))]">
                  <Send className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                </span>
                <p className="text-[14.5px] leading-snug">
                  <span className="font-semibold">{item.from_name}</span>
                  {" → "}
                  <span className="font-semibold">{item.from_user_id === item.to_user_id ? "their own feed" : item.to_name}</span>
                  {item.group_name ? <span className="text-ink-3"> via {item.group_name}</span> : null}
                </p>
                <p className="text-[12px] text-ink-3">{formatWhen(item.created_at)}</p>
                {item.note ? <p className="mt-1.5 w-fit rounded-2xl rounded-tl-md bg-brand-soft px-3 py-1.5 text-[13.5px]">{item.note}</p> : null}
              </li>
            ))}
          </ol>
          <form action={setReshareAction} className="mt-5">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="allow" value={post.allowReshare ? "0" : "1"} />
            <Button type="submit" variant="outline">
              {post.allowReshare ? "Turn off resharing" : "Allow resharing"}
            </Button>
          </form>
        </section>
      ) : null}

      <div className="mt-6 scroll-mt-20 px-4 md:px-0" id="report">
        <ReportForm targetType={isVideoKind(post.kind) ? "video" : "post"} targetId={post.id} returnTo={`/post/${post.id}`} />
      </div>
    </div>
  );
}
