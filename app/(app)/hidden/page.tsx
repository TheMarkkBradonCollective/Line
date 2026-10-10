import Link from "next/link";
import { redirect } from "next/navigation";
import { EyeOff } from "lucide-react";
import { unhideFormAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listHidden } from "@/lib/social";

export const dynamic = "force-dynamic";

/** Settings → Hidden. People and posts you hid from Home and Discover. Only you see this list. */
export default async function HiddenPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { people, posts } = await listHidden(getDb(), user.id);
  return (
    <div>
      <PageHeader kicker="Settings" title="Hidden" subtitle="Hidden people and disliked posts stay out of your Home and Discover. It isn’t a block, and nobody is told." />
      <div className="px-4 md:px-0"><Notice notice={query.notice} error={query.error} /></div>
      <section className="surface-card mx-4 overflow-hidden md:mx-0" data-testid="hidden-people">
        <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">People · {people.length}</h2>
        {people.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-3">You haven’t hidden anyone.</p> : null}
        <ul className="divide-y divide-line/70">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{person.displayName}</span>
                  <span className="block truncate text-[13px] text-ink-3">All posts hidden</span>
                </span>
              </Link>
              <form action={unhideFormAction}>
                <input type="hidden" name="authorId" value={person.id} />
                <button type="submit" className="press h-9 rounded-full bg-surface-2 px-4 text-[13.5px] font-semibold text-ink hover:bg-surface-3">Unhide</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-card mx-4 mt-3 overflow-hidden md:mx-0" data-testid="hidden-posts">
        <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">Disliked posts · {posts.length}</h2>
        {posts.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-3">No disliked posts.</p> : null}
        <ul className="divide-y divide-line/70">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 px-4 py-3">
              <EyeOff className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
              <Link href={`/post/${post.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] text-ink">{post.body || "(no text)"}</span>
                <span className="block truncate text-[12.5px] text-ink-3">{post.author?.displayName ?? "Someone"}</span>
              </Link>
              <form action={unhideFormAction}>
                <input type="hidden" name="postId" value={post.id} />
                <button type="submit" className="press h-9 rounded-full bg-surface-2 px-4 text-[13.5px] font-semibold text-ink hover:bg-surface-3">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
