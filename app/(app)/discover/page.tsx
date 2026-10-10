import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, Plus, Search } from "lucide-react";
import { followAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PostCard } from "@/components/post-card";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { friendSuggestions, getDiscover, isFollowing, listFriends } from "@/lib/social";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Discover: only what people you follow sent to their Followers. Newest first. No algorithm, no strangers. */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const db = getDb();
  const items = await getDiscover(db, user.id);

  let suggestions: User[] = [];
  if (!items.length) {
    const pool = [...(await listFriends(db, user.id)), ...(await friendSuggestions(db, user.id, 8)).map((card) => card.user)];
    const seen = new Set<number>();
    for (const person of pool) {
      if (seen.has(person.id) || person.id === user.id) continue;
      seen.add(person.id);
      if (!(await isFollowing(db, user.id, person.id))) suggestions.push(person);
    }
    suggestions = suggestions.slice(0, 6);
  }

  return (
    <div className="md:pt-2">
      <PageHeader
        kicker="Discover"
        title="From people you follow"
        subtitle="Only posts the people you follow sent to their Followers, newest first. No algorithm, no strangers."
      />
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {items.length ? (
        <div data-testid="discover-feed">
          {items.map((item) => (
            <PostCard key={item.post.id} item={{ ...item, reachedBy: null }} author={item.author} viewerId={user.id} allowDislike />
          ))}
        </div>
      ) : (
        <section className="mx-4 overflow-hidden rounded-[28px] bg-surface shadow-e1 md:mx-0 md:border md:border-line/60" data-testid="discover-empty">
          <div className="relative bg-gradient-to-br from-brand via-[#00ad83] to-[#006f53] px-6 pb-8 pt-9 text-center text-white">
            <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <circle cx="360" cy="20" r="110" fill="white" opacity="0.1" />
              <circle cx="30" cy="200" r="90" fill="black" opacity="0.08" />
            </svg>
            <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/20 ring-1 ring-white/40 backdrop-blur">
              <Compass className="h-8 w-8" aria-hidden />
            </span>
            <h2 className="relative mt-4 font-display text-[26px] font-bold leading-tight tracking-tight">Follow people to fill Discover</h2>
            <p className="relative mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-white/90">
              When someone you follow posts to their Followers, it shows up here. Following doesn’t let anyone message you, and you won’t see their friends-only posts.
            </p>
          </div>
          {suggestions.length ? (
            <ul className="divide-y divide-line/70">
              {suggestions.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">{person.displayName}</span>
                      <span className="block truncate text-[13px] text-ink-3">@{person.username}</span>
                    </span>
                  </Link>
                  <form action={followAction}>
                    <input type="hidden" name="userId" value={person.id} />
                    <input type="hidden" name="returnTo" value="/discover" />
                    <button type="submit" className="press inline-flex h-9 items-center gap-1 rounded-full bg-brand px-4 text-[13.5px] font-semibold text-brand-on">
                      <Plus className="h-4 w-4" aria-hidden /> Follow
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="p-4">
            <Link href="/search" className="press flex h-12 items-center justify-center gap-2 rounded-full bg-surface-2 text-[15px] font-semibold text-ink hover:bg-surface-3">
              <Search className="h-4 w-4" aria-hidden /> Find people to follow
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
