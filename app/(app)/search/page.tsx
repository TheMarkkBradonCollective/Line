import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UserCheck, UserPlus, Users } from "lucide-react";
import { requestFriendAction } from "@/app/actions";
import { Avatar, AvatarStack } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { friendSuggestions, searchPeople } from "@/lib/social";

/** People search by name. There is no content search and no discover feed. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; notice?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const q = (query.q ?? "").slice(0, 60);
  const db = getDb();
  const results = q.trim() ? searchPeople(db, user.id, q) : [];
  const suggestions = q.trim() ? [] : friendSuggestions(db, user.id, 6);
  const returnTo = q ? `/search?q=${encodeURIComponent(q)}` : "/search";

  const cards = q.trim() ? results : suggestions;

  return (
    <div>
      <PageHeader title="Find people" subtitle="Search by name. LINE searches people only, never posts." />
      <form action="/search" method="get" className="mx-4 md:mx-0" role="search">
        <label className="relative block">
          <span className="sr-only">Search people by name</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field rounded-full pl-10" name="q" defaultValue={q} placeholder="Search people by name" autoComplete="off" autoFocus={!q} />
        </label>
      </form>
      <div className="mt-3 px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <section className="mt-4 px-4 md:px-0">
        <h2 className="mb-2 font-display text-lg font-bold tracking-tight">{q.trim() ? `People named “${q}”` : "People you may know"}</h2>
        {cards.length === 0 ? (
          <EmptyState icon={Users} title={q.trim() ? "No one by that name" : "No suggestions yet"}>
            {q.trim() ? "Try a first name or a username." : "Suggestions come from friends of your friends."}
          </EmptyState>
        ) : (
          <ul className="surface-card divide-y divide-line/70 overflow-hidden" data-testid="people-results">
            {cards.map(({ user: person, mutual, relationship }) => (
              <li key={person.id} className="flex min-h-[68px] items-center gap-3 px-4 py-2.5">
                <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink">
                  <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{person.displayName}</span>
                    <span className="flex items-center gap-1.5 truncate text-[13px] text-ink-3">
                      {mutual.length ? <AvatarStack people={mutual.slice(0, 2)} size="xs" max={2} /> : null}
                      {relationship === "friends"
                        ? "Friend"
                        : mutual.length
                          ? `${mutual.length} mutual ${mutual.length === 1 ? "friend" : "friends"}`
                          : person.location || `@${person.username}`}
                    </span>
                  </span>
                </Link>
                {relationship === "none" ? (
                  <form action={requestFriendAction}>
                    <input type="hidden" name="username" value={person.username} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" aria-label={`Add ${person.displayName} as a friend`} className="press inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-soft px-3 text-[13px] font-semibold text-brand-strong">
                      <UserPlus className="h-4 w-4" aria-hidden /> Add
                    </button>
                  </form>
                ) : relationship === "friends" ? (
                  <UserCheck className="h-5 w-5 text-brand-strong" aria-label="Friends" />
                ) : relationship === "outgoing" ? (
                  <span className="text-[12.5px] font-semibold text-ink-3">Requested</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-ink-3">Opening a profile shows who they are. Their posts appear only if they were shared with you.</p>
      </section>
    </div>
  );
}
