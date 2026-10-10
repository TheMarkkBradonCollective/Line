import Link from "next/link";
import { redirect } from "next/navigation";
import { BellOff, Plus, Users } from "lucide-react";
import { createGroupAction } from "@/app/group-actions";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { GroupPhoto } from "@/components/group-photo";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { ago } from "@/lib/format";
import { listMyCommunities } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";
import { listFriends } from "@/lib/social";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; new?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const [groups, friends] = await Promise.all([listMyCommunities(db, user.id), listFriends(db, user.id)]);
  return (
    <div>
      <PageHeader
        title="Groups"
        subtitle="Small circles with their own feed. Members only see posts shared into the group after they joined, and comment together in a members-only thread."
        action={
          <Link href="/groups?new=1#new-group" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-on">
            <Plus className="h-4 w-4" aria-hidden /> New
          </Link>
        }
      />
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        {groups.length === 0 ? (
          <EmptyState icon={Users} title="No groups yet">
            Start one with a few friends. Only members see it.
          </EmptyState>
        ) : (
          <ul className="grid gap-2" data-testid="group-list">
            {groups.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`} className="flex items-center gap-3 rounded-[20px] bg-surface p-3 shadow-e1 hover:bg-surface-2">
                  <GroupPhoto name={group.name} src={group.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                      {group.name}
                      {group.muted ? <BellOff className="h-3.5 w-3.5 text-ink-3" aria-label="Muted" /> : null}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.role}
                      {group.lastAt ? ` · active ${ago(group.lastAt)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <section id="new-group" className="mt-6 scroll-mt-24 rounded-[24px] bg-surface p-4 shadow-e1">
          <h2 className="font-display text-lg font-bold tracking-tight">Start a group</h2>
          <p className="text-[13px] text-ink-3">You can add your friends. Admins can add more of their own friends later.</p>
          <form action={createGroupAction} className="mt-3 grid gap-3">
            <input className="field" name="name" required maxLength={60} placeholder="Group name" aria-label="Group name" autoFocus={query.new === "1"} />
            <input className="field" name="about" maxLength={300} placeholder="What’s it for? (optional)" aria-label="About" />
            {friends.length ? (
              <fieldset>
                <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Add friends</legend>
                <div className="flex flex-wrap gap-2">
                  {friends.map((friend) => (
                    <label key={friend.id} className="pick chip min-h-[44px] cursor-pointer pl-1.5 pr-3.5">
                      <input type="checkbox" name="member" value={friend.id} className="sr-only" />
                      <Avatar initials={friend.initials} color={friend.avatarColor} src={friend.avatarUrl} name={friend.displayName} size="xs" />
                      {friend.displayName}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-[13px] text-ink-3">Add friends first, then bring them in.</p>
            )}
            <Button type="submit">Create group</Button>
          </form>
        </section>
      </div>
    </div>
  );
}
