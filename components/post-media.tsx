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

function Frame({ postId, index, label, className }: { postId: number; index: number; label: string; className?: string }) {
  // Every frame is fetched through the gated media route. No access, no image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src(postId, index)} alt={label} loading="lazy" decoding="async" className={cn("h-full w-full object-cover", className)} />;
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

function usePlayer(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  const playing = enabled && inView && !paused;
  useEffect(() => {
    if (!playing || !sound) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    const tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.value = 220;
    tone.connect(gain);
    gain.connect(ctx.destination);
    tone.start();
    return () => {
      tone.stop();
      ctx.close().catch(() => undefined);
    };
  }, [playing, sound]);
  return { ref, playing, paused, setPaused, sound, setSound };
}

function PlayerChrome({
  playing,
  paused,
  onToggle,
  sound,
  onSound,
  kindLabel,
  big = true,
}: {
  playing: boolean;
  paused: boolean;
  onToggle: () => void;
  sound: boolean;
  onSound: () => void;
  kindLabel: string;
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
        {playing ? (
          <span className="flex h-3 items-end gap-[2px]" aria-hidden>
            <span className="eq-bar h-3 w-[2px] rounded bg-white" />
            <span className="eq-bar h-3 w-[2px] rounded bg-white [animation-delay:150ms]" />
            <span className="eq-bar h-3 w-[2px] rounded bg-white [animation-delay:300ms]" />
          </span>
        ) : kindLabel === "Reel" ? (
          <Clapperboard className="h-3 w-3" aria-hidden />
        ) : (
          <Play className="h-3 w-3 fill-white" aria-hidden />
        )}
        {kindLabel}
        {paused ? <span className="sr-only">, paused</span> : null}
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
          {sound && playing ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/25" aria-hidden>
        <span className={cn("block h-full bg-white", playing ? "progress-run" : "w-0")} />
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
  frames: { label: string }[];
  variant?: Variant;
}) {
  const video = kind === "video" || kind === "long_video" || kind === "reel" || kind === "short";
  const reel = kind === "reel" || kind === "short";
  const player = usePlayer(video && variant !== "tile");
  const tile = variant === "tile";

  if (kind === "text") {
    if (!tile && body.length > 160) return null;
    return <TextCard postId={postId} body={body} tile={tile} />;
  }
  if (!frames.length) return null;

  if (tile) {
    return (
      <div className="relative aspect-square overflow-hidden bg-surface-3">
        <Frame postId={postId} index={0} label={frames[0].label} />
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1 text-white backdrop-blur-md">
          {reel ? <Clapperboard className="h-3 w-3" aria-hidden /> : video ? <Play className="h-3 w-3 fill-white" aria-hidden /> : frames.length > 1 ? <Images className="h-3 w-3" aria-hidden /> : null}
          <span className="sr-only">{reel ? "Reel" : video ? "Video" : "Photo"}</span>
        </span>
      </div>
    );
  }

  if (video) {
    const aspect = variant === "reel" ? "h-full" : reel ? "aspect-[4/5]" : "aspect-video";
    return (
      <div ref={player.ref} className={cn("relative w-full overflow-hidden bg-black", aspect)}>
        <Frame postId={postId} index={0} label={frames[0].label} className={cn(player.playing && "kenburns")} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        <PlayerChrome
          playing={player.playing}
          paused={player.paused}
          onToggle={() => player.setPaused((value) => !value)}
          sound={player.sound}
          onSound={() => player.setSound((value) => !value)}
          kindLabel={reel ? "Reel" : "Video"}
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
        <Frame postId={postId} index={0} label={frames[0].label} />
      </div>
    );
  }
  if (count === 2) {
    return (
      <div className="grid aspect-[2/1.15] grid-cols-2 gap-0.5 bg-surface">
        {frames.map((frame, index) => (
          <div key={index} className="relative overflow-hidden bg-surface-3">
            <Frame postId={postId} index={index} label={frame.label} />
          </div>
        ))}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-surface">
        <div className="relative row-span-2 overflow-hidden bg-surface-3">
          <Frame postId={postId} index={0} label={frames[0].label} />
        </div>
        {frames.slice(1).map((frame, index) => (
          <div key={index} className="relative overflow-hidden bg-surface-3">
            <Frame postId={postId} index={index + 1} label={frame.label} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-surface">
      {frames.slice(0, 4).map((frame, index) => (
        <div key={index} className="relative overflow-hidden bg-surface-3">
          <Frame postId={postId} index={index} label={frame.label} />
          {index === 3 && count > 4 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-3xl font-bold text-white">+{count - 4}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
