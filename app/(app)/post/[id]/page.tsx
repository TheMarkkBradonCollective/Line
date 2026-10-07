import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setDiscoverAction, setReshareAction } from "@/app/actions";
import { MediaPlate } from "@/components/media-plate";
import { Notice } from "@/components/notice";
import { ReportForm } from "@/components/report-form";
import { Button, buttonVariants } from "@/components/ui/button";
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

  return (
    <div className="mx-auto max-w-2xl">
      <Notice notice={query.notice} error={query.error} />
      <article className="desk-card">
        <header className="border-b border-rule px-4 py-3">
          <p className="kicker">{kindLabel(post.kind)}</p>
          {onTimeline ? (
            <h1 className="mt-1 font-serif text-3xl">This is on your timeline because it was shared with you.</h1>
          ) : post.listedOnDiscover ? (
            <h1 className="mt-1 font-serif text-3xl">Public on Discover. Not on your timeline.</h1>
          ) : post.authorId === user.id ? (
            <h1 className="mt-1 font-serif text-3xl">You created this.</h1>
          ) : (
            <h1 className="mt-1 font-serif text-3xl">Opened from a case file. Not on your timeline.</h1>
          )}
          {staffView ? <p className="mt-1 text-sm text-muted">Staff view. Hidden from timelines and Discover.</p> : null}
          {post.hidden && post.hiddenReason ? <p className="mt-2 text-sm">Hidden: {post.hiddenReason}</p> : null}
        </header>
        <div className="px-4 py-4">
          <p className="text-sm">
            <Link className="underline" href={`/u/${author.username}`}>{author.displayName}</Link>
            <span className="text-muted"> · {formatWhen(post.createdAt)}</span>
          </p>
          <p className="mt-3 whitespace-pre-wrap text-[17px] leading-relaxed">{post.body}</p>
          {post.mediaLabel && post.mediaTone ? <MediaPlate kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} /> : null}
        </div>
        <footer className="border-t border-rule px-4 py-3">
          <Link className={buttonVariants({ variant: "stamp" })} href={`/share/${post.id}`}>
            Share
          </Link>
        </footer>
      </article>

      <section className="mt-6">
        <h2 className="font-serif text-2xl">Sharing history</h2>
        <ul className="mt-2 grid gap-2 text-sm">
          {history.length === 0 ? <li className="text-muted">No one has shared this yet.</li> : null}
          {history.map((item) => (
            <li key={item.id} className="border border-rule bg-card px-3 py-2">
              {item.from_name} shared it with {item.from_user_id === item.to_user_id ? "their own timeline" : item.to_name}
              {item.group_name ? ` via ${item.group_name}` : ""} · {formatWhen(item.created_at)}
              {item.note ? <span className="block italic">“{item.note}”</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {post.authorId === user.id ? (
        <section className="mt-6 grid gap-3">
          <h2 className="font-serif text-2xl">Where it is public</h2>
          <form action={setDiscoverAction}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="listed" value={post.listedOnDiscover ? "0" : "1"} />
            <Button type="submit" variant="outline">
              {post.listedOnDiscover ? "Remove from Discover" : "List on Discover"}
            </Button>
          </form>
          <form action={setReshareAction}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="allow" value={post.allowReshare ? "0" : "1"} />
            <Button type="submit" variant="ghost">
              {post.allowReshare ? "Turn off resharing" : "Allow resharing"}
            </Button>
          </form>
        </section>
      ) : null}

      <div className="mt-6">
        <ReportForm
          targetType={isVideoKind(post.kind) ? "video" : "post"}
          targetId={post.id}
          returnTo={`/post/${post.id}`}
        />
      </div>
    </div>
  );
}
