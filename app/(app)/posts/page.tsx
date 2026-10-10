import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Camera, Layers, Repeat2, Send } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PostMedia } from "@/components/post-media";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getMyPosts } from "@/lib/social";

export default async function MyPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const posts = await getMyPosts(getDb(), user.id);

  return (
    <div>
      <PageHeader title="My Posts" subtitle="What you made, and exactly where it went." />
      <div className="grid grid-cols-1 gap-3 px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        {posts.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nothing made yet"
            action={
              <Link href="/create" className="press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-brand-on shadow-glow">
                <Camera className="h-4 w-4" aria-hidden /> Create
              </Link>
            }
          >
            Creating a post never sends it anywhere. Pick people when you’re ready.
          </EmptyState>
        ) : null}
        {posts.map(({ post, deliveries, reshares, onOwnTimeline }) => {
          const people = new Set(deliveries.map((item) => item.to_user_id)).size;
          return (
            <article key={post.id} className="surface-card overflow-hidden">
              <div className="flex gap-3.5 p-3.5">
                <Link href={`/post/${post.id}`} className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                  <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} variant="tile" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{kindLabel(post.kind)}</Badge>
                    {onOwnTimeline ? <Badge className="bg-brand-soft text-brand-strong">In your feed</Badge> : null}
                    {post.hidden ? <Badge className="bg-danger/10 text-danger">Hidden by staff</Badge> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug">{post.body}</p>
                  <p className="mt-1.5 flex items-center gap-3 text-[12.5px] font-medium text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      <Send className="h-3.5 w-3.5" aria-hidden /> {people} {people === 1 ? "person" : "people"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 className="h-3.5 w-3.5" aria-hidden /> {reshares.length} {reshares.length === 1 ? "reshare" : "reshares"}
                    </span>
                  </p>
                </div>
              </div>
              <details className="group border-t border-line/70">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-4 text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
                  Where it went
                  <ArrowRight className="ml-auto h-4 w-4 transition group-open:rotate-90" aria-hidden />
                </summary>
                <ul className="grid gap-1 px-4 pb-3.5 text-[13px] text-ink-2">
                  {deliveries.map((item) => (
                    <li key={item.id}>
                      {item.from_user_id === user.id ? "You" : item.display_name} → {item.to_user_id === user.id ? "you" : item.display_name}
                      <span className="text-ink-3">
                        {" "}
                        · {item.share_kind} · {formatWhen(item.created_at)}
                      </span>
                    </li>
                  ))}
                  {deliveries.length === 0 ? <li>Not shared with anyone yet.</li> : null}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
