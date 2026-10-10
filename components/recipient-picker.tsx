import { Layers, Rss, UserRound, Users } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/avatar";
import type { User } from "@/lib/types";

type Group = { id: number; name: string; members: User[] };
type List = { id: number; name: string; members: User[] };

/** Server-rendered recipient picker for Create and the no-JS share page. Same rules as the share sheet. */
export function RecipientPicker({
  friends,
  groups,
  lists,
  selected = [],
  followers = null,
  communities = [],
  selectedCommunity = null,
}: {
  communities?: { id: number; name: string; memberCount: number }[];
  selectedCommunity?: number | null;
  friends: User[];
  groups: Group[];
  lists: List[];
  selected?: number[];
  /** Shown only for the post's author. Null hides the Followers audience. */
  followers?: { count: number; alreadySent?: boolean } | null;
}) {
  return (
    <div className="grid gap-5">
      {followers ? (
        <label className="pick flex min-h-[64px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60" data-testid="audience-followers">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-[rgb(var(--surface))]">
            <Rss className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              Followers <span className="font-normal text-ink-3">· {followers.count}</span>
            </span>
            <span className="block text-[12.5px] text-ink-3">
              {followers.alreadySent ? "Already sent to your followers." : "Everyone who follows you, now and later. Shows in their Discover."}
            </span>
          </span>
          <input type="checkbox" name="followers" disabled={followers.alreadySent} />
        </label>
      ) : null}
      {communities.length ? (
        <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="audience-groups">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Post in a group</legend>
          {communities.map((group) => (
            <label key={`c${group.id}`} className="pick flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0ea5a4] text-white">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{group.name}</span>
                <span className="block text-[12.5px] text-ink-3">{group.memberCount} members · members see it in the group feed</span>
              </span>
              <input type="checkbox" name="community" value={group.id} defaultChecked={selectedCommunity === group.id} />
            </label>
          ))}
        </fieldset>
      ) : null}
      <label className="pick flex min-h-[64px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-white">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Just me</span>
          <span className="block text-[12.5px] text-ink-3">It stays on your profile and in your feed. Pick people to share it.</span>
        </span>
        <input type="checkbox" name="self" />
      </label>

      <fieldset>
        <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Friends</legend>
        {friends.length === 0 ? <p className="text-sm text-ink-3">No friends yet.</p> : null}
        <div className="flex flex-wrap gap-2">
          {friends.map((friend) => (
            <label key={friend.id} className="pick chip min-h-[44px] cursor-pointer pl-1.5 pr-3.5">
              <input type="checkbox" name="friend" value={friend.id} defaultChecked={selected.includes(friend.id)} className="sr-only" />
              <Avatar initials={friend.initials} color={friend.avatarColor} src={friend.avatarUrl} name={friend.displayName} size="xs" />
              <span className="text-ink">{friend.displayName}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {groups.length || lists.length ? (
        <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Share circles and lists</legend>
          {groups.map((group) => (
            <label key={`g${group.id}`} className="pick flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
              <input type="checkbox" name="group" value={group.id} />
              <Users className="h-4 w-4 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{group.name}</span>
                <span className="block truncate text-[12.5px] text-ink-3">
                  {group.members.length ? group.members.map((member) => member.displayName).join(", ") : "Empty group"}
                </span>
              </span>
              <AvatarStack people={group.members} size="xs" />
            </label>
          ))}
          {lists.map((list) => (
            <label key={`l${list.id}`} className="pick flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
              <input type="checkbox" name="list" value={list.id} />
              <Layers className="h-4 w-4 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{list.name}</span>
                <span className="block truncate text-[12.5px] text-ink-3">
                  {list.members.length ? list.members.map((member) => member.displayName).join(", ") : "Empty list"}
                </span>
              </span>
              <AvatarStack people={list.members} size="xs" />
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
