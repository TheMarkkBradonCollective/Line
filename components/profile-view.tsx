import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { blockAction, requestFriendAction, ticketAction, updateProfileAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { LoopMedia } from "@/components/loop-media";
import { Notice } from "@/components/notice";
import { ReportForm } from "@/components/report-form";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import {
  AVATAR_COLORS,
  friendIds,
  getUserByUsername,
  listFriends,
  postsVisibleTo,
  profileStats,
  relationship,
  sentActivity,
} from "@/lib/social";

export async function ProfileView({
  username,
  notice,
  error,
}: {
  username: string;
  notice?: string;
  error?: string;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");
  const db = getDb();
  const person = getUserByUsername(db, username);
  if (!person) notFound();
  const rel = relationship(db, viewer.id, person.id);
  const self = rel === "self";
  const friends = listFriends(db, person.id);
  const grid = rel === "blocked" || rel === "blocked_by" ? [] : postsVisibleTo(db, viewer.id, person.id);
  const stats = profileStats(db, viewer.id, person.id);
  const activity = self ? sentActivity(db, person.id) : [];

  if (rel === "blocked_by") {
    return (
      <div className="px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">This profile is not available.</h1>
        <p className="mt-2 text-sm text-muted">A block is in the way.</p>
      </div>
    );
  }

  return (
    <div>
      <Notice notice={notice} error={error} />
      <div className="relative">
        <div className="h-28 bg-pine" />
        <div className="px-4">
          <div className="-mt-12">
            <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="lg" />
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-none">{person.displayName}</h1>
          <p className="text-sm font-bold text-muted">@{person.username}</p>
          {person.role !== "user" ? (
            <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-muted">{ROLE_LABELS[person.role as Role] ?? person.role}</p>
          ) : null}
          <p className="mt-2 text-sm font-semibold leading-relaxed">{person.bio}</p>
          <dl className="mt-4 grid grid-cols-3 text-center">
            {[
              ["Friends", stats.friends],
              ["Posts", stats.posts],
              ["Shares", stats.shares],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="font-display text-2xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {!self && rel !== "blocked" ? (
        <div className="mt-4 flex flex-wrap gap-2 px-4">
          {rel === "none" ? (
            <form action={requestFriendAction}>
              <input type="hidden" name="username" value={person.username} />
              <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
              <Button type="submit">Add friend</Button>
            </form>
          ) : null}
          {rel === "outgoing" ? <p className="text-sm font-bold text-muted">Friend request sent.</p> : null}
          {rel === "incoming" ? <p className="text-sm font-bold text-muted">They already asked. Answer it on Friends.</p> : null}
          {rel === "friends" ? <p className="text-sm font-bold text-muted">Friends. You only see posts they shared with you.</p> : null}
          <form action={blockAction}>
            <input type="hidden" name="userId" value={person.id} />
            <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
            <Button type="submit" variant="outline">Block</Button>
          </form>
        </div>
      ) : null}
      {rel === "blocked" ? <p className="mt-4 px-4 text-sm font-bold">You blocked {person.displayName}. Unblock them from Friends.</p> : null}

      <section className="mt-5">
        <h2 className="px-4 font-display text-xl font-semibold">{self ? "Your posts" : "Shared with you"}</h2>
        <p className="px-4 text-sm font-semibold text-muted">
          {self
            ? "Everything you made. A post reaches someone else only when you share it with them."
            : "Posts from this person that were sent to you. The rest stay off this page."}
        </p>
        {grid.length === 0 ? (
          <div className="mx-4 mt-3 rounded-2xl bg-[#f7f7f7] px-4 py-8 text-center">
            <p className="text-3xl" aria-hidden>✨</p>
            <p className="mt-2 font-display text-xl font-semibold">{self ? "Nothing here yet" : "Nothing shared with you"}</p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {self ? "Create something, then pick who receives it." : "When they send you a post, it shows up in this grid."}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-0.5">
            {grid.map(({ post }) => (
              <Link key={post.id} href={`/post/${post.id}`} className="relative block aspect-square overflow-hidden bg-[#f4f4f4]">
                <LoopMedia kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} body={post.body} interactive={false} tile />
                <span className="sr-only">{kindLabel(post.kind)} · {formatWhen(post.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 px-4">
        <h2 className="font-display text-xl font-semibold">Friends</h2>
        <ul className="mt-2 grid gap-2">
          {friends.map((friend) => (
            <li key={friend.id}>
              <Link className="font-extrabold text-ink" href={`/u/${friend.username}`}>{friend.displayName}</Link>
              <span className="text-sm font-semibold text-muted"> @{friend.username}</span>
            </li>
          ))}
        </ul>
        {self ? <p className="mt-2 text-xs font-semibold text-muted">{friendIds(db, person.id).length} people can be chosen when you share, if their settings allow it.</p> : null}
      </section>

      {self ? (
        <section className="mt-6 grid gap-2 px-4">
          <h2 className="font-display text-xl font-semibold">Sharing activity</h2>
          <p className="text-sm font-semibold text-muted">Recent things you sent. Recipients of each post are on My Posts.</p>
          {activity.length === 0 ? <p className="text-sm font-semibold text-muted">You have not shared anything yet.</p> : null}
          <ul className="grid gap-1 text-sm font-semibold">
            {activity.map((item) => (
              <li key={`${item.post_id}-${item.created_at}-${item.to_user_id}`}>
                You shared a {kindLabel(item.kind).toLowerCase()} with {item.to_user_id === person.id ? "yourself" : item.to_name} · {formatWhen(item.created_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {self ? (
        <section className="mt-6 grid gap-4 px-4 pb-6">
          <h2 className="font-display text-xl font-semibold">Edit profile</h2>
          <form action={updateProfileAction} className="grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Name
              <input className="field" name="displayName" defaultValue={person.displayName} />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Bio
              <textarea className="field min-h-24" name="bio" defaultValue={person.bio} />
            </label>
            <fieldset className="grid grid-cols-4 gap-2">
              <legend className="col-span-4 text-sm font-bold">Avatar color. Photo upload is not connected.</legend>
              {AVATAR_COLORS.map((color) => (
                <label key={color} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="avatarColor" value={color} defaultChecked={person.avatarColor === color} />
                  <span className="inline-block h-7 w-7 rounded-full border border-white shadow" style={{ background: color }} />
                </label>
              ))}
            </fieldset>
            <Button type="submit">Save profile</Button>
          </form>
          <form action={ticketAction} className="grid gap-2 rounded-2xl border border-rule bg-white p-3">
            <p className="kicker">Ask support</p>
            <p className="text-sm font-semibold text-muted">A short ticket. Not a timeline.</p>
            <input className="field" name="subject" placeholder="Subject" aria-label="Subject" />
            <textarea className="field min-h-20" name="body" placeholder="What do you need?" aria-label="Ticket details" />
            <Button type="submit" variant="outline">Send ticket</Button>
          </form>
        </section>
      ) : (
        <div className="mt-6 px-4">
          <ReportForm targetType="profile" targetId={person.id} returnTo={`/u/${person.username}`} />
        </div>
      )}
    </div>
  );
}
