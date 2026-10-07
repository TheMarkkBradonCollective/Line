import type { User } from "@/lib/types";

type Group = { id: number; name: string; members: User[] };
type List = { id: number; name: string; members: User[] };

export function RecipientPicker({
  friends,
  groups,
  lists,
}: {
  friends: User[];
  groups: Group[];
  lists: List[];
}) {
  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted">
        Sharing puts this on their timeline. It does not open a message thread. Nothing here is delivered because of a recommendation.
      </p>
      <label className="flex items-start gap-3 border border-pine bg-card p-3">
        <input className="mt-1" type="checkbox" name="self" />
        <span>
          <span className="block font-medium">My own timeline</span>
          <span className="text-sm text-muted">You will see it there. No one else will, unless you also choose them.</span>
        </span>
      </label>
      <fieldset className="grid gap-2">
        <legend className="kicker mb-2">Friends</legend>
        {friends.length === 0 ? <p className="text-sm text-muted">No friends yet.</p> : null}
        {friends.map((friend) => (
          <label key={friend.id} className="flex items-center gap-3 border border-rule bg-card px-3 py-2 text-sm">
            <input type="checkbox" name="friend" value={friend.id} />
            <span>
              {friend.displayName} <span className="text-muted">@{friend.username}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="kicker mb-2">Friend groups</legend>
        {groups.length === 0 ? <p className="text-sm text-muted">No groups yet. Make one from Friends.</p> : null}
        {groups.map((group) => (
          <label key={group.id} className="flex items-start gap-3 border border-rule bg-card px-3 py-2 text-sm">
            <input className="mt-1" type="checkbox" name="group" value={group.id} />
            <span>
              <span className="block font-medium">{group.name}</span>
              <span className="text-muted">
                {group.members.length ? group.members.map((member) => member.displayName).join(", ") : "Empty group"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="kicker mb-2">Custom lists</legend>
        {lists.length === 0 ? <p className="text-sm text-muted">No lists yet. Lists are only for sharing.</p> : null}
        {lists.map((list) => (
          <label key={list.id} className="flex items-start gap-3 border border-rule bg-card px-3 py-2 text-sm">
            <input className="mt-1" type="checkbox" name="list" value={list.id} />
            <span>
              <span className="block font-medium">{list.name}</span>
              <span className="text-muted">
                {list.members.length ? list.members.map((member) => member.displayName).join(", ") : "Empty list"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
