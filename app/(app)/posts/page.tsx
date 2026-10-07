import Link from "next/link";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getMyPosts } from "@/lib/social";
import { redirect } from "next/navigation";

export default async function MyPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const posts = getMyPosts(getDb(), user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="kicker">My Posts</p>
      <h1 className="mt-1 font-serif text-4xl">What you made, and where it went</h1>
      <p className="mt-2 text-sm text-muted">
        Creating a post does not publish it to the world. This page shows who received it and who passed it on.
      </p>
      <div className="mt-4">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <div className="grid gap-4">
        {posts.length === 0 ? <p className="text-sm text-muted">You have not created anything.</p> : null}
        {posts.map(({ post, deliveries, reshares, onOwnTimeline }) => (
          <article key={post.id} className="desk-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{kindLabel(post.kind)}</Badge>
              {post.listedOnDiscover ? <Badge>Discover</Badge> : <Badge>Not public</Badge>}
              {onOwnTimeline ? <Badge>On your timeline</Badge> : <Badge>Not on your timeline</Badge>}
              {post.hidden ? <Badge>Hidden by staff</Badge> : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap">{post.body}</p>
            <p className="mt-3 text-sm">
              Shared with {new Set(deliveries.map((item) => item.to_user_id)).size}{" "}
              {new Set(deliveries.map((item) => item.to_user_id)).size === 1 ? "person" : "people"}. Reshared {reshares.length}{" "}
              {reshares.length === 1 ? "time" : "times"}.
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-muted">
              {deliveries.map((item) => (
                <li key={item.id}>
                  {item.from_user_id === user.id ? "You" : item.display_name} → {item.to_user_id === user.id ? "you" : item.display_name} · {item.share_kind} · {formatWhen(item.created_at)}
                </li>
              ))}
              {deliveries.length === 0 ? <li>Not shared with anyone. {post.listedOnDiscover ? "It sits on Discover only." : "It has no audience yet."}</li> : null}
            </ul>
            <Link className="mt-3 inline-block text-sm underline" href={`/post/${post.id}`}>
              Open
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
