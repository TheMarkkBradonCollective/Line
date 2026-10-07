import Link from "next/link";
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
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listAllowIds, listBlocks, listCustomLists, listFriends, listGroups, pendingIncoming, pendingOutgoing } from "@/lib/social";
import { redirect } from "next/navigation";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const friends = listFriends(db, user.id);
  const groups = listGroups(db, user.id);
  const lists = listCustomLists(db, user.id);
  const incoming = pendingIncoming(db, user.id);
  const outgoing = pendingOutgoing(db, user.id);
  const blocks = listBlocks(db, user.id);
  const allowIds = listAllowIds(db, user.id);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div>
        <p className="kicker">Friends</p>
        <h1 className="mt-1 font-serif text-4xl">People, groups, and who may share with you</h1>
        <p className="mt-2 text-sm text-muted">
          Being friends does not put their posts on your timeline. It only means they are allowed to share, if your setting says so.
        </p>
        <div className="mt-4">
          <Notice notice={query.notice} error={query.error} />
        </div>
      </div>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Requests</h2>
        {incoming.length === 0 && outgoing.length === 0 ? <p className="text-sm text-muted">No open requests.</p> : null}
        {incoming.map((request) => (
          <div key={request.requestId} className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-card px-3 py-3 text-sm">
            <p>
              <Link className="font-medium underline" href={`/u/${request.user.username}`}>{request.user.displayName}</Link> wants to be friends.
            </p>
            <div className="flex gap-2">
              <form action={acceptFriendAction}>
                <input type="hidden" name="requestId" value={request.requestId} />
                <Button type="submit" size="sm" variant="pine">Accept</Button>
              </form>
              <form action={declineFriendAction}>
                <input type="hidden" name="requestId" value={request.requestId} />
                <Button type="submit" size="sm" variant="outline">Decline</Button>
              </form>
            </div>
          </div>
        ))}
        {outgoing.map((request) => (
          <div key={request.requestId} className="flex items-center justify-between gap-3 border border-rule bg-card px-3 py-3 text-sm">
            <p>Waiting on {request.user.displayName}.</p>
            <form action={declineFriendAction}>
              <input type="hidden" name="requestId" value={request.requestId} />
              <Button type="submit" size="sm" variant="ghost">Cancel</Button>
            </form>
          </div>
        ))}
        <form action={requestFriendAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="returnTo" value="/friends" />
          <input className="field max-w-xs" name="username" placeholder="username" aria-label="Username to add" />
          <Button type="submit">Send request</Button>
        </form>
      </section>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">Your friends</h2>
        {friends.length === 0 ? <p className="text-sm text-muted">No friends yet.</p> : null}
        {friends.map((friend) => (
          <div key={friend.id} className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-card px-3 py-2 text-sm">
            <Link className="underline" href={`/u/${friend.username}`}>
              {friend.displayName} <span className="text-muted">@{friend.username}</span>
            </Link>
            <div className="flex gap-2">
              <form action={removeFriendAction}>
                <input type="hidden" name="userId" value={friend.id} />
                <Button type="submit" size="sm" variant="ghost">Remove</Button>
              </form>
              <form action={blockAction}>
                <input type="hidden" name="userId" value={friend.id} />
                <input type="hidden" name="returnTo" value="/friends" />
                <Button type="submit" size="sm" variant="outline">Block</Button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Who can share with you</h2>
        <p className="text-sm text-muted">This is the gate. A person who fails it cannot place a post on your timeline, even if they found your profile.</p>
        <form action={updatePrivacyAction} className="grid gap-4 border border-rule bg-card p-4">
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Who can share with you</legend>
            {[
              ["friends", "Friends"],
              ["groups", "Only people in groups you mark below"],
              ["allow_list", "Only people you check below"],
              ["nobody", "Nobody. Your timeline stays quiet."],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="whoCanShare" value={value} defaultChecked={user.whoCanShare === value} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Groups that may share with you</legend>
            {groups.length === 0 ? <p className="text-muted">Make a group first.</p> : null}
            {groups.map((group) => (
              <label key={group.id} className="flex items-center gap-2">
                <input type="checkbox" name="inbound_group" value={group.id} defaultChecked={group.allows_inbound_share === 1} />
                {group.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Allow list</legend>
            {friends.map((friend) => (
              <label key={friend.id} className="flex items-center gap-2">
                <input type="checkbox" name="allow" value={friend.id} defaultChecked={allowIds.has(friend.id)} />
                {friend.displayName}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Who can add you as a friend</legend>
            {[
              ["everyone", "Anyone"],
              ["friends_of_friends", "Friends of friends"],
              ["nobody", "Nobody"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="whoCanAdd" value={value} defaultChecked={user.whoCanAdd === value} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Who can reshare what you made</legend>
            {[
              ["recipients", "People it was shared with, and anyone if it is on Discover"],
              ["friends", "Only your friends"],
              ["nobody", "Nobody"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="whoCanReshare" value={value} defaultChecked={user.whoCanReshare === value} />
                {label}
              </label>
            ))}
          </fieldset>
          <Button type="submit" variant="pine">Save privacy</Button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Groups</h2>
        {groups.map((group) => (
          <div key={group.id} className="border border-rule bg-card px-3 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{group.name}</p>
              <form action={deleteGroupAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit" size="sm" variant="ghost">Delete</Button>
              </form>
            </div>
            <p className="text-muted">{group.members.map((member) => member.displayName).join(", ") || "No members"}</p>
          </div>
        ))}
        <form action={createGroupAction} className="grid gap-2 border border-dashed border-rule p-3">
          <input className="field" name="name" placeholder="Group name" aria-label="Group name" />
          <div className="grid gap-1 text-sm">
            {friends.map((friend) => (
              <label key={friend.id} className="flex items-center gap-2">
                <input type="checkbox" name="member" value={friend.id} />
                {friend.displayName}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allows_inbound" defaultChecked />
            Members of this group may share with me when my setting is “groups”
          </label>
          <Button type="submit" variant="outline">Create group</Button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Custom lists</h2>
        <p className="text-sm text-muted">Lists are for choosing recipients when you share. They are not an audience that gets posts automatically.</p>
        {lists.map((list) => (
          <div key={list.id} className="flex items-center justify-between gap-3 border border-rule bg-card px-3 py-2 text-sm">
            <p>
              <span className="font-medium">{list.name}</span>
              <span className="text-muted"> — {list.members.map((member) => member.displayName).join(", ") || "empty"}</span>
            </p>
            <form action={deleteListAction}>
              <input type="hidden" name="listId" value={list.id} />
              <Button type="submit" size="sm" variant="ghost">Delete</Button>
            </form>
          </div>
        ))}
        <form action={createListAction} className="grid gap-2 border border-dashed border-rule p-3">
          <input className="field" name="name" placeholder="List name" aria-label="List name" />
          <div className="grid gap-1 text-sm">
            {friends.map((friend) => (
              <label key={friend.id} className="flex items-center gap-2">
                <input type="checkbox" name="member" value={friend.id} />
                {friend.displayName}
              </label>
            ))}
          </div>
          <Button type="submit" variant="outline">Create list</Button>
        </form>
      </section>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">Blocked</h2>
        {blocks.length === 0 ? <p className="text-sm text-muted">No blocks.</p> : null}
        {blocks.map((person) => (
          <div key={person.id} className="flex items-center justify-between border border-rule bg-card px-3 py-2 text-sm">
            <span>{person.displayName}</span>
            <form action={unblockAction}>
              <input type="hidden" name="userId" value={person.id} />
              <Button type="submit" size="sm" variant="outline">Unblock</Button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
