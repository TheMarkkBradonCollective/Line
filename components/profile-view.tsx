import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { blockAction, requestFriendAction, ticketAction, updateProfileAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { MediaPlate } from "@/components/media-plate";
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
  publicPostsBy,
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
  const publicPosts = publicPostsBy(db, person.id);
  const activity = self ? sentActivity(db, person.id) : [];

  if (rel === "blocked_by") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl">This profile is not available.</h1>
        <p className="mt-2 text-sm text-muted">A block is in the way.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Notice notice={notice} error={error} />
      <header className="desk-card flex gap-4 p-4">
        <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} />
        <div>
          <p className="kicker">{self ? "Your profile" : "Profile"}</p>
          <h1 className="font-serif text-4xl">{person.displayName}</h1>
          <p className="text-sm text-muted">@{person.username}</p>
          {person.role !== "user" ? (
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">{ROLE_LABELS[person.role as Role] ?? person.role}</p>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed">{person.bio}</p>
          <p className="mt-2 text-sm text-muted">{friends.length} friends</p>
        </div>
      </header>

      {!self && rel !== "blocked" ? (
        <div className="flex flex-wrap gap-2">
          {rel === "none" ? (
            <form action={requestFriendAction}>
              <input type="hidden" name="username" value={person.username} />
              <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
              <Button type="submit">Add friend</Button>
            </form>
          ) : null}
          {rel === "outgoing" ? <p className="text-sm text-muted">Friend request sent.</p> : null}
          {rel === "incoming" ? <p className="text-sm text-muted">This person already asked to be friends. Answer it on Friends.</p> : null}
          {rel === "friends" ? <p className="text-sm text-muted">You are friends. Their posts appear here only if they are public, or on your timeline if shared with you.</p> : null}
          <form action={blockAction}>
            <input type="hidden" name="userId" value={person.id} />
            <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
            <Button type="submit" variant="outline">Block</Button>
          </form>
        </div>
      ) : null}
      {rel === "blocked" ? <p className="text-sm">You blocked {person.displayName}. Unblock them from Friends.</p> : null}

      <section>
        <h2 className="font-serif text-2xl">Public posts</h2>
        <p className="mt-1 text-sm text-muted">Privately shared posts stay off this page. Public means listed on Discover, which is still not your timeline.</p>
        <div className="mt-3 grid gap-3">
          {publicPosts.length === 0 ? <p className="text-sm text-muted">Nothing public.</p> : null}
          {publicPosts.map((post) => (
            <article key={post.id} className="border border-rule bg-card px-3 py-3">
              <p className="text-xs text-muted">{kindLabel(post.kind)} · {formatWhen(post.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap">{post.body}</p>
              {post.mediaLabel && post.mediaTone ? <MediaPlate kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} /> : null}
              <Link className="mt-2 inline-block text-sm underline" href={`/post/${post.id}`}>Open</Link>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Friends</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {friends.map((friend) => (
            <li key={friend.id}>
              <Link className="underline" href={`/u/${friend.username}`}>{friend.displayName}</Link>
            </li>
          ))}
        </ul>
        {self ? <p className="mt-2 text-xs text-muted">{friendIds(db, person.id).length} people can be chosen when you share, if their settings allow it.</p> : null}
      </section>

      {self ? (
        <section className="grid gap-2">
          <h2 className="font-serif text-2xl">Sharing activity</h2>
          <p className="text-sm text-muted">Recent things you sent. Recipients of each post are listed on My Posts.</p>
          {activity.length === 0 ? <p className="text-sm text-muted">You have not shared anything yet.</p> : null}
          <ul className="grid gap-1 text-sm">
            {activity.map((item) => (
              <li key={`${item.post_id}-${item.created_at}-${item.to_user_id}`}>
                You shared a {kindLabel(item.kind).toLowerCase()} with {item.to_user_id === person.id ? "yourself" : item.to_name} · {formatWhen(item.created_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted">Private sharing activity is not shown on someone else’s profile.</p>
      )}

      {self ? (
        <section className="grid gap-4">
          <h2 className="font-serif text-2xl">Edit profile</h2>
          <form action={updateProfileAction} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Name
              <input className="field" name="displayName" defaultValue={person.displayName} />
            </label>
            <label className="grid gap-1 text-sm">
              Bio
              <textarea className="field min-h-24" name="bio" defaultValue={person.bio} />
            </label>
            <fieldset className="grid grid-cols-4 gap-2">
              <legend className="col-span-4 text-sm">Avatar color. Photo upload is not connected.</legend>
              {AVATAR_COLORS.map((color) => (
                <label key={color} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="avatarColor" value={color} defaultChecked={person.avatarColor === color} />
                  <span className="inline-block h-6 w-6 border border-rule" style={{ background: color }} />
                </label>
              ))}
            </fieldset>
            <Button type="submit">Save profile</Button>
          </form>
          <form action={ticketAction} className="grid gap-2 border border-rule bg-card p-3">
            <p className="kicker">Ask support</p>
            <p className="text-sm text-muted">A short ticket. Not a full support desk, and not a timeline.</p>
            <input className="field" name="subject" placeholder="Subject" aria-label="Subject" />
            <textarea className="field min-h-20" name="body" placeholder="What do you need?" aria-label="Ticket details" />
            <Button type="submit" variant="outline">Send ticket</Button>
          </form>
        </section>
      ) : (
        <ReportForm targetType="profile" targetId={person.id} returnTo={`/u/${person.username}`} />
      )}
    </div>
  );
}
