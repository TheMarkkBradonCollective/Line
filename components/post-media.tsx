"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard, Images, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "feed" | "detail" | "tile" | "reel";

const TEXT_TONES = [
  ["#00bf8f", "#007a5c"],
  ["#ff5d8f", "#ff9e00"],
  ["#24527a", "#48cae4"],
  ["#7b2cbf", "#c77dff"],
  ["#e05a33", "#ffb703"],
];

function src(postId: number, index: number) {
  return `/media/${postId}/${index}`;
}

type MediaFrame = { mime: string };

function Photo({ postId, index, alt, className }: { postId: number; index: number; alt: string; className?: string }) {
  // Every file is fetched through the gated media route, which checks access and then redirects
  // to a short-lived signed URL. No access, no file.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src(postId, index)} alt={alt} loading="lazy" decoding="async" className={cn("h-full w-full object-cover", className)} />;
}

/** A still for grids and tiles. Videos show their first frame. */
function Still({ postId, frame, alt }: { postId: number; frame: MediaFrame; alt: string }) {
  if (frame.mime.startsWith("video/")) {
    return <video src={`${src(postId, 0)}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={alt} />;
  }
  return <Photo postId={postId} index={0} alt={alt} />;
}

/** Text post as a coloured card, the way short status updates look on a big social app. */
function TextCard({ postId, body, tile }: { postId: number; body: string; tile: boolean }) {
  const [from, to] = TEXT_TONES[postId % TEXT_TONES.length];
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", tile ? "aspect-square" : "aspect-[5/4]")}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}
    >
      <svg viewBox="0 0 400 320" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <circle cx="350" cy="40" r="120" fill="white" opacity="0.12" />
        <circle cx="30" cy="320" r="90" fill="white" opacity="0.08" />
      </svg>
      <p
        className={cn(
          "relative text-center font-display font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.18)]",
          tile ? "line-clamp-5 p-2.5 text-[12.5px]" : "px-7 text-[26px] sm:text-[30px]",
        )}
      >
        {body}
      </p>
    </div>
  );
}

function useVideo(enabled: boolean, autoplay: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(!autoplay);
  const [sound, setSound] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const node = box.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  const playing = enabled && inView && !paused;
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
  return { box, video, playing, paused, setPaused, sound, setSound, progress };
}

function PlayerChrome({
  playing,
  onToggle,
  sound,
  onSound,
  kindLabel,
  progress,
  big = true,
}: {
  playing: boolean;
  onToggle: () => void;
  sound: boolean;
  onSound: () => void;
  kindLabel: string;
  progress: number;
  big?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        aria-label={playing ? `Pause ${kindLabel}` : `Play ${kindLabel}`}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!playing ? (
          <span className={cn("flex items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md", big ? "h-16 w-16" : "h-12 w-12")}>
            <Play className={cn("fill-white", big ? "ml-1 h-7 w-7" : "ml-0.5 h-5 w-5")} aria-hidden />
          </span>
        ) : null}
      </button>
      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
        {kindLabel === "Loop" ? <Clapperboard className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3 fill-white" aria-hidden />}
        {kindLabel}
      </span>
      <button
        type="button"
        className="tap press absolute right-2 top-2 flex items-center justify-center rounded-full text-white"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSound();
        }}
        aria-pressed={sound}
        aria-label={sound ? "Mute" : "Turn sound on"}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
          {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/25" aria-hidden>
        <span className="block h-full bg-white transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
    </>
  );
}

export function PostMedia({
  postId,
  kind,
  body,
  frames,
  variant = "feed",
}: {
  postId: number;
  kind: string;
  body: string;
  frames: MediaFrame[];
  variant?: Variant;
}) {
  const isVideo = kind === "video" || kind === "long_video" || kind === "reel" || kind === "short";
  const reel = kind === "reel" || kind === "short";
  const tile = variant === "tile";
  const player = useVideo(isVideo && !tile && frames.length > 0, variant === "reel" || reel);
  const alt = body.slice(0, 120) || (reel ? "Loop" : isVideo ? "Video" : "Photo");

  if (kind === "text") {
    if (!tile && body.length > 160) return null;
    return <TextCard postId={postId} body={body} tile={tile} />;
  }
  if (!frames.length) return null;

  if (tile) {
    return (
      <div className="relative aspect-square overflow-hidden bg-surface-3">
        <Still postId={postId} frame={frames[0]} alt={alt} />
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1 text-white backdrop-blur-md">
          {reel ? <Clapperboard className="h-3 w-3" aria-hidden /> : isVideo ? <Play className="h-3 w-3 fill-white" aria-hidden /> : frames.length > 1 ? <Images className="h-3 w-3" aria-hidden /> : null}
          <span className="sr-only">{reel ? "Loop" : isVideo ? "Video" : "Photo"}</span>
        </span>
      </div>
    );
  }

  if (isVideo) {
    const aspect = variant === "reel" ? "h-full" : reel ? "aspect-[4/5]" : "aspect-video";
    return (
      <div ref={player.box} className={cn("relative w-full overflow-hidden bg-black", aspect)}>
        <video
          ref={player.video}
          src={src(postId, 0)}
          muted
          loop
          playsInline
          preload="metadata"
          className={cn("h-full w-full", variant === "reel" || reel ? "object-cover" : "object-contain")}
          aria-label={alt}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        <PlayerChrome
          playing={player.playing}
          onToggle={() => player.setPaused((value) => !value)}
          sound={player.sound}
          onSound={() => player.setSound((value) => !value)}
          kindLabel={reel ? "Loop" : "Video"}
          progress={player.progress}
          big={variant !== "reel"}
        />
      </div>
    );
  }

  // Photos: one, two, three, or a 2x2 grid with "+N".
  const count = frames.length;
  if (count === 1) {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-surface-3">
        <Photo postId={postId} index={0} alt={alt} />
      </div>
    );
  }
  if (count === 2) {
    return (
      <div className="grid aspect-[2/1.15] grid-cols-2 gap-0.5 bg-surface">
        {frames.map((_, index) => (
          <div key={index} className="relative overflow-hidden bg-surface-3">
            <Photo postId={postId} index={index} alt={`${alt} (${index + 1} of ${count})`} />
          </div>
        ))}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-surface">
        <div className="relative row-span-2 overflow-hidden bg-surface-3">
          <Photo postId={postId} index={0} alt={`${alt} (1 of 3)`} />
        </div>
        {frames.slice(1).map((_, index) => (
          <div key={index} className="relative overflow-hidden bg-surface-3">
            <Photo postId={postId} index={index + 1} alt={`${alt} (${index + 2} of 3)`} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-surface">
      {frames.slice(0, 4).map((_, index) => (
        <div key={index} className="relative overflow-hidden bg-surface-3">
          <Photo postId={postId} index={index} alt={`${alt} (${index + 1} of ${count})`} />
          {index === 3 && count > 4 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-3xl font-bold text-white">+{count - 4}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export { Still as MediaStill };
