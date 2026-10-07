import Link from "next/link";
import { redirect } from "next/navigation";
import { Clapperboard, Image as ImageIcon, Inbox, Plus, Video } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { TimelineCard } from "@/components/timeline-card";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getHomeFeed, listReels } from "@/lib/social";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const items = getHomeFeed(db, user.id);
  const reels = listReels(db, user.id).slice(0, 8);
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="md:pt-6">
      <h1 className="sr-only">Home</h1>

      {/* Composer: the same create flow, opened from the top of the feed. */}
      <section className="mb-2 bg-surface px-4 pb-2 pt-3 md:mb-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" aria-label="Create a post">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="shrink-0 rounded-full">
            <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="md" />
          </Link>
          <Link
            href="/create"
            data-testid="composer"
            className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-surface-2 px-4 text-[15px] text-ink-3 hover:bg-surface-3"
          >
            <span className="truncate">What’s on your mind, {firstName}?</span>
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 border-t border-line/70 pt-1">
          <Link href="/create?type=photo" className="press flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2">
            <ImageIcon className="h-[18px] w-[18px] text-brand" aria-hidden /> Photo
          </Link>
          <Link href="/create?type=video" className="press flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2">
            <Video className="h-[18px] w-[18px] text-heart" aria-hidden /> Video
          </Link>
          <Link href="/create?type=reel" className="press flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2">
            <Clapperboard className="h-[18px] w-[18px] text-[#7b5cff]" aria-hidden /> Reel
          </Link>
        </div>
      </section>

      {/* Reels strip: only reels someone sent you, plus your own. */}
      <section className="mb-2 bg-surface py-3 md:mb-4 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" aria-labelledby="reels-strip">
        <div className="flex items-center justify-between px-4">
          <h2 id="reels-strip" className="flex items-center gap-2 font-display text-[17px] font-bold tracking-tight">
            <Clapperboard className="h-[18px] w-[18px] text-brand" aria-hidden /> Reels
          </h2>
          <Link href="/reels" className="text-[13.5px] font-semibold text-brand-strong hover:underline">
            See all
          </Link>
        </div>
        <ul className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4" data-testid="reels-strip">
          <li className="shrink-0">
            <Link
              href="/create?type=reel"
              className="flex h-[176px] w-[104px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2 text-center text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-glow">
                <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden />
              </span>
              Create reel
            </Link>
          </li>
          {reels.map((reel) => (
            <li key={reel.post.id} className="shrink-0">
              <Link href={`/reels/${reel.post.id}`} className="relative block h-[176px] w-[104px] overflow-hidden rounded-2xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${reel.post.id}/0`} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" aria-hidden />
                <span className="absolute left-2 top-2">
                  <Avatar initials={reel.author.initials} color={reel.author.avatarColor} name={reel.author.displayName} size="sm" ring />
                </span>
                <span className="absolute inset-x-2 bottom-2 text-[12px] font-semibold leading-tight text-white">
                  <span className="line-clamp-2">{reel.post.mediaLabel}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-white/80">
                    {reel.author.id === user.id ? "Yours" : reel.reachedBy ? `From ${reel.reachedBy.displayName.split(" ")[0]}` : reel.author.displayName.split(" ")[0]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {items.length === 0 ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Inbox}
            title="Quiet for now"
            action={
              <Link href="/create" className="press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-brand-on shadow-glow">
                <Plus className="h-4 w-4" aria-hidden /> Make something
              </Link>
            }
          >
            LINE never fills this page for you. When a friend shares something with you, it shows up here with their name on it.
          </EmptyState>
        </div>
      ) : (
        <div>
          {items.map((item, index) => (
            <TimelineCard key={`${item.postId}-${item.shareId}`} item={item} index={index} />
          ))}
          <p className="px-6 py-8 text-center text-[13px] text-ink-3">You’re all caught up. Everything here was shared with you, or made by you.</p>
        </div>
      )}
    </div>
  );
}
