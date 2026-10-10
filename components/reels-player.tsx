"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Clapperboard, MessageCircle, Play, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { reactAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { ReactionDisc, reactionMeta } from "@/components/reactions";
import { ShareButton } from "@/components/share-button";
import type { ReelItem } from "@/lib/social";
import { cn } from "@/lib/utils";

function ReelSlide({ reel, active, viewerId }: { reel: ReelItem; active: boolean; viewerId: number }) {
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [summary, setSummary] = useState(reel.reactions);
  const [, startTransition] = useTransition();
  const playing = active && !paused;
  const mine = summary.mine ? reactionMeta(summary.mine) : null;
  const MineIcon = mine?.Icon ?? ThumbsUp;
  const own = reel.author.id === viewerId;
  const video = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    node.muted = !sound;
    if (playing) node.play().catch(() => setPaused(true));
    else node.pause();
  }, [playing, sound]);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    const tick = () => setProgress(node.duration ? node.currentTime / node.duration : 0);
    node.addEventListener("timeupdate", tick);
    return () => node.removeEventListener("timeupdate", tick);
  }, []);

  function toggleLike() {
    const next = summary.mine ? null : "like";
    const before = summary;
    setSummary({
      ...summary,
      mine: next,
      total: summary.total + (next ? (summary.mine ? 0 : 1) : -1),
      top: summary.top.length ? summary.top : next ? ["like"] : [],
    });
    startTransition(async () => {
      try {
        setSummary(await reactAction(reel.post.id, next));
      } catch {
        setSummary(before);
      }
    });
  }

  return (
    <section
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black text-white"
      aria-label={`Reel by ${reel.author.displayName}`}
      data-testid="reel"
      data-reel-id={reel.post.id}
    >
      {reel.post.frames.length ? (
        <video
          ref={video}
          src={`/media/${reel.post.id}/0`}
          muted
          loop
          playsInline
          preload={active ? "auto" : "metadata"}
          className="h-full w-full object-cover"
          aria-label={reel.post.body.slice(0, 120) || "Reel"}
        />
      ) : null}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-white/20" aria-hidden>
        <span className="block h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" aria-hidden />
      <button
        type="button"
        className="absolute inset-0 flex items-center justify-center"
        aria-label={playing ? "Pause Loop" : "Play Loop"}
        onClick={() => setPaused((value) => !value)}
      >
        {!playing ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
            <Play className="ml-1 h-7 w-7 fill-white" aria-hidden />
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => setSound((value) => !value)}
        aria-pressed={sound}
        aria-label={sound ? "Mute" : "Turn sound on"}
        className="tap press absolute right-3 top-14 flex items-center justify-center rounded-full"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
          {sound ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {/* Right action column */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
        <Link href={`/u/${reel.author.username}`} aria-label={`${reel.author.displayName}'s profile`} className="rounded-full">
          <Avatar initials={reel.author.initials} color={reel.author.avatarColor} src={reel.author.avatarUrl} name={reel.author.displayName} size="md" ring />
        </Link>
        <button type="button" onClick={toggleLike} aria-pressed={Boolean(summary.mine)} aria-label={mine ? `${mine.label}, tap to remove` : "Like"} className="press flex flex-col items-center gap-1 text-[12px] font-semibold">
          <span className={cn("flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md", summary.mine ? "bg-white text-brand-strong" : "bg-black/35")}>
            {summary.mine ? <ReactionDisc kind={summary.mine} size={30} className="ring-0" /> : <MineIcon className="h-6 w-6" aria-hidden />}
          </span>
          <span className="tabular-nums drop-shadow">{summary.total}</span>
        </button>
        <Link href={`/post/${reel.post.id}#comments`} className="press flex flex-col items-center gap-1 text-[12px] font-semibold text-white" aria-label={`${reel.commentCount} comments`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
            <MessageCircle className="h-6 w-6" aria-hidden />
          </span>
          <span className="tabular-nums drop-shadow">{reel.commentCount}</span>
        </Link>
        <ShareButton postId={reel.post.id} count={reel.shareCount} variant="icon" />
      </div>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-5 pr-20">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Link href={`/u/${reel.author.username}`} className="text-white hover:underline">
            {reel.author.displayName}
          </Link>
        </p>
        <p className="mt-0.5 text-[12.5px] font-medium text-white/85">
          {own
            ? "Your Loop"
            : reel.reachedBy && reel.reachedBy.id !== reel.author.id
              ? `Passed to you by ${reel.reachedBy.displayName}`
              : "Shared with you"}
        </p>
        {reel.note ? <p className="mt-2 w-fit max-w-full rounded-2xl rounded-tl-md bg-white/20 px-3 py-1.5 text-[13.5px] backdrop-blur-md">{reel.note}</p> : null}
        <p className="mt-2 line-clamp-3 text-[14.5px] leading-snug drop-shadow">{reel.post.body}</p>
      </div>
    </section>
  );
}

/** Vertical swipe player. Only reels that were shared with the viewer (or made by them) are ever passed in. */
export function ReelsPlayer({ reels, viewerId }: { reels: ReelItem[]; viewerId: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-index]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reels.length]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] top-[calc(56px+env(safe-area-inset-top))] z-10 bg-black md:relative md:inset-auto md:z-auto md:mt-6 md:h-[calc(100dvh-48px)] md:overflow-hidden md:rounded-[28px] md:shadow-e3">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 text-white">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight drop-shadow">
          <Clapperboard className="h-5 w-5" aria-hidden /> Loops
        </h1>
        <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-md">Only Loops shared with you</span>
      </div>
      <div ref={scroller} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" data-testid="reels-scroller">
        {reels.map((reel, index) => (
          <div key={reel.post.id} data-index={index} className="h-full">
            <ReelSlide reel={reel} active={index === active} viewerId={viewerId} />
          </div>
        ))}
        {reels.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white">
            <Clapperboard className="h-10 w-10 text-brand" aria-hidden />
            <p className="font-display text-xl font-bold">No Loops yet</p>
            <p className="text-[14px] text-white/75">When a friend shares a Loop with you, it plays here. Nothing else does.</p>
            <Link href="/create?type=reel" className="press mt-2 inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-white">
              Make a Loop
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
