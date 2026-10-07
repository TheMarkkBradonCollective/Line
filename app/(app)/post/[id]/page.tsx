import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setReshareAction } from "@/app/actions";
import { Info, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LikeButton } from "@/components/like-button";
import { ShareButton } from "@/components/share-button";
import { LoopMedia } from "@/components/loop-media";
import { Notice } from "@/components/notice";
import { ReportForm } from "@/components/report-form";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { formatWhen, isVideoKind, kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { canViewPost, getPost, hasShareTo, mustUser, shareHistory } from "@/lib/social";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const post = getPost(db, Number(id));
  if (!post || !canViewPost(db, user, post, { allowStaff: true })) notFound();
  const author = mustUser(db, post.authorId);
  const history = shareHistory(db, post.id);
  const onTimeline = hasShareTo(db, post.id, user.id);
  const staffView = post.hidden && !onTimeline && post.authorId !== user.id;
  const likeRow = db.prepare("SELECT COUNT(*) AS c FROM reactions WHERE post_id = ? AND kind = 'like'").get(post.id) as { c: number };
  const liked = Boolean(
    db.prepare("SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ? AND kind = 'like'").get(post.id, user.id),
  );
  const shareCount = (db.prepare("SELECT COUNT(*) AS c FROM shares WHERE post_id = ?").get(post.id) as { c: number }).c;

  let title = "Opened from a case file. Not on your timeline.";
  if (onTimeline) title = "This is on your timeline because it was shared with you.";
  else if (post.authorId === user.id) title = "You created this. It reaches other people only when you share it.";

  return (
    <div className="md:pt-6">
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <article className="bg-surface md:overflow-hidden md:rounded-[28px] md:border md:border-line/60 md:shadow-e2">
        <header className="flex items-center gap-3 px-4 py-3.5">
          <Link href={`/u/${author.username}`} className="shrink-0 rounded-full">
            <Avatar initials={author.initials} color={author.avatarColor} name={author.displayName} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link className="block truncate text-[15px] font-semibold text-ink" href={`/u/${author.username}`}>
              {author.displayName}
            </Link>
            <p className="truncate text-[12.5px] text-ink-3">
              {kindLabel(post.kind)} · {formatWhen(post.createdAt)}
            </p>
          </div>
        </header>
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
          <span>
            {title}
            {staffView ? " Staff view. Hidden from timelines." : ""}
            {post.hidden && post.hiddenReason ? ` Hidden: ${post.hiddenReason}` : ""}
          </span>
        </p>
        <LoopMedia kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} body={post.body} />
        {post.kind !== "text" ? <p className="whitespace-pre-wrap px-4 pt-3.5 text-[16px] leading-relaxed">{post.body}</p> : null}
        <div className="flex items-center gap-1 px-3 pb-3.5 pt-3">
          {!post.hidden ? <ShareButton postId={post.id} count={shareCount} className="ml-1" /> : null}
          {!post.hidden ? <LikeButton postId={post.id} liked={liked} count={likeRow.c} /> : null}
        </div>
      </article>

      <section className="mt-6 px-4 md:px-0">
        <h2 className="font-display text-lg font-bold tracking-tight">How it travelled</h2>
        <p className="text-[13px] text-ink-3">Every hop is a person choosing a person.</p>
        {history.length === 0 ? <p className="mt-3 text-sm text-ink-3">No one has shared this yet.</p> : null}
        <ol className="relative mt-4 grid gap-4 pl-6 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-[2px] before:rounded-full before:bg-brand-tint">
          {history.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-on ring-4 ring-[rgb(var(--bg))]">
                <Send className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
              </span>
              <p className="text-[14.5px] leading-snug">
                <span className="font-semibold">{item.from_name}</span>
                {" → "}
                <span className="font-semibold">{item.from_user_id === item.to_user_id ? "their own timeline" : item.to_name}</span>
                {item.group_name ? <span className="text-ink-3"> via {item.group_name}</span> : null}
              </p>
              <p className="text-[12px] text-ink-3">{formatWhen(item.created_at)}</p>
              {item.note ? <p className="mt-1.5 w-fit rounded-2xl rounded-tl-md bg-brand-soft px-3 py-1.5 text-[13.5px]">{item.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      {post.authorId === user.id ? (
        <section className="mt-6 px-4 md:px-0">
          <form action={setReshareAction}>
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
