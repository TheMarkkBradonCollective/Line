import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  Ban,
  Briefcase,
  CalendarDays,
  Clapperboard,
  GraduationCap,
  Image as ImageIcon,
  ImageOff,
  Info,
  LifeBuoy,
  Lock,
  MapPin,
  MessageCircle,
  Newspaper,
  Pencil,
  Plus,
  Send,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { blockAction, requestFriendAction, ticketAction, updateProfileAction } from "@/app/actions";
import { Avatar, AvatarStack } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PostCard } from "@/components/post-card";
import { PostMedia } from "@/components/post-media";
import { ReportForm } from "@/components/report-form";
import { Button } from "@/components/ui/button";
import { canViewProfile } from "@/lib/access";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import {
  AVATAR_COLORS,
  getUserByUsername,
  listFriends,
  mutualFriends,
  profilePosts,
  profileStats,
  relationship,
  sentActivity,
  type ProfileSection,
} from "@/lib/social";
import type { User } from "@/lib/types";

type Tab = "posts" | "about" | "friends" | "photos" | "videos" | "reels" | "activity" | "edit";

function AboutRows({ person }: { person: User }) {
  const rows = [
    person.work ? { Icon: Briefcase, text: person.work } : null,
    person.education ? { Icon: GraduationCap, text: `Studied at ${person.education}` } : null,
    person.location ? { Icon: MapPin, text: `Lives in ${person.location}` } : null,
    { Icon: CalendarDays, text: `Joined ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(person.createdAt))}` },
  ].filter(Boolean) as { Icon: typeof Briefcase; text: string }[];
  return (
    <ul className="grid gap-2.5">
      {rows.map(({ Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-[14.5px] text-ink">
          <Icon className="h-[18px] w-[18px] shrink-0 text-ink-3" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}

function PersonRow({ person, sub }: { person: User; sub?: string }) {
  return (
    <Link href={`/u/${person.username}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 text-ink hover:bg-surface-2">
      <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="md" />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{person.displayName}</span>
        <span className="block truncate text-[13px] text-ink-3">{sub ?? `@${person.username}`}</span>
      </span>
    </Link>
  );
}

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

  // Profiles are public to signed-in people. A block from them closes it.
  if (!canViewProfile(db, viewer.id, person.id)) {
    return (
      <div className="px-4 py-10 md:px-0">
        <EmptyState icon={Ban} title="This profile isn’t available">
          You can’t view this profile.
        </EmptyState>
      </div>
    );
  }

  const friends = listFriends(db, person.id);
  const mutual = self ? [] : mutualFriends(db, viewer.id, person.id);
  const stats = profileStats(db, viewer.id, person.id);
  const base = self ? "/profile" : `/u/${person.username}`;
  const tabs: { id: Tab; label: string; Icon: typeof Newspaper }[] = [
    { id: "posts", label: "Posts", Icon: Newspaper },
    { id: "about", label: "About", Icon: Info },
    { id: "friends", label: "Friends", Icon: Users },
    { id: "photos", label: "Photos", Icon: ImageIcon },
    { id: "videos", label: "Videos", Icon: Video },
    { id: "reels", label: "Reels", Icon: Clapperboard },
    ...(self ? [{ id: "activity" as Tab, label: "Activity", Icon: Activity }] : []),
  ];
  const tab: Tab = rawTab === "edit" && self ? "edit" : tabs.some((item) => item.id === rawTab) ? (rawTab as Tab) : "posts";
  const blockedByMe = rel === "blocked";
  const section: ProfileSection | null = tab === "posts" || tab === "photos" || tab === "videos" || tab === "reels" ? tab : null;
  const posts = section && !blockedByMe ? profilePosts(db, viewer.id, person.id, section) : [];
  const photoPreview = tab === "posts" && !blockedByMe ? profilePosts(db, viewer.id, person.id, "photos").slice(0, 6) : [];
  const activity = self && tab === "activity" ? sentActivity(db, person.id) : [];
  const firstName = person.displayName.split(" ")[0];
  const [c1] = person.avatarColor ? [person.avatarColor] : ["#00bf8f"];

  return (
    <div>
      <div className="bg-surface pb-1 md:mt-6 md:overflow-hidden md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
        {/* Cover */}
        <div
          className="relative h-40 overflow-hidden md:h-52"
          style={{ background: `linear-gradient(135deg, rgb(var(--brand)) 0%, ${c1} 55%, rgb(var(--brand-deep)) 100%)` }}
          data-testid="profile-cover"
        >
          <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="520" cy="20" r="140" fill="white" opacity="0.12" />
            <circle cx="80" cy="210" r="120" fill="white" opacity="0.08" />
            <path d="M0 150 C 150 110 260 190 400 140 S 560 120 600 130 L600 200 L0 200 Z" fill="black" opacity="0.12" />
            <text x="590" y="186" textAnchor="end" fontFamily="var(--font-display)" fontWeight="800" fontSize="120" fill="white" opacity="0.12" letterSpacing="-6">
              LINE
            </text>
          </svg>
        </div>

        <div className="px-4">
          <div className="-mt-14 flex justify-center md:justify-start">
            <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size="xl" ring className="relative shadow-e2" />
          </div>
          <div className="mt-2 text-center md:text-left">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">{person.displayName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 text-[14px] text-ink-3 md:justify-start">
              <Link href={`${base}?tab=friends`} className="font-semibold text-ink-2 hover:underline">
                {stats.friends} {stats.friends === 1 ? "friend" : "friends"}
              </Link>
              {!self && mutual.length ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{mutual.length} mutual</span>
                </>
              ) : null}
              {person.role !== "user" ? (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-strong">
                  {ROLE_LABELS[person.role as Role] ?? person.role}
                </span>
              ) : null}
            </p>
            {friends.length ? (
              <div className="mt-2 flex justify-center md:justify-start">
                <AvatarStack people={(mutual.length ? mutual : friends).slice(0, 6)} size="sm" max={6} />
              </div>
            ) : null}
            {person.bio ? <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-ink md:mx-0">{person.bio}</p> : null}
          </div>

          <div className="mt-4 flex gap-2" data-testid="profile-actions">
            {self ? (
              <>
                <Link href="/create" className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-on">
                  <Plus className="h-4 w-4" aria-hidden /> Create post
                </Link>
                <Link href="/profile?tab=edit" className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-semibold text-ink hover:bg-surface-3">
                  <Pencil className="h-4 w-4" aria-hidden /> Edit profile
                </Link>
              </>
            ) : (
              <>
                {rel === "none" ? (
                  <form action={requestFriendAction} className="flex flex-1">
                    <input type="hidden" name="username" value={person.username} />
                    <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                    <button type="submit" className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-on">
                      <UserPlus className="h-4 w-4" aria-hidden /> Add friend
                    </button>
                  </form>
                ) : null}
                {rel === "friends" ? (
                  <span className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-soft text-sm font-semibold text-brand-strong">
                    <UserCheck className="h-4 w-4" aria-hidden /> Friends
                  </span>
                ) : null}
                {rel === "outgoing" ? (
                  <span className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-ink-2">Request sent</span>
                ) : null}
                {rel === "incoming" ? (
                  <Link href="/friends?tab=requests" className="press inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-on">
                    Respond to request
                  </Link>
                ) : null}
                {rel === "blocked" ? (
                  <Link href="/friends?tab=privacy" className="press inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-ink-2">
                    Blocked · manage
                  </Link>
                ) : null}
                {rel !== "blocked" ? (
                  <Link
                    href={`/create?to=${person.username}`}
                    className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-semibold text-ink hover:bg-surface-3"
                    data-testid="message-button"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden /> Message
                  </Link>
                ) : null}
                {rel !== "blocked" ? (
                  <form action={blockAction}>
                    <input type="hidden" name="userId" value={person.id} />
                    <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                    <button type="submit" aria-label={`Block ${person.displayName}`} className="tap press flex h-10 items-center justify-center rounded-xl bg-surface-2 text-ink-2 hover:text-danger">
                      <Ban className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                ) : null}
              </>
            )}
          </div>

          {!self ? (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-soft px-3.5 py-2.5 text-[13.5px] font-medium text-ink" data-testid="shared-note">
              <Lock className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
              You’ll only see what’s been shared with you.
            </p>
          ) : null}

          <nav className="no-scrollbar relative -mx-4 mt-3 flex overflow-x-auto border-t border-line/70 px-2" aria-label="Profile sections">
            {tabs.map(({ id, label }) => (
              <Link
                key={id}
                href={id === "posts" ? base : `${base}?tab=${id}`}
                aria-current={tab === id ? "page" : undefined}
                scroll={false}
                className="relative shrink-0 px-2.5 py-3 text-[14px] font-semibold text-ink-3 hover:text-ink aria-[current=page]:text-brand-strong aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-[3px] aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-brand"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="px-4 md:px-0">
        <Notice notice={notice} error={error} />
      </div>

      {tab === "posts" ? (
        <section className="mt-2 md:mt-4">
          {/* Intro card */}
          <div className="mb-2 bg-surface p-4 md:mb-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
            <h2 className="font-display text-[19px] font-bold tracking-tight">Intro</h2>
            <div className="mt-3">
              <AboutRows person={person} />
            </div>
            {photoPreview.length ? (
              <>
                <div className="mt-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold">Photos</h3>
                  <Link href={`${base}?tab=photos`} className="text-[13.5px] font-semibold text-brand-strong hover:underline">
                    See all
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
                  {photoPreview.map(({ post }) => (
                    <Link key={post.id} href={`/post/${post.id}`} className="block">
                      <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} variant="tile" />
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
            {!self && mutual.length ? (
              <p className="mt-4 flex items-center gap-2 text-[13.5px] text-ink-2">
                <AvatarStack people={mutual.slice(0, 3)} size="xs" max={3} />
                Mutual friends: {mutual.map((item) => item.displayName.split(" ")[0]).join(", ")}
              </p>
            ) : null}
          </div>

          <h2 className="px-4 pb-2 pt-2 font-display text-[19px] font-bold tracking-tight md:px-1">
            {self ? "Your posts" : `Posts shared with you`}
          </h2>
          {posts.length === 0 ? (
            <div className="px-4 md:px-0">
              <EmptyState icon={ImageOff} title={self ? "Nothing made yet" : `${firstName} hasn’t shared anything with you`}>
                {self
                  ? "Create something, then pick who gets it."
                  : "Their posts only appear here once they, or someone they shared with, send one to you."}
              </EmptyState>
            </div>
          ) : (
            posts.map((item) => <PostCard key={item.post.id} item={item} author={person} viewerId={viewer.id} />)
          )}
        </section>
      ) : null}

      {tab === "photos" || tab === "videos" || tab === "reels" ? (
        <section className="mt-2 bg-surface p-3 md:mt-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
          <h2 className="px-1 pb-2 font-display text-[19px] font-bold tracking-tight">
            {tab === "photos" ? "Photos" : tab === "videos" ? "Videos" : "Reels"}
            {!self ? <span className="ml-2 text-[13px] font-medium text-ink-3">shared with you</span> : null}
          </h2>
          {posts.length === 0 ? (
            <EmptyState icon={tab === "photos" ? ImageIcon : tab === "videos" ? Video : Clapperboard} title="Nothing here for you">
              {self ? "Nothing of this kind yet." : `None of ${firstName}’s ${tab} have been shared with you.`}
            </EmptyState>
          ) : (
            <div className={tab === "reels" ? "grid grid-cols-3 gap-1" : "grid grid-cols-3 gap-1"}>
              {posts.map(({ post }) => (
                <Link
                  key={post.id}
                  href={tab === "reels" ? `/reels/${post.id}` : `/post/${post.id}`}
                  className={tab === "reels" ? "relative block aspect-[9/14] overflow-hidden rounded-xl bg-black" : "block overflow-hidden rounded-xl"}
                >
                  {tab === "reels" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/media/${post.id}/0`} alt={post.mediaLabel ?? "Reel"} className="h-full w-full object-cover" loading="lazy" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11.5px] font-semibold text-white">
                        <Clapperboard className="mr-1 inline h-3 w-3" aria-hidden />
                        {post.mediaLabel}
                      </span>
                    </>
                  ) : (
                    <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} variant="tile" />
                  )}
                  <span className="sr-only">
                    {kindLabel(post.kind)} · {formatWhen(post.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "about" ? (
        <section className="mt-2 grid gap-3 bg-surface p-4 md:mt-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
          <h2 className="font-display text-[19px] font-bold tracking-tight">About</h2>
          {person.bio ? <p className="text-[15px] leading-relaxed text-ink">{person.bio}</p> : null}
          <AboutRows person={person} />
          {self ? (
            <Link href="/profile?tab=edit" className="press mt-1 inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-ink hover:bg-surface-3">
              <Pencil className="h-4 w-4" aria-hidden /> Edit details
            </Link>
          ) : null}
          <p className="text-[12.5px] text-ink-3">Profiles are open to everyone signed in. Posts are not: each one is seen only by the people it was shared with.</p>
        </section>
      ) : null}

      {tab === "friends" ? (
        <section className="mt-2 md:mt-4">
          {!self && mutual.length ? (
            <div className="mb-2 bg-surface md:mb-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
              <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">Mutual friends · {mutual.length}</h2>
              <ul className="divide-y divide-line/70">
                {mutual.map((friend) => (
                  <li key={friend.id}>
                    <PersonRow person={friend} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bg-surface md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
            <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">
              {self ? "Your friends" : `${firstName}’s friends`} · {friends.length}
            </h2>
            {friends.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-ink-3">No friends yet.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {friends.map((friend) => (
                  <li key={friend.id}>
                    <PersonRow person={friend} sub={friend.id === viewer.id ? "You" : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                      <span className="font-semibold">{item.to_user_id === person.id ? "your own feed" : item.to_name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{formatWhen(item.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
            <label className="grid gap-1.5 text-sm font-semibold">
              Work
              <input className="field" name="work" defaultValue={person.work} placeholder="Where you work" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Education
              <input className="field" name="education" defaultValue={person.education} placeholder="Where you studied" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Location
              <input className="field" name="location" defaultValue={person.location} placeholder="City" />
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
            <p className="text-[12.5px] text-ink-3">Everything on this form is visible to anyone signed in. Your posts are not.</p>
            <Button type="submit">Save profile</Button>
          </form>
          <form action={ticketAction} className="surface-card grid gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <LifeBuoy className="h-5 w-5 text-brand-strong" aria-hidden /> Ask support
            </h2>
            <input className="field" name="subject" placeholder="Subject" aria-label="Subject" />
            <textarea className="field min-h-20" name="body" placeholder="What do you need?" aria-label="Ticket details" />
            <Button type="submit" variant="outline">
              Send ticket
            </Button>
          </form>
        </section>
      ) : null}

      {!self ? (
        <div className="mt-6 px-4 md:px-0">
          <ReportForm targetType="profile" targetId={person.id} returnTo={`/u/${person.username}`} />
        </div>
      ) : null}
    </div>
  );
}
