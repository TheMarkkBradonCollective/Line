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
  const glow = `${gradId}-glow`;
  const vignette = `${gradId}-vig`;
  const grain = `${gradId}-grain`;
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={glow} cx="0.72" cy="0.22" r="0.6">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={vignette} cx="0.5" cy="0.45" r="0.75">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
        <filter id={grain}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" />
        </filter>
      </defs>
      <rect width="400" height="400" fill={`url(#${gradId})`} />
      <rect width="400" height="400" fill={`url(#${glow})`} />
      {scene === "water" ? (
        <>
          <circle className="bob" cx="296" cy="112" r="34" fill="#fff6cc" />
          <circle cx="296" cy="112" r="58" fill="#fff6cc" opacity="0.18" />
          <ellipse className="drift" cx="90" cy="82" rx="54" ry="16" fill="white" opacity="0.4" />
          <ellipse className="drift" cx="200" cy="58" rx="70" ry="18" fill="white" opacity="0.28" />
          <path d="M0 230 L 70 170 L 130 210 L 210 150 L 290 215 L 340 185 L 400 220 L 400 260 L 0 260 Z" fill="#073b4c" opacity="0.35" />
          <path d="M0 250 C 70 225 120 280 200 252 C 280 224 330 280 400 248 L 400 400 L 0 400 Z" fill="white" opacity="0.22" />
          <path className="drift" d="M0 292 C 80 262 130 322 210 288 C 290 254 340 322 400 288 L 400 400 L 0 400 Z" fill="#023047" opacity="0.32" />
          <path d="M280 270 h40 M262 300 h70 M290 330 h30" stroke="#fff6cc" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        </>
      ) : null}
      {scene === "market" ? (
        <>
          <circle className="bob" cx="310" cy="96" r="30" fill="#fff6cc" opacity="0.95" />
          <path d="M30 170 h340 v18 H30z" fill="#7a2e12" opacity="0.85" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={i} d={`M${30 + i * 42.5} 188 h42.5 l-6 34 h-30.5 z`} fill={i % 2 ? "#fff" : "#e63946"} opacity={i % 2 ? 0.95 : 0.9} />
          ))}
          <rect x="44" y="222" width="8" height="110" fill="#5a2a14" />
          <rect x="348" y="222" width="8" height="110" fill="#5a2a14" />
          <rect x="40" y="290" width="320" height="22" rx="6" fill="#6b3a2a" />
          <circle className="bob" cx="100" cy="276" r="20" fill="#e85d04" />
          <circle cx="138" cy="282" r="15" fill="#faa307" />
          <circle cx="172" cy="278" r="18" fill="#d00000" />
          <circle className="bob" cx="214" cy="281" r="15" fill="#ffd60a" />
          <circle cx="250" cy="279" r="17" fill="#80b918" />
          <circle cx="290" cy="281" r="15" fill="#fb8500" />
          <path d="M0 340 h400 v60 H0z" fill="#000" opacity="0.18" />
        </>
      ) : null}
      {scene === "kitchen" ? (
        <>
          <rect x="0" y="0" width="400" height="200" fill="white" opacity="0.06" />
          <path d="M60 0 v120 M340 0 v90" stroke="white" strokeWidth="2" opacity="0.4" />
          <circle cx="60" cy="132" r="14" fill="#fff6cc" opacity="0.95" />
          <circle cx="60" cy="132" r="34" fill="#fff6cc" opacity="0.2" />
          <ellipse cx="200" cy="300" rx="190" ry="70" fill="white" opacity="0.9" />
          <ellipse cx="200" cy="292" rx="120" ry="40" fill="#ffe5ec" />
          <circle className="bob" cx="160" cy="276" r="26" fill="#ffb703" />
          <circle cx="200" cy="286" r="24" fill="#fb8500" />
          <circle className="bob" cx="242" cy="272" r="22" fill="#ff8fab" />
          <path d="M150 252 q6 -12 14 -4" stroke="#386641" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="300" y="210" width="44" height="64" rx="10" fill="white" opacity="0.85" />
          <rect x="306" y="226" width="32" height="40" rx="6" fill="#fb6f92" opacity="0.6" />
        </>
      ) : null}
      {scene === "loaf" ? (
        <>
          <circle className="bob" cx="304" cy="104" r="40" fill="#fff6cc" opacity="0.85" />
          <rect x="0" y="300" width="400" height="100" fill="#3d2314" opacity="0.4" />
          <ellipse cx="200" cy="300" rx="150" ry="26" fill="#000" opacity="0.2" />
          <ellipse cx="200" cy="262" rx="134" ry="68" fill="#7f4f24" />
          <ellipse cx="200" cy="244" rx="124" ry="58" fill="#c98c44" />
          <path d="M120 232 q30 -26 60 0 M170 222 q30 -26 60 0 M220 232 q30 -26 60 0" stroke="#7f4f24" strokeWidth="7" fill="none" strokeLinecap="round" />
          <ellipse cx="170" cy="214" rx="60" ry="12" fill="white" opacity="0.18" />
        </>
      ) : null}
      {scene === "street" ? (
        <>
          <circle className="bob" cx="300" cy="104" r="40" fill="#ffd166" />
          <circle cx="300" cy="104" r="76" fill="#ffd166" opacity="0.22" />
          <g opacity="0.92">
            <path d="M30 400 V176 h70 v-26 h20 v26 h10 V400z" fill="#2b0f3a" opacity="0.7" />
            <path d="M140 400 V110 h86 V400z" fill="#3c096c" opacity="0.78" />
            <path d="M246 400 V196 l52 -34 l52 34 V400z" fill="#240046" opacity="0.72" />
          </g>
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={154 + col * 24}
                y={130 + row * 34}
                width="12"
                height="16"
                rx="2"
                fill="#ffd166"
                opacity={(row + col) % 3 === 0 ? 0.9 : 0.25}
              />
            )),
          )}
          {[0, 1, 2, 3].map((row) => (
            <rect key={row} x={50} y={196 + row * 36} width="40" height="12" rx="2" fill="#ffd166" opacity={row % 2 ? 0.25 : 0.75} />
          ))}
          <rect x="0" y="330" width="400" height="70" fill="#10002b" opacity="0.5" />
          <path d="M0 360 h400" stroke="#ffd166" strokeWidth="3" strokeDasharray="22 18" opacity="0.5" />
        </>
      ) : null}
      {scene === "abstract" ? (
        <>
          <circle className="bob" cx="130" cy="140" r="80" fill="white" opacity="0.22" />
          <circle className="drift" cx="270" cy="230" r="100" fill="white" opacity="0.14" />
          <circle cx="200" cy="320" r="44" fill="#fff" opacity="0.3" />
        </>
      ) : null}
      <rect width="400" height="400" fill={`url(#${vignette})`} />
      <rect width="400" height="400" filter={`url(#${grain})`} opacity="0.9" />
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
            <span aria-hidden className="absolute left-5 top-9 font-display text-[110px] font-extrabold leading-none text-white/25">
              “
            </span>
          ) : null}
          <p
            className={`relative font-display font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.18)] ${
              tile ? "p-2.5 text-[13px]" : "p-6 text-[28px] sm:text-[32px]"
            }`}
          >
            {tile ? <span className="line-clamp-4">{body}</span> : body}
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
