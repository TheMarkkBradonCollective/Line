import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, Eye, Inbox, Layers, Lock, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import {
  acceptFriendAction,
  blockAction,
  createGroupAction,
  createListAction,
  declineFriendAction,
  deleteGroupAction,
  deleteListAction,
  removeFriendAction,
  requestFriendAction,
  unblockAction,
  updatePrivacyAction,
} from "@/app/actions";
import { Avatar, AvatarStack } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  friendSuggestions,
  listAllowIds,
  listBlocks,
  listCustomLists,
  listFriends,
  listGroups,
  mutualFriends,
  pendingIncoming,
  pendingOutgoing,
} from "@/lib/social";
import type { User } from "@/lib/types";

type Tab = "friends" | "requests" | "groups" | "privacy";

function Tabs({ tab, requests }: { tab: Tab; requests: number }) {
  const items: [Tab, string][] = [
    ["friends", "Friends"],
    ["requests", "Requests"],
    ["groups", "Groups"],
    ["privacy", "Privacy"],
  ];
  return (
    <nav className="segmented mx-4 md:mx-0" aria-label="Friends sections">
      {items.map(([id, label]) => (
        <Link key={id} href={id === "friends" ? "/friends" : `/friends?tab=${id}`} aria-current={tab === id ? "page" : undefined} scroll={false}>
          {label}
          {id === "requests" && requests ? (
            <span className="min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-brand-on">{requests}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

function PersonRow({ person, children, sub }: { person: User; children?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
      <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink">
        <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{person.displayName}</span>
          <span className="block truncate text-[13px] text-ink-3">{sub ?? `@${person.username}`}</span>
        </span>
      </Link>
      {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
    </div>
  );
}

function Choice({ name, value, label, hint, checked, type = "radio" }: { name: string; value: string | number; label: string; hint?: string; checked: boolean; type?: "radio" | "checkbox" }) {
  return (
    <label className="pick flex min-h-[52px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
      <input type={type} name={name} value={value} defaultChecked={checked} />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        {hint ? <span className="block text-[12.5px] text-ink-3">{hint}</span> : null}
      </span>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-4 md:px-0">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint ? <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MemberPicker({ friends }: { friends: User[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {friends.map((friend) => (
        <label key={friend.id} className="pick chip cursor-pointer pl-1">
          <input type="checkbox" name="member" value={friend.id} className="sr-only" />
          <Avatar initials={friend.initials} color={friend.avatarColor} name={friend.displayName} size="xs" />
          {friend.displayName.split(" ")[0]}
        </label>
      ))}
    </div>
  );
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const tab: Tab = (["friends", "requests", "groups", "privacy"] as const).find((id) => id === query.tab) ?? "friends";
  const db = getDb();
  const friends = await listFriends(db, user.id);
  const groups = await listGroups(db, user.id);
  const lists = await listCustomLists(db, user.id);
  const incoming = await pendingIncoming(db, user.id);
  const outgoing = await pendingOutgoing(db, user.id);
  const blocks = await listBlocks(db, user.id);
  const allowIds = await listAllowIds(db, user.id);
  const suggestions = tab === "friends" ? await friendSuggestions(db, user.id, 6) : [];
  const mutualCounts = new Map<number, number>();
  await Promise.all(
    [...friends, ...incoming.map((item) => item.user)].map(async (person) => {
      mutualCounts.set(person.id, (await mutualFriends(db, user.id, person.id)).length);
    }),
  );
  const mutualLine = (person: User) => {
    const count = mutualCounts.get(person.id) ?? 0;
    return count ? `${count} mutual ${count === 1 ? "friend" : "friends"}` : `@${person.username}`;
  };

  return (
    <div>
      <PageHeader
        title="Friends"
        subtitle="Being friends never puts their posts in your feed. It only means they’re allowed to share with you."
      />
      <Tabs tab={tab} requests={incoming.length} />
      <div className="mt-4 px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>

      {tab === "friends" ? (
        <>
          <form action="/search" method="get" className="mx-4 md:mx-0" role="search">
            <label className="relative block">
              <span className="sr-only">Search people by name</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input className="field rounded-full pl-10" name="q" placeholder="Search people by name" autoComplete="off" />
            </label>
          </form>

          {incoming.length ? (
            <Section title={`Friend requests · ${incoming.length}`}>
              <div className="surface-card divide-y divide-line/70 overflow-hidden">
                {incoming.map((request) => (
                  <PersonRow key={request.requestId} person={request.user} sub={mutualLine(request.user)}>
                    <form action={acceptFriendAction}>
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <Button type="submit" size="sm">
                        Confirm
                      </Button>
                    </form>
                    <form action={declineFriendAction}>
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <button type="submit" className="press h-9 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink-2">
                        Delete
                      </button>
                    </form>
                  </PersonRow>
                ))}
              </div>
            </Section>
          ) : null}

          {suggestions.length ? (
            <Section title="People you may know" hint="Friends of your friends. Suggestions are people only, never posts.">
              <ul className="no-scrollbar relative -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" data-testid="suggestions">
                {suggestions.map(({ user: person, mutual }) => (
                  <li key={person.id} className="surface-card flex w-[156px] shrink-0 flex-col items-center p-3.5 text-center">
                    <Link href={`/u/${person.username}`} className="flex flex-col items-center text-ink">
                      <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="lg" />
                      <span className="mt-2 line-clamp-1 text-[14.5px] font-semibold">{person.displayName}</span>
                    </Link>
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-3">
                      <AvatarStack people={mutual.slice(0, 2)} size="xs" max={2} />
                      {mutual.length} mutual
                    </span>
                    <form action={requestFriendAction} className="mt-3 w-full">
                      <input type="hidden" name="username" value={person.username} />
                      <input type="hidden" name="returnTo" value="/friends" />
                      <button type="submit" className="press inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-soft text-[13.5px] font-semibold text-brand-strong hover:bg-brand-tint">
                        <UserPlus className="h-4 w-4" aria-hidden /> Add friend
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title={`Your friends · ${friends.length}`}>
            {friends.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No friends yet"
                action={
                  <Link href="/search" className="press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-brand-on shadow-glow">
                    Find people
                  </Link>
                }
              >
                Search for people by name, or add someone by their username. They’ll get a request.
              </EmptyState>
            ) : (
              <div className="surface-card divide-y divide-line/70 overflow-hidden">
                {friends.map((friend) => (
                  <PersonRow key={friend.id} person={friend} sub={mutualLine(friend)}>
                    {friend.whoCanShare === "nobody" ? (
                      <span className="hidden items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-3 sm:inline-flex">
                        <Lock className="h-3 w-3" aria-hidden /> No shares
                      </span>
                    ) : null}
                    <form action={removeFriendAction}>
                      <input type="hidden" name="userId" value={friend.id} />
                      <button type="submit" className="press h-9 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink-2 hover:text-ink">
                        Remove
                      </button>
                    </form>
                    <form action={blockAction}>
                      <input type="hidden" name="userId" value={friend.id} />
                      <input type="hidden" name="returnTo" value="/friends" />
                      <button type="submit" aria-label={`Block ${friend.displayName}`} className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger">
                        <Ban className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                  </PersonRow>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {tab === "requests" ? (
        <>
          <Section title="Asking you">
            {incoming.length === 0 ? (
              <EmptyState icon={Inbox} title="No requests">
                When someone asks to be friends, it shows up here.
              </EmptyState>
            ) : (
              <div className="surface-card divide-y divide-line/70 overflow-hidden">
                {incoming.map((request) => (
                  <PersonRow key={request.requestId} person={request.user}>
                    <form action={acceptFriendAction}>
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <input type="hidden" name="tab" value="requests" />
                      <Button type="submit" size="sm">
                        Accept
                      </Button>
                    </form>
                    <form action={declineFriendAction}>
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <input type="hidden" name="tab" value="requests" />
                      <button type="submit" aria-label="Decline" className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                  </PersonRow>
                ))}
              </div>
            )}
          </Section>
          <Section title="You asked">
            {outgoing.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing pending.</p>
            ) : (
              <div className="surface-card divide-y divide-line/70 overflow-hidden">
                {outgoing.map((request) => (
                  <PersonRow key={request.requestId} person={request.user}>
                    <form action={declineFriendAction}>
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <input type="hidden" name="tab" value="requests" />
                      <button type="submit" className="press h-9 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink-2">
                        Cancel
                      </button>
                    </form>
                  </PersonRow>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {tab === "groups" ? (
        <>
          <Section title="Groups" hint="Pick a whole group at once when you share. A group never gets posts on its own.">
            <div className="grid grid-cols-1 gap-2.5">
              {groups.map((group) => (
                <div key={group.id} className="surface-card flex items-center gap-3 p-3.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
                    <Users className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{group.name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">{group.members.map((member) => member.displayName).join(", ") || "No members"}</p>
                  </div>
                  <AvatarStack people={group.members} size="xs" />
                  <form action={deleteGroupAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="tab" value="groups" />
                    <button type="submit" aria-label={`Delete ${group.name}`} className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                </div>
              ))}
              {groups.length === 0 ? <p className="text-sm text-ink-3">No groups yet.</p> : null}
              <form action={createGroupAction} className="grid gap-3 rounded-3xl border border-dashed border-line p-4">
                <input type="hidden" name="tab" value="groups" />
                <input className="field" name="name" placeholder="New group name" aria-label="Group name" />
                <MemberPicker friends={friends} />
                <label className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
                  <input type="checkbox" name="allows_inbound" defaultChecked />
                  Members may share with me when my setting is “groups”
                </label>
                <Button type="submit" variant="soft">
                  Create group
                </Button>
              </form>
            </div>
          </Section>
          <Section title="Lists" hint="Lists are for picking recipients. Not an audience.">
            <div className="grid grid-cols-1 gap-2.5">
              {lists.map((list) => (
                <div key={list.id} className="surface-card flex items-center gap-3 p-3.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
                    <Layers className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{list.name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">{list.members.map((member) => member.displayName).join(", ") || "Empty"}</p>
                  </div>
                  <form action={deleteListAction}>
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="tab" value="groups" />
                    <button type="submit" aria-label={`Delete ${list.name}`} className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                </div>
              ))}
              <form action={createListAction} className="grid gap-3 rounded-3xl border border-dashed border-line p-4">
                <input type="hidden" name="tab" value="groups" />
                <input className="field" name="name" placeholder="New list name" aria-label="List name" />
                <MemberPicker friends={friends} />
                <Button type="submit" variant="soft">
                  Create list
                </Button>
              </form>
            </div>
          </Section>
        </>
      ) : null}

      {tab === "privacy" ? (
        <>
          <form action={updatePrivacyAction} className="grid">
            <input type="hidden" name="tab" value="privacy" />
            <div className="mx-4 mt-2 flex items-start gap-2.5 rounded-2xl bg-brand-soft px-3.5 py-3 text-[13.5px] text-ink md:mx-0">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
              <span>
                Your profile (name, photo, bio, About, friends) is visible to everyone signed in. Your posts never are: each one is seen only by
                the people it was shared with. Block someone to close your profile to them.
              </span>
            </div>
            <Section title="Who can share with you" hint="This is the gate. Anyone outside it can’t share a post with you, even if they find your profile.">
              <div className="grid grid-cols-1 gap-2">
                <Choice name="whoCanShare" value="friends" label="Friends" checked={user.whoCanShare === "friends"} />
                <Choice name="whoCanShare" value="groups" label="Only certain groups" hint="Pick them below" checked={user.whoCanShare === "groups"} />
                <Choice name="whoCanShare" value="allow_list" label="Only people I choose" hint="Check them below" checked={user.whoCanShare === "allow_list"} />
                <Choice name="whoCanShare" value="nobody" label="Nobody — I’m not accepting shares" hint="Your feed only shows what you make" checked={user.whoCanShare === "nobody"} />
              </div>
            </Section>
            <Section title="Groups that may share with you">
              {groups.length === 0 ? <p className="text-sm text-ink-3">Make a group first.</p> : null}
              <div className="grid grid-cols-1 gap-2">
                {groups.map((group) => (
                  <Choice key={group.id} type="checkbox" name="inbound_group" value={group.id} label={group.name} checked={group.allows_inbound_share === 1} />
                ))}
              </div>
            </Section>
            <Section title="Allow list">
              <div className="flex flex-wrap gap-2">
                {friends.map((friend) => (
                  <label key={friend.id} className="pick chip cursor-pointer pl-1">
                    <input type="checkbox" name="allow" value={friend.id} defaultChecked={allowIds.has(friend.id)} className="sr-only" />
                    <Avatar initials={friend.initials} color={friend.avatarColor} name={friend.displayName} size="xs" />
                    {friend.displayName}
                  </label>
                ))}
              </div>
            </Section>
            <Section title="Who can add you">
              <div className="grid grid-cols-1 gap-2">
                <Choice name="whoCanAdd" value="everyone" label="Anyone" checked={user.whoCanAdd === "everyone"} />
                <Choice name="whoCanAdd" value="friends_of_friends" label="Friends of friends" checked={user.whoCanAdd === "friends_of_friends"} />
                <Choice name="whoCanAdd" value="nobody" label="Nobody" checked={user.whoCanAdd === "nobody"} />
              </div>
            </Section>
            <Section title="Who can reshare what you made">
              <div className="grid grid-cols-1 gap-2">
                <Choice name="whoCanReshare" value="recipients" label="People it was shared with" checked={user.whoCanReshare === "recipients"} />
                <Choice name="whoCanReshare" value="friends" label="Only my friends" checked={user.whoCanReshare === "friends"} />
                <Choice name="whoCanReshare" value="nobody" label="Nobody" checked={user.whoCanReshare === "nobody"} />
              </div>
            </Section>
            <div className="mt-6 px-4 md:px-0">
              <Button type="submit" className="w-full">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Save privacy
              </Button>
            </div>
          </form>
          <Section title="Blocked">
            {blocks.length === 0 ? (
              <p className="text-sm text-ink-3">No one is blocked.</p>
            ) : (
              <div className="surface-card divide-y divide-line/70 overflow-hidden">
                {blocks.map((person) => (
                  <PersonRow key={person.id} person={person}>
                    <form action={unblockAction}>
                      <input type="hidden" name="userId" value={person.id} />
                      <input type="hidden" name="tab" value="privacy" />
                      <button type="submit" className="press h-9 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink-2">
                        Unblock
                      </button>
                    </form>
                  </PersonRow>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
