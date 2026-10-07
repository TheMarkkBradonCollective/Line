"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon, Play, Type, Volume2, VolumeX } from "lucide-react";
import { isVideoKind, kindLabel } from "@/lib/format";

const SCENE_COLORS: Record<string, [string, string]> = {
  market: ["#ffb703", "#fb8500"],
  water: ["#48cae4", "#0077b6"],
  kitchen: ["#ff8fab", "#fb6f92"],
  loaf: ["#e09f3e", "#9c6644"],
  street: ["#7b2cbf", "#c77dff"],
  abstract: ["#00bf8f", "#009e78"],
};

function colorsOf(tone: string | null, scene: string) {
  if (tone) {
    const parts = tone.split(",").map((part) => part.trim());
    return { from: parts[0] || "#00bf8f", to: parts[1] || parts[0] || "#009e78" };
  }
  const pair = SCENE_COLORS[scene] ?? SCENE_COLORS.abstract;
  return { from: pair[0], to: pair[1] };
}

function sceneOf(label: string) {
  const text = label.toLowerCase();
  if (text.includes("market") || text.includes("hall") || text.includes("morning")) return "market";
  if (text.includes("river") || text.includes("creek") || text.includes("rain") || text.includes("bridge")) return "water";
  if (text.includes("kitchen") || text.includes("peach") || text.includes("bun") || text.includes("table")) return "kitchen";
  if (text.includes("loaf") || text.includes("bread") || text.includes("cracked")) return "loaf";
  if (text.includes("skate") || text.includes("bowl") || text.includes("street") || text.includes("dusk") || text.includes("rooftop") || text.includes("golden")) return "street";
  return "abstract";
}

function Scene({ scene, from, to, gradId }: { scene: string; from: string; to: string; gradId: string }) {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${gradId})`} />
      {scene === "water" ? (
        <>
          <ellipse className="drift" cx="90" cy="78" rx="46" ry="18" fill="white" opacity="0.35" />
          <ellipse className="drift" cx="230" cy="54" rx="62" ry="20" fill="white" opacity="0.28" />
          <path d="M0 250 C 70 220 120 280 200 250 C 280 220 330 280 400 246 L 400 400 L 0 400 Z" fill="white" opacity="0.28" />
          <path className="drift" d="M0 290 C 80 260 130 320 210 286 C 290 252 340 320 400 286 L 400 400 L 0 400 Z" fill="#073b4c" opacity="0.25" />
          <circle className="bob" cx="300" cy="120" r="28" fill="#fff3bf" />
        </>
      ) : null}
      {scene === "market" ? (
        <>
          <path d="M40 250 L 90 150 L 200 250 Z" fill="white" opacity="0.9" />
          <path d="M150 250 L 210 140 L 330 250 Z" fill="#fff3bf" />
          <rect x="70" y="250" width="230" height="16" rx="4" fill="#6b3a2a" />
          <circle className="bob" cx="120" cy="300" r="22" fill="#e85d04" />
          <circle className="bob" cx="168" cy="308" r="16" fill="#faa307" />
          <circle cx="210" cy="304" r="18" fill="#d00000" />
          <rect x="250" y="180" width="18" height="90" fill="#6b3a2a" />
        </>
      ) : null}
      {scene === "kitchen" ? (
        <>
          <rect x="36" y="210" width="328" height="120" rx="18" fill="white" opacity="0.88" />
          <circle className="bob" cx="120" cy="196" r="34" fill="#ffb703" />
          <circle cx="168" cy="210" r="28" fill="#fb8500" />
          <circle className="bob" cx="250" cy="188" r="22" fill="#e85d04" />
          <rect x="70" y="248" width="90" height="46" rx="10" fill="#ff8fab" />
          <rect x="190" y="256" width="120" height="28" rx="8" fill="#ffe5ec" />
        </>
      ) : null}
      {scene === "loaf" ? (
        <>
          <ellipse cx="200" cy="250" rx="130" ry="70" fill="#9c6644" />
          <ellipse cx="200" cy="230" rx="120" ry="58" fill="#e09f3e" />
          <path d="M150 220 Q 200 270 250 220" stroke="#6b3a2a" strokeWidth="8" fill="none" />
          <circle className="bob" cx="300" cy="120" r="36" fill="#fff3bf" opacity="0.9" />
        </>
      ) : null}
      {scene === "street" ? (
        <>
          <rect x="40" y="120" width="70" height="200" fill="#240046" opacity="0.35" />
          <rect x="130" y="70" width="90" height="250" fill="#3c096c" opacity="0.45" />
          <rect x="240" y="140" width="110" height="180" fill="#10002b" opacity="0.35" />
          <circle className="bob" cx="300" cy="90" r="26" fill="#ffd60a" />
          <rect x="0" y="310" width="400" height="90" fill="#111" opacity="0.25" />
        </>
      ) : null}
      {scene === "abstract" ? (
        <>
          <circle className="bob" cx="120" cy="140" r="70" fill="white" opacity="0.28" />
          <circle className="drift" cx="270" cy="220" r="90" fill="white" opacity="0.18" />
          <circle cx="200" cy="300" r="40" fill="#fff" opacity="0.35" />
        </>
      ) : null}
    </svg>
  );
}

export function LoopMedia({
  kind,
  label,
  tone,
  body,
  interactive = true,
  tile = false,
}: {
  kind: string;
  label: string | null;
  tone: string | null;
  body?: string;
  interactive?: boolean;
  tile?: boolean;
}) {
  const gradId = useId().replace(/:/g, "");
  const frame = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [sound, setSound] = useState(false);
  const video = isVideoKind(kind);
  const scene = sceneOf(`${label ?? ""} ${body ?? ""}`);
  const { from, to } = colorsOf(tone, scene);
  const tall = !tile && (kind === "short" || kind === "reel");
  const playing = video && interactive && inView;

  useEffect(() => {
    if (!interactive || !video) return;
    const node = frame.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [interactive, video]);

  useEffect(() => {
    if (!playing || !sound) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    const low = ctx.createOscillator();
    const high = ctx.createOscillator();
    low.type = "sine";
    high.type = "triangle";
    low.frequency.value = 196;
    high.frequency.value = 247;
    low.connect(gain);
    high.connect(gain);
    gain.connect(ctx.destination);
    low.start();
    high.start();
    return () => {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      low.stop(ctx.currentTime + 0.08);
      high.stop(ctx.currentTime + 0.08);
      ctx.close().catch(() => undefined);
    };
  }, [playing, sound]);

  return (
    <figure
      ref={frame}
      className={`relative h-full w-full overflow-hidden bg-black ${tile ? "aspect-square" : tall ? "aspect-[4/5]" : "aspect-square"} ${playing ? "media-live" : ""}`}
    >
      {kind === "text" ? (
        <div className="relative flex h-full flex-col justify-end overflow-hidden" style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}>
          <svg viewBox="0 0 400 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="340" cy="60" r="120" fill="white" opacity="0.12" />
            <circle cx="40" cy="380" r="90" fill="white" opacity="0.08" />
          </svg>
          {!tile ? (
            <span aria-hidden className="absolute left-5 top-3 font-display text-[110px] font-extrabold leading-none text-white/25">
              “
            </span>
          ) : null}
          <p
            className={`relative font-display font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.18)] ${
              tile ? "line-clamp-4 p-2.5 text-[13px]" : "p-6 text-[28px] sm:text-[32px]"
            }`}
          >
            {body}
          </p>
        </div>
      ) : (
        <Scene scene={scene} from={from} to={to} gradId={gradId} />
      )}
      {kind !== "text" && !tile ? (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-4 pt-20 text-white">
          <p className="font-display text-[22px] font-bold leading-tight tracking-tight drop-shadow">{label}</p>
        </figcaption>
      ) : null}
      {!tile ? (
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          {video ? (
            playing ? (
              <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                <span className="eq-bar h-3 w-[2px] rounded bg-white" />
                <span className="eq-bar h-3 w-[2px] rounded bg-white [animation-delay:150ms]" />
                <span className="eq-bar h-3 w-[2px] rounded bg-white [animation-delay:300ms]" />
              </span>
            ) : (
              <Play className="h-3 w-3 fill-white" aria-hidden />
            )
          ) : kind === "text" ? (
            <Type className="h-3 w-3" aria-hidden />
          ) : (
            <ImageIcon className="h-3 w-3" aria-hidden />
          )}
          {kindLabel(kind)}
          {video && !playing ? <span className="sr-only">, paused</span> : null}
        </span>
      ) : null}
      {kind !== "text" && tile ? (
        <figcaption className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/40 p-1 text-white backdrop-blur-md">
          {video ? <Play className="h-3 w-3 fill-white" aria-hidden /> : <ImageIcon className="h-3 w-3" aria-hidden />}
          <span className="sr-only">{kindLabel(kind)}</span>
        </figcaption>
      ) : null}
      {video && interactive ? (
        <button
          type="button"
          className="tap press absolute right-2 top-2 flex items-center justify-center rounded-full text-white"
          onClick={() => setSound((value) => !value)}
          aria-pressed={sound}
          aria-label={sound ? "Mute" : "Turn sound on"}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
            {sound && playing ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          </span>
        </button>
      ) : null}
    </figure>
  );
}
