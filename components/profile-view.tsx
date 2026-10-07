import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, Ban, Grid3x3, ImageOff, LifeBuoy, Pencil, Send, UserCheck, UserPlus, Users } from "lucide-react";
import { blockAction, requestFriendAction, ticketAction, updateProfileAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
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
import { cn } from "@/lib/utils";

type Tab = "posts" | "activity" | "friends" | "edit";

export async function ProfileView({
  username,
  notice,
  error,
  tab: rawTab,
}: {
  username: string;
  notice?: string;
  error?: string;
  tab?: string;
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
  const base = self ? "/profile" : `/u/${person.username}`;
  const tabs: { id: Tab; label: string; Icon: typeof Grid3x3 }[] = [
    { id: "posts", label: self ? "Posts" : "Shared", Icon: Grid3x3 },
    ...(self ? [{ id: "activity" as Tab, label: "Activity", Icon: Activity }] : []),
    { id: "friends", label: "Friends", Icon: Users },
    ...(self ? [{ id: "edit" as Tab, label: "Edit", Icon: Pencil }] : []),
  ];
  const tab: Tab = tabs.some((item) => item.id === rawTab) ? (rawTab as Tab) : "posts";

  if (rel === "blocked_by") {
    return (
      <div className="px-4 py-10 md:px-0">
        <EmptyState icon={Ban} title="This profile is not available">
          A block is in the way.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      {/* Cover */}
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-brand via-[#00a982] to-[#007a5c] md:mt-6 md:h-44 md:rounded-[28px]">
        <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="520" cy="20" r="140" fill="white" opacity="0.10" />
          <circle cx="80" cy="210" r="120" fill="white" opacity="0.08" />
          <path d="M0 150 C 150 110 260 190 400 140 S 560 120 600 130 L600 200 L0 200 Z" fill="black" opacity="0.10" />
          <text x="590" y="186" textAnchor="end" fontFamily="var(--font-display)" fontWeight="800" fontSize="120" fill="white" opacity="0.10" letterSpacing="-6">
            LINE
          </text>
        </svg>
      </div>

      <div className="px-4 md:px-2">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="xl" ring className="relative shadow-e2" />
          <div className="mb-1 flex gap-2">
            {self ? (
              <Link href="/profile?tab=edit" className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-e1 hover:border-brand">
                <Pencil className="h-4 w-4" aria-hidden /> Edit profile
              </Link>
            ) : null}
            {rel === "none" ? (
              <form action={requestFriendAction}>
                <input type="hidden" name="username" value={person.username} />
                <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                <Button type="submit" size="sm">
                  <UserPlus className="h-4 w-4" aria-hidden /> Add friend
                </Button>
              </form>
            ) : null}
            {rel === "friends" ? (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand-strong">
                <UserCheck className="h-4 w-4" aria-hidden /> Friends
              </span>
            ) : null}
            {rel === "outgoing" ? (
              <span className="inline-flex h-10 items-center rounded-full bg-surface-2 px-4 text-sm font-semibold text-ink-2">Requested</span>
            ) : null}
            {rel === "incoming" ? (
              <Link href="/friends?tab=requests" className="press inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-on">
                Answer request
              </Link>
            ) : null}
            {!self && rel !== "blocked" ? (
              <form action={blockAction}>
                <input type="hidden" name="userId" value={person.id} />
                <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                <button type="submit" aria-label={`Block ${person.displayName}`} className="tap press flex h-10 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-danger">
                  <Ban className="h-4 w-4" aria-hidden />
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <h1 className="mt-3 font-display text-[30px] font-bold leading-none tracking-tight">{person.displayName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
          @{person.username}
          {person.role !== "user" ? (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-strong">
              {ROLE_LABELS[person.role as Role] ?? person.role}
            </span>
          ) : null}
        </p>
        {person.bio ? <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">{person.bio}</p> : null}

        <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-3xl bg-surface py-3.5 shadow-e1 ring-1 ring-line/60">
          {[
            ["Friends", stats.friends],
            [self ? "Posts" : "Sent to you", stats.posts],
            [self ? "Shares sent" : "Shares", stats.shares],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse items-center gap-0.5">
              <dt className="text-[12px] font-medium text-ink-3">{label}</dt>
              <dd className="font-display text-[26px] font-bold leading-none tracking-tight tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <Notice notice={notice} error={error} />
        </div>
        {rel === "blocked" ? <p className="mt-2 text-sm font-medium text-ink-2">You blocked {person.displayName}. Unblock them from Friends.</p> : null}

        <nav className="segmented mt-4" aria-label="Profile sections">
          {tabs.map(({ id, label, Icon }) => (
            <Link key={id} href={id === "posts" ? base : `${base}?tab=${id}`} aria-current={tab === id ? "page" : undefined} scroll={false}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "posts" ? (
        <section className="mt-3">
          <p className="px-4 pb-2 text-[13px] text-ink-3 md:px-2">
            {self ? "Everything you made. Each one reaches only the people you send it to." : "Only posts they sent to you. The rest stay off this page."}
          </p>
          {grid.length === 0 ? (
            <div className="px-4 md:px-0">
              <EmptyState icon={ImageOff} title={self ? "Nothing made yet" : "Nothing shared with you"}>
                {self ? "Create something, then pick who gets it." : "When they send you a post, it shows up in this grid."}
              </EmptyState>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[2px] md:gap-1.5">
              {grid.map(({ post, likeCount }, index) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="animate-rise group relative block aspect-square overflow-hidden bg-surface-2 md:rounded-2xl"
                  style={{ ["--i" as string]: Math.min(index, 8) }}
                >
                  <LoopMedia kind={post.kind} label={post.mediaLabel} tone={post.mediaTone} body={post.body} interactive={false} tile />
                  <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                  {likeCount ? (
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-md">
                      ♥ {likeCount}
                    </span>
                  ) : null}
                  <span className="sr-only">
                    {kindLabel(post.kind)} · {formatWhen(post.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "activity" && self ? (
        <section className="mt-4 px-4 md:px-0">
          {activity.length === 0 ? (
            <EmptyState icon={Send} title="You haven’t shared yet">
              Tap Share on any post to pass it on.
            </EmptyState>
          ) : (
            <ul className="surface-card divide-y divide-line/70 overflow-hidden">
              {activity.map((item) => (
                <li key={`${item.post_id}-${item.created_at}-${item.to_user_id}`}>
                  <Link href={`/post/${item.post_id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-3 text-ink hover:bg-surface-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                      <Send className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-[14.5px]">
                      You sent a {kindLabel(item.kind).toLowerCase()} to{" "}
                      <span className="font-semibold">{item.to_user_id === person.id ? "your timeline" : item.to_name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{formatWhen(item.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 px-1 text-[13px] text-ink-3">
            Recipients of each post are on{" "}
            <Link href="/posts" className="font-semibold">
              My Posts
            </Link>
            .
          </p>
        </section>
      ) : null}

      {tab === "friends" ? (
        <section className="mt-4 px-4 md:px-0">
          {friends.length === 0 ? (
            <EmptyState icon={Users} title="No friends yet" />
          ) : (
            <ul className="surface-card divide-y divide-line/70 overflow-hidden">
              {friends.map((friend) => (
                <li key={friend.id}>
                  <Link href={`/u/${friend.username}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 text-ink hover:bg-surface-2">
                    <Avatar initials={friend.initials} color={friend.avatarColor} name={friend.displayName} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{friend.displayName}</span>
                      <span className="block truncate text-[13px] text-ink-3">@{friend.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {self ? (
            <p className="mt-3 px-1 text-[13px] text-ink-3">
              {friendIds(db, person.id).length} people can be picked when you share, if their settings allow it.
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === "edit" && self ? (
        <section className="mt-4 grid gap-4 px-4 md:px-0">
          <form action={updateProfileAction} className="surface-card grid gap-4 p-5">
            <h2 className="font-display text-xl font-bold tracking-tight">Edit profile</h2>
            <label className="grid gap-1.5 text-sm font-semibold">
              Name
              <input className="field" name="displayName" defaultValue={person.displayName} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Bio
              <textarea className="field min-h-24" name="bio" defaultValue={person.bio} />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">Avatar color</legend>
              <p className="text-[13px] text-ink-3">Photo upload is not connected yet.</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {AVATAR_COLORS.map((color) => (
                  <label key={color} className="relative cursor-pointer">
                    <input type="radio" name="avatarColor" value={color} defaultChecked={person.avatarColor === color} className="peer sr-only" />
                    <span
                      className="block h-11 w-11 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-[rgb(var(--surface))] transition peer-checked:ring-brand peer-focus-visible:ring-brand"
                      style={{ background: color }}
                    />
                    <span className="sr-only">{color}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit">Save profile</Button>
          </form>
          <form action={ticketAction} className="surface-card grid gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <LifeBuoy className="h-5 w-5 text-brand-strong" aria-hidden /> Ask support
            </h2>
            <p className="-mt-1 text-[13px] text-ink-3">A short ticket. Not a timeline.</p>
            <input className="field" name="subject" placeholder="Subject" aria-label="Subject" />
            <textarea className="field min-h-20" name="body" placeholder="What do you need?" aria-label="Ticket details" />
            <Button type="submit" variant="outline">
              Send ticket
            </Button>
          </form>
        </section>
      ) : null}

      {!self ? (
        <div className={cn("mt-6 px-4 md:px-0")}>
          <ReportForm targetType="profile" targetId={person.id} returnTo={`/u/${person.username}`} />
        </div>
      ) : null}
    </div>
  );
}
