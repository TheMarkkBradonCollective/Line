import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setReshareAction } from "@/app/actions";
import { LikeButton } from "@/components/like-button";
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
  if (!post || !canViewPost(db, user, post)) notFound();
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
    <div>
      <div className="px-4 pt-4">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <article>
        <header className="px-4 pb-3">
          <p className="kicker">{kindLabel(post.kind)}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">{title}</h1>
          {staffView ? <p className="mt-1 text-sm font-semibold text-muted">Staff view. Hidden from timelines.</p> : null}
          {post.hidden && post.hiddenReason ? <p className="mt-2 text-sm font-semibold">Hidden: {post.hiddenReason}</p> : null}
        </header>
        <LoopMedia kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} body={post.body} />
        <div className="px-4 py-3">
          <p className="text-sm font-extrabold">
            <Link className="text-ink" href={`/u/${author.username}`}>{author.displayName}</Link>
            <span className="font-semibold text-muted"> · {formatWhen(post.createdAt)}</span>
          </p>
          {post.kind !== "text" ? <p className="mt-2 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{post.body}</p> : null}
        </div>
        <div className="flex items-center gap-3 px-4 pb-4">
          <Link href={`/share/${post.id}`} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pine text-white" aria-label="Share">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M7 12h10" />
              <path d="M13 7l5 5-5 5" />
            </svg>
          </Link>
          <span className="text-sm font-extrabold text-[#6b6b6b]">{shareCount}</span>
          {!post.hidden ? <LikeButton postId={post.id} liked={liked} count={likeRow.c} /> : null}
        </div>
      </article>

      <section className="mt-2 px-4">
        <h2 className="font-display text-2xl font-semibold">Sharing history</h2>
        <ul className="mt-2 grid gap-2 text-sm font-semibold">
          {history.length === 0 ? <li className="text-muted">No one has shared this yet.</li> : null}
          {history.map((item) => (
            <li key={item.id} className="rounded-2xl bg-[#f7f7f7] px-3 py-2">
              {item.from_name} shared it with {item.from_user_id === item.to_user_id ? "their own timeline" : item.to_name}
              {item.group_name ? ` via ${item.group_name}` : ""} · {formatWhen(item.created_at)}
              {item.note ? <span className="block italic">“{item.note}”</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {post.authorId === user.id ? (
        <section className="mt-6 px-4">
          <form action={setReshareAction}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="allow" value={post.allowReshare ? "0" : "1"} />
            <Button type="submit" variant="outline">
              {post.allowReshare ? "Turn off resharing" : "Allow resharing"}
            </Button>
          </form>
        </section>
      ) : null}

      <div className="mt-6 px-4" id="report">
        <ReportForm
          targetType={isVideoKind(post.kind) ? "video" : "post"}
          targetId={post.id}
          returnTo={`/post/${post.id}`}
        />
      </div>
    </div>
  );
}
