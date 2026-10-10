import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
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
  UserMinus,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { blockAction, followAction, unfollowAction, requestFriendAction, ticketAction, updateProfileAction } from "@/app/actions";
import { Avatar, AvatarStack } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PostCard } from "@/components/post-card";
import { ProfilePhotoButton } from "@/components/profile-photo-button";
import { ProfileMenu } from "@/components/profile-menu";
import { MediaStill, PostMedia } from "@/components/post-media";
import { ReportForm } from "@/components/report-form";
import { Button } from "@/components/ui/button";
import { canViewProfile } from "@/lib/access";
import { getDb } from "@/lib/db";
import { formatWhen, kindLabel } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import {
  AVATAR_COLORS,
  followCounts,
  isAuthorHidden,
  isFollowing,
  listFollows,
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

type Tab = "posts" | "about" | "friends" | "followers" | "following" | "photos" | "videos" | "reels" | "activity" | "edit" | "report";

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
      <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="md" />
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
  const person = await getUserByUsername(db, username);
  if (!person) notFound();
  const rel = await relationship(db, viewer.id, person.id);
  const self = rel === "self";

  // Profiles are public to signed-in people. A block from them closes it.
  if (!await canViewProfile(db, viewer.id, person.id)) {
    return (
      <div className="px-4 py-10 md:px-0">
        <EmptyState icon={Ban} title="This profile isn’t available">
          You can’t view this profile.
        </EmptyState>
      </div>
    );
  }

  const friends = await listFriends(db, person.id);
  const mutual = self ? [] : await mutualFriends(db, viewer.id, person.id);
  const stats = await profileStats(db, viewer.id, person.id);
  const base = self ? "/profile" : `/u/${person.username}`;
  const tabs: { id: Tab; label: string; Icon: typeof Newspaper }[] = [
    { id: "posts", label: "Posts", Icon: Newspaper },
    { id: "about", label: "About", Icon: Info },
    { id: "friends", label: "Friends", Icon: Users },
    { id: "followers", label: "Followers", Icon: Users },
    { id: "following", label: "Following", Icon: Users },
    { id: "photos", label: "Photos", Icon: ImageIcon },
    { id: "videos", label: "Videos", Icon: Video },
    { id: "reels", label: "Loops", Icon: Clapperboard },
    ...(self ? [{ id: "activity" as Tab, label: "Activity", Icon: Activity }] : []),
  ];
  const tab: Tab = rawTab === "edit" && self ? "edit" : rawTab === "report" && !self ? "report" : tabs.some((item) => item.id === rawTab) ? (rawTab as Tab) : "posts";
  const blockedByMe = rel === "blocked";
  const section: ProfileSection | null = tab === "posts" || tab === "photos" || tab === "videos" || tab === "reels" ? tab : null;
  const posts = section && !blockedByMe ? await profilePosts(db, viewer.id, person.id, section) : [];
  const activity = self && tab === "activity" ? await sentActivity(db, person.id) : [];
  const firstName = person.displayName.split(" ")[0];
  const fc = await followCounts(db, person.id);
  const following = !self && (await isFollowing(db, viewer.id, person.id));
  const followList = tab === "followers" || tab === "following" ? await listFollows(db, viewer.id, person.id, tab) : [];
  const [c1] = person.avatarColor ? [person.avatarColor] : ["#00bf8f"];

  const hiddenByMe = !self && (await isAuthorHidden(db, viewer.id, person.id));
  const photoGrid = tab === "posts" && !blockedByMe ? (await profilePosts(db, viewer.id, person.id, "photos")).slice(0, 9) : [];
  const friendGrid = (mutual.length && !self ? [...mutual, ...friends.filter((f) => !mutual.some((m) => m.id === f.id))] : friends).slice(0, 9);
  const subTitle: Record<string, string> = {
    photos: "Photos", videos: "Videos", reels: "Loops", about: "About", friends: "Friends",
    followers: "Followers", following: "Following", activity: "Activity", edit: "Edit profile", report: "Report",
  };

  if (tab !== "posts") {
    // Full list pages ("See all"), not tabs.
    return (
      <div className="md:pt-6">
        <div className="flex items-center gap-3 px-4 py-3 md:px-0" data-testid="profile-subpage">
          <Link href={base} className="press flex items-center gap-2.5 rounded-full py-1 pr-3 text-ink hover:bg-surface-2" aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight">{person.displayName}</span>
              <span className="block text-[12.5px] text-ink-3">{subTitle[tab] ?? ""}</span>
            </span>
          </Link>
        </div>
        <div className="px-4 md:px-0"><Notice notice={notice} error={error} /></div>
      {tab === "photos" || tab === "videos" || tab === "reels" ? (
        <section className="mt-2 bg-surface p-3 md:mt-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1">
          <h2 className="px-1 pb-2 font-display text-[19px] font-bold tracking-tight">
            {tab === "photos" ? "Photos" : tab === "videos" ? "Videos" : "Loops"}
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
                  href={tab === "reels" ? `/loops/${post.id}` : `/post/${post.id}`}
                  className={tab === "reels" ? "relative block aspect-[9/14] overflow-hidden rounded-xl bg-black" : "block overflow-hidden rounded-xl"}
                >
                  {tab === "reels" ? (
                    <>
                      {post.frames[0] ? <MediaStill postId={post.id} frame={post.frames[0]} alt={post.body.slice(0, 80) || "Loop"} /> : null}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11.5px] font-semibold text-white">
                        <Clapperboard className="mr-1 inline h-3 w-3" aria-hidden />
                        <span className="line-clamp-2">{post.body}</span>
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
            <Link href="/profile/edit" className="press mt-1 inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-ink hover:bg-surface-3">
              <Pencil className="h-4 w-4" aria-hidden /> Edit details
            </Link>
          ) : null}
          <p className="text-[12.5px] text-ink-3">Profiles are open to everyone signed in. Posts are not: each one is seen only by the people it was shared with.</p>
        </section>
      ) : null}

      {tab === "followers" || tab === "following" ? (
        <section className="mt-2 md:mt-4">
          <div className="bg-surface md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" data-testid="follow-list">
            <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">
              {tab === "followers" ? "Followers" : "Following"} · {tab === "followers" ? fc.followers : fc.following}
            </h2>
            {followList.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-ink-3">{tab === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {followList.map((item) => (
                  <li key={item.id}>
                    <PersonRow person={item} sub={item.id === viewer.id ? "You" : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </div>
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
              <p className="text-[13px] text-ink-3">Your avatar shows your initials on this color.</p>
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

      {tab === "report" && !self ? (
        <div className="mt-2 px-4 md:px-0">
          <ReportForm targetType="profile" targetId={person.id} returnTo={`/u/${person.username}`} />
        </div>
      ) : null}

      </div>
    );
  }

  const card = "bg-surface p-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1";
  const btn = "press inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold";

  return (
    <div className="md:pt-6" data-testid="profile-page">
      {/* Header: cover, overlapping photo, name, counts, actions */}
      <div className="overflow-hidden bg-surface md:rounded-[28px] md:border md:border-line/60 md:shadow-e1">
        <div
          className="relative h-48 overflow-hidden sm:h-60 lg:h-[340px]"
          style={{ background: `linear-gradient(135deg, rgb(var(--brand)) 0%, ${c1} 55%, rgb(var(--brand-deep)) 100%)` }}
          data-testid="profile-cover"
        >
          <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="520" cy="20" r="140" fill="white" opacity="0.12" />
            <circle cx="80" cy="210" r="120" fill="white" opacity="0.08" />
            <text x="590" y="186" textAnchor="end" fontFamily="var(--font-display)" fontWeight="800" fontSize="120" fill="white" opacity="0.12" letterSpacing="-6">LINE</text>
          </svg>
          {person.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" aria-hidden />
          {self ? <ProfilePhotoButton which="cover" hasPhoto={Boolean(person.coverUrl)} className="absolute bottom-3 right-3" /> : null}
        </div>

        <div className="px-4 pb-4 lg:px-8">
          <div className="flex flex-col items-center gap-3 md:flex-row md:items-end md:gap-5">
            <div className="relative -mt-20 shrink-0 md:-mt-16">
              <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="xxl" ring className="relative shadow-e2" />
              {self ? <ProfilePhotoButton which="avatar" hasPhoto={Boolean(person.avatarUrl)} className="absolute bottom-2 right-2" /> : null}
            </div>
            <div className="min-w-0 flex-1 text-center md:pb-2 md:text-left">
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight lg:text-[34px]">
                {person.displayName}
                {person.role !== "user" ? (
                  <span className="ml-2 inline-block translate-y-[-4px] rounded-full bg-brand-soft px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-brand-strong">
                    {ROLE_LABELS[person.role as Role] ?? person.role}
                  </span>
                ) : null}
              </h1>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-[14.5px] text-ink-3 md:justify-start" data-testid="profile-counts">
                <Link href={`${base}/friends`} className="font-semibold text-ink-2 hover:underline">
                  {stats.friends} {stats.friends === 1 ? "friend" : "friends"}
                </Link>
                <span aria-hidden>·</span>
                <Link href={`${base}/followers`} className="font-semibold text-ink-2 hover:underline" data-testid="followers-count">
                  {fc.followers} {fc.followers === 1 ? "follower" : "followers"}
                </Link>
                <span aria-hidden>·</span>
                <Link href={`${base}/following`} className="font-semibold text-ink-2 hover:underline" data-testid="following-count">
                  {fc.following} following
                </Link>
                {!self && mutual.length ? (<><span aria-hidden>·</span><span>{mutual.length} mutual</span></>) : null}
              </p>
              {person.bio ? <p className="mx-auto mt-2 max-w-prose text-[15px] leading-relaxed text-ink md:mx-0">{person.bio}</p> : null}
              {friends.length ? (
                <div className="mt-2 flex justify-center md:justify-start">
                  <AvatarStack people={(mutual.length ? mutual : friends).slice(0, 8)} size="sm" max={8} />
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-wrap justify-center gap-2 md:w-auto md:justify-end md:pb-2" data-testid="profile-actions">
              {self ? (
                <>
                  <Link href="/create" className={`${btn} bg-brand text-brand-on`}><Plus className="h-4 w-4" aria-hidden /> Create post</Link>
                  <Link href={`${base}/edit`} className={`${btn} bg-surface-2 text-ink hover:bg-surface-3`}><Pencil className="h-4 w-4" aria-hidden /> Edit profile</Link>
                </>
              ) : (
                <>
                  {rel === "none" ? (
                    <form action={requestFriendAction}>
                      <input type="hidden" name="username" value={person.username} />
                      <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                      <button type="submit" className={`${btn} bg-brand text-brand-on`} data-testid="add-friend"><UserPlus className="h-4 w-4" aria-hidden /> Add friend</button>
                    </form>
                  ) : null}
                  {rel === "friends" ? <span className={`${btn} bg-brand-soft text-brand-strong`}><UserCheck className="h-4 w-4" aria-hidden /> Friends</span> : null}
                  {rel === "outgoing" ? <span className={`${btn} bg-surface-2 text-ink-2`}>Request sent</span> : null}
                  {rel === "incoming" ? <Link href="/friends?tab=requests" className={`${btn} bg-brand text-brand-on`}>Respond to request</Link> : null}
                  {rel === "blocked" ? <Link href="/friends?tab=privacy" className={`${btn} bg-surface-2 text-ink-2`}>Blocked · manage</Link> : null}
                  {rel !== "blocked" && rel !== "blocked_by" ? (
                    <form action={following ? unfollowAction : followAction}>
                      <input type="hidden" name="userId" value={person.id} />
                      <input type="hidden" name="returnTo" value={`/u/${person.username}`} />
                      <button type="submit" data-testid="follow-button" className={following ? `${btn} bg-surface-2 text-ink hover:bg-surface-3` : `${btn} bg-ink text-[rgb(var(--surface))]`}>
                        {following ? <UserMinus className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                        {following ? "Following" : "Follow"}
                      </button>
                    </form>
                  ) : null}
                  {rel === "friends" ? (
                    <Link href={`/create?to=${person.username}`} className={`${btn} bg-surface-2 text-ink hover:bg-surface-3`} data-testid="message-button">
                      <MessageCircle className="h-4 w-4" aria-hidden /> Message
                    </Link>
                  ) : null}
                  <ProfileMenu userId={person.id} username={person.username} name={person.displayName} blocked={rel === "blocked"} hidden={hiddenByMe} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-0"><Notice notice={notice} error={error} /></div>

      {/* One scrolling page: cards on the left (stacked on mobile), posts on the right */}
      <div className="mt-2 grid gap-2 md:mt-4 md:gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <aside className="grid gap-2 md:gap-4 lg:sticky lg:top-6">
          <section className={card} data-testid="intro-card">
            <h2 className="font-display text-[20px] font-bold tracking-tight">Intro</h2>
            {person.bio ? <p className="mt-2 text-center text-[15px] leading-relaxed text-ink">{person.bio}</p> : null}
            <div className="mt-3"><AboutRows person={person} /></div>
            {self ? (
              <Link href={`${base}/edit`} className={`${btn} mt-4 w-full bg-surface-2 text-ink hover:bg-surface-3`}>Edit details</Link>
            ) : null}
          </section>

          <section className={card} data-testid="photos-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-bold tracking-tight">Photos</h2>
              <Link href={`${base}/photos`} className="text-[14px] font-semibold text-brand-strong hover:underline">See all</Link>
            </div>
            {!self ? <p className="text-[12.5px] text-ink-3">Only photos shared with you</p> : null}
            {photoGrid.length ? (
              <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
                {photoGrid.map(({ post }) => (
                  <Link key={post.id} href={`/post/${post.id}`} className="block">
                    <PostMedia postId={post.id} kind={post.kind} body={post.body} frames={post.frames} variant="tile" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-3">{self ? "Your photos will show here." : "No photos shared with you yet."}</p>
            )}
          </section>

          <section className={card} data-testid="friends-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-bold tracking-tight">Friends</h2>
              <Link href={`${base}/friends`} className="text-[14px] font-semibold text-brand-strong hover:underline">See all</Link>
            </div>
            <p className="text-[13.5px] text-ink-3">
              {stats.friends} {stats.friends === 1 ? "friend" : "friends"}
              {!self && mutual.length ? ` · ${mutual.length} mutual` : ""}
            </p>
            {friendGrid.length ? (
              <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
                {friendGrid.map((friend) => (
                  <Link key={friend.id} href={friend.id === viewer.id ? "/profile" : `/u/${friend.username}`} className="group block min-w-0">
                    <span
                      className="relative block aspect-square overflow-hidden rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${friend.avatarColor}, rgb(var(--brand-deep)))` }}
                    >
                      {friend.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">{friend.initials}</span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[13px] font-semibold text-ink">{friend.displayName}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No friends yet.</p>
            )}
          </section>
        </aside>

        <section className="grid min-w-0 content-start gap-2 md:gap-4" data-testid="profile-posts">
          {self ? (
            <div className={`${card} flex items-center gap-3`} data-testid="profile-composer">
              <Avatar initials={person.initials} color={person.avatarColor} src={person.avatarUrl} name={person.displayName} size="md" />
              <Link href="/create" className="flex h-11 flex-1 items-center rounded-full bg-surface-2 px-4 text-[15px] text-ink-3 hover:bg-surface-3">
                What’s on your mind, {firstName}?
              </Link>
              <Link href="/create?type=photo" aria-label="Add a photo" className="tap press flex items-center justify-center rounded-full text-[#2f8f3a] hover:bg-surface-2">
                <ImageIcon className="h-6 w-6" aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="mx-4 flex items-center gap-2 rounded-2xl bg-brand-soft px-3.5 py-2.5 text-[13.5px] font-medium text-ink md:mx-0" data-testid="shared-note">
              <Lock className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
              You’ll only see what’s been shared with you{following ? `, plus what ${firstName} sends to followers` : ""}.
            </p>
          )}
          <h2 className="px-4 font-display text-[20px] font-bold tracking-tight md:px-1">{self ? "Posts" : "Posts shared with you"}</h2>
          {posts.length === 0 ? (
            <div className="px-4 md:px-0">
              <EmptyState icon={ImageOff} title={self ? "Nothing made yet" : `${firstName} hasn’t shared anything with you`}>
                {self ? "Create something, then pick who gets it." : "Their posts only appear here once they, or someone they shared with, send one to you."}
              </EmptyState>
            </div>
          ) : (
            <div>{posts.map((item) => <PostCard key={item.post.id} item={item} author={person} viewerId={viewer.id} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
