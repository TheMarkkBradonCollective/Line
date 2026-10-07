import { Layers, UserRound, Users } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/avatar";
import type { User } from "@/lib/types";

type Group = { id: number; name: string; members: User[] };
type List = { id: number; name: string; members: User[] };

/** Server-rendered recipient picker for Create and the no-JS share page. Same rules as the share sheet. */
export function RecipientPicker({ friends, groups, lists, selected = [] }: { friends: User[]; groups: Group[]; lists: List[]; selected?: number[] }) {
  return (
    <div className="grid gap-5">
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
              <Avatar initials={friend.initials} color={friend.avatarColor} name={friend.displayName} size="xs" />
              <span className="text-ink">{friend.displayName}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {groups.length || lists.length ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Groups and lists</legend>
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
