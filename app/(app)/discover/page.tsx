import Link from "next/link";
import { Notice } from "@/components/notice";
import { MediaPlate } from "@/components/media-plate";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getDiscover, getSetting, hasShareTo } from "@/lib/social";
import { redirect } from "next/navigation";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const enabled = getSetting(db, "discover_enabled") === "1";
  const items = getDiscover(db);
  const popular = [...items].filter((item) => item.shareCount > 0).sort((a, b) => b.shareCount - a.shareCount);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="kicker">Discover</p>
      <h1 className="mt-1 font-serif text-4xl">Public shelf</h1>
      <p className="mt-2 text-sm text-muted">
        These posts are public because their creators listed them here. Nothing on this page is added to your timeline. Keeping one means sharing it with someone.
      </p>
      <div className="mt-5">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {!enabled ? (
        <p className="desk-card px-4 py-6 text-sm">Discover is turned off in platform settings. Your timeline is unchanged.</p>
      ) : (
        <div className="grid gap-8">
          <section className="grid gap-4">
            <h2 className="font-serif text-2xl">Public lately</h2>
            {items.length === 0 ? <p className="text-sm text-muted">Nothing public right now.</p> : null}
            {items.map(({ post, author, shareCount }) => {
              const onTimeline = hasShareTo(db, post.id, user.id);
              return (
                <article key={post.id} className="desk-card">
                  <header className="border-b border-rule px-4 py-3">
                    <p className="kicker">Discover · not a timeline delivery</p>
                    <h3 className="mt-1 font-serif text-2xl">Public, by {author.displayName}</h3>
                    <p className="text-sm text-muted">
                      {onTimeline
                        ? "This is also on your timeline because someone shared it with you."
                        : "This is not on your timeline."}
                    </p>
                  </header>
                  <div className="px-4 py-4">
                    <p className="text-sm text-muted">
                      <Link className="underline" href={`/u/${author.username}`}>@{author.username}</Link>
                      {" · "}
                      {kindLabel(post.kind)} · {formatWhen(post.createdAt)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-[17px] leading-relaxed">{post.body}</p>
                    {post.mediaLabel && post.mediaTone ? (
                      <MediaPlate kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} />
                    ) : null}
                    <p className="mt-3 text-xs text-muted">Passed along {shareCount} time{shareCount === 1 ? "" : "s"}. That count does not subscribe you.</p>
                  </div>
                  <footer className="flex items-center justify-between border-t border-rule px-4 py-3">
                    <Link className={buttonVariants({ variant: "stamp" })} href={`/share/${post.id}`}>
                      Share to keep
                    </Link>
                    <Link className="text-sm underline" href={`/post/${post.id}`}>
                      Open
                    </Link>
                  </footer>
                </article>
              );
            })}
          </section>
          <section>
            <h2 className="font-serif text-2xl">Most passed along</h2>
            <p className="mt-1 text-sm text-muted">Ordered by how many people chose to share them. Still only a Discover list.</p>
            <ul className="mt-3 grid gap-2">
              {popular.length === 0 ? <li className="text-sm text-muted">No public post has been shared yet.</li> : null}
              {popular.map(({ post, author, shareCount }) => (
                <li key={post.id} className="flex items-center justify-between gap-3 border border-rule bg-card px-3 py-2 text-sm">
                  <span>
                    {author.displayName}: {post.body.slice(0, 72)}
                  </span>
                  <Badge>{shareCount}</Badge>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-serif text-2xl">Creators with public work</h2>
            <ul className="mt-3 grid gap-2">
              {[...new Map(items.map((item) => [item.author.id, item.author])).values()].map((author) => (
                <li key={author.id}>
                  <Link className="block border border-rule bg-card px-3 py-2 text-sm hover:underline" href={`/u/${author.username}`}>
                    {author.displayName} <span className="text-muted">@{author.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
