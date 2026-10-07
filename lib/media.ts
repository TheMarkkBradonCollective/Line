/**
 * Placeholder frames. Real upload is not connected, so each photo, video poster, and reel
 * cover is drawn as an SVG from its label and tone. The only way to fetch one is
 * /media/[postId]/[index], which checks access first.
 */

const SCENE_COLORS: Record<string, [string, string]> = {
  market: ["#ffb703", "#fb8500"],
  water: ["#48cae4", "#0077b6"],
  kitchen: ["#ff8fab", "#fb6f92"],
  loaf: ["#e09f3e", "#9c6644"],
  street: ["#7b2cbf", "#c77dff"],
  camp: ["#1a936f", "#24527a"],
  abstract: ["#00bf8f", "#009e78"],
};

export function sceneOf(label: string) {
  const text = label.toLowerCase();
  if (text.includes("camp") || text.includes("bend") || text.includes("rapids") || text.includes("bike") || text.includes("loop by")) return "camp";
  if (text.includes("market") || text.includes("hall") || text.includes("morning") || text.includes("coffee") || text.includes("lantern")) return "market";
  if (text.includes("river") || text.includes("creek") || text.includes("rain") || text.includes("bridge")) return "water";
  if (text.includes("kitchen") || text.includes("peach") || text.includes("bun") || text.includes("table") || text.includes("sauce") || text.includes("pancake") || text.includes("last one")) return "kitchen";
  if (text.includes("loaf") || text.includes("bread") || text.includes("cracked")) return "loaf";
  if (text.includes("skate") || text.includes("bowl") || text.includes("street") || text.includes("dusk") || text.includes("rooftop") || text.includes("golden")) return "street";
  return "abstract";
}

export function colorsOf(tone: string | null | undefined, scene: string) {
  if (tone) {
    const parts = tone.split(",").map((part) => part.trim());
    const valid = (value: string | undefined) => (value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined);
    const from = valid(parts[0]);
    if (from) return { from, to: valid(parts[1]) ?? from };
  }
  const pair = SCENE_COLORS[scene] ?? SCENE_COLORS.abstract;
  return { from: pair[0], to: pair[1] };
}

function sceneBody(scene: string) {
  switch (scene) {
    case "water":
      return `
<circle cx="296" cy="112" r="34" fill="#fff6cc"/>
<circle cx="296" cy="112" r="58" fill="#fff6cc" opacity="0.18"/>
<ellipse cx="90" cy="82" rx="54" ry="16" fill="#fff" opacity="0.4"/>
<ellipse cx="200" cy="58" rx="70" ry="18" fill="#fff" opacity="0.28"/>
<path d="M0 230 L 70 170 L 130 210 L 210 150 L 290 215 L 340 185 L 400 220 L 400 260 L 0 260 Z" fill="#073b4c" opacity="0.35"/>
<path d="M0 250 C 70 225 120 280 200 252 C 280 224 330 280 400 248 L 400 400 L 0 400 Z" fill="#fff" opacity="0.22"/>
<path d="M0 292 C 80 262 130 322 210 288 C 290 254 340 322 400 288 L 400 400 L 0 400 Z" fill="#023047" opacity="0.32"/>
<path d="M280 270 h40 M262 300 h70 M290 330 h30" stroke="#fff6cc" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`;
    case "market":
      return `
<circle cx="310" cy="96" r="30" fill="#fff6cc" opacity="0.95"/>
<path d="M30 170 h340 v18 H30z" fill="#7a2e12" opacity="0.85"/>
${[0, 1, 2, 3, 4, 5, 6, 7]
  .map((i) => `<path d="M${30 + i * 42.5} 188 h42.5 l-6 34 h-30.5 z" fill="${i % 2 ? "#fff" : "#e63946"}" opacity="${i % 2 ? 0.95 : 0.9}"/>`)
  .join("")}
<rect x="44" y="222" width="8" height="110" fill="#5a2a14"/>
<rect x="348" y="222" width="8" height="110" fill="#5a2a14"/>
<rect x="40" y="290" width="320" height="22" rx="6" fill="#6b3a2a"/>
<circle cx="100" cy="276" r="20" fill="#e85d04"/>
<circle cx="138" cy="282" r="15" fill="#faa307"/>
<circle cx="172" cy="278" r="18" fill="#d00000"/>
<circle cx="214" cy="281" r="15" fill="#ffd60a"/>
<circle cx="250" cy="279" r="17" fill="#80b918"/>
<circle cx="290" cy="281" r="15" fill="#fb8500"/>
<path d="M0 340 h400 v60 H0z" fill="#000" opacity="0.18"/>`;
    case "kitchen":
      return `
<rect x="0" y="0" width="400" height="200" fill="#fff" opacity="0.06"/>
<path d="M60 0 v120 M340 0 v90" stroke="#fff" stroke-width="2" opacity="0.4"/>
<circle cx="60" cy="132" r="14" fill="#fff6cc" opacity="0.95"/>
<circle cx="60" cy="132" r="34" fill="#fff6cc" opacity="0.2"/>
<ellipse cx="200" cy="300" rx="190" ry="70" fill="#fff" opacity="0.9"/>
<ellipse cx="200" cy="292" rx="120" ry="40" fill="#ffe5ec"/>
<circle cx="160" cy="276" r="26" fill="#ffb703"/>
<circle cx="200" cy="286" r="24" fill="#fb8500"/>
<circle cx="242" cy="272" r="22" fill="#ff8fab"/>
<path d="M150 252 q6 -12 14 -4" stroke="#386641" stroke-width="4" fill="none" stroke-linecap="round"/>
<rect x="300" y="210" width="44" height="64" rx="10" fill="#fff" opacity="0.85"/>
<rect x="306" y="226" width="32" height="40" rx="6" fill="#fb6f92" opacity="0.6"/>`;
    case "loaf":
      return `
<circle cx="304" cy="104" r="40" fill="#fff6cc" opacity="0.85"/>
<rect x="0" y="300" width="400" height="100" fill="#3d2314" opacity="0.4"/>
<ellipse cx="200" cy="300" rx="150" ry="26" fill="#000" opacity="0.2"/>
<ellipse cx="200" cy="262" rx="134" ry="68" fill="#7f4f24"/>
<ellipse cx="200" cy="244" rx="124" ry="58" fill="#c98c44"/>
<path d="M120 232 q30 -26 60 0 M170 222 q30 -26 60 0 M220 232 q30 -26 60 0" stroke="#7f4f24" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="170" cy="214" rx="60" ry="12" fill="#fff" opacity="0.18"/>`;
    case "street":
      return `
<circle cx="300" cy="104" r="40" fill="#ffd166"/>
<circle cx="300" cy="104" r="76" fill="#ffd166" opacity="0.22"/>
<g opacity="0.92">
<path d="M30 400 V176 h70 v-26 h20 v26 h10 V400z" fill="#2b0f3a" opacity="0.7"/>
<path d="M140 400 V110 h86 V400z" fill="#3c096c" opacity="0.78"/>
<path d="M246 400 V196 l52 -34 l52 34 V400z" fill="#240046" opacity="0.72"/>
</g>
${[0, 1, 2, 3, 4, 5]
  .flatMap((row) =>
    [0, 1, 2].map(
      (col) =>
        `<rect x="${154 + col * 24}" y="${130 + row * 34}" width="12" height="16" rx="2" fill="#ffd166" opacity="${(row + col) % 3 === 0 ? 0.9 : 0.25}"/>`,
    ),
  )
  .join("")}
${[0, 1, 2, 3].map((row) => `<rect x="50" y="${196 + row * 36}" width="40" height="12" rx="2" fill="#ffd166" opacity="${row % 2 ? 0.25 : 0.75}"/>`).join("")}
<rect x="0" y="330" width="400" height="70" fill="#10002b" opacity="0.5"/>
<path d="M0 360 h400" stroke="#ffd166" stroke-width="3" stroke-dasharray="22 18" opacity="0.5"/>`;
    case "camp":
      return `
<circle cx="110" cy="96" r="28" fill="#fff6cc" opacity="0.9"/>
<path d="M0 250 L 80 150 L 150 220 L 230 120 L 320 230 L 400 170 L 400 400 L 0 400 Z" fill="#073b4c" opacity="0.45"/>
<path d="M0 300 C 90 270 160 320 240 290 C 310 266 360 300 400 290 L 400 400 L 0 400 Z" fill="#fff" opacity="0.2"/>
<path d="M150 320 L 200 236 L 250 320 Z" fill="#ff9e00"/>
<path d="M200 236 L 214 320 L 186 320 Z" fill="#7a2e12" opacity="0.6"/>
${[40, 80, 330, 365].map((x, i) => `<path d="M${x} ${330 - (i % 2) * 20} l18 -70 l18 70 z" fill="#0b3d2e" opacity="0.85"/>`).join("")}
<path d="M0 352 h400 v48 H0z" fill="#000" opacity="0.18"/>`;
    default:
      return `
<circle cx="130" cy="140" r="80" fill="#fff" opacity="0.22"/>
<circle cx="270" cy="230" r="100" fill="#fff" opacity="0.14"/>
<circle cx="200" cy="320" r="44" fill="#fff" opacity="0.3"/>`;
  }
}

/** A complete standalone SVG for one frame. */
export function renderFrameSvg(input: { label: string; tone?: string | null; seed?: string }) {
  const scene = sceneOf(input.label);
  const { from, to } = colorsOf(input.tone, scene);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient>
<radialGradient id="glow" cx="0.72" cy="0.22" r="0.6"><stop offset="0%" stop-color="#fff" stop-opacity="0.55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0"/></filter>
</defs>
<rect width="400" height="400" fill="url(#g)"/>
<rect width="400" height="400" fill="url(#glow)"/>
${sceneBody(scene)}
<rect width="400" height="400" fill="url(#vig)"/>
<rect width="400" height="400" filter="url(#grain)" opacity="0.9"/>
</svg>`;
}

export function mediaUrl(postId: number, index = 0) {
  return `/media/${postId}/${index}`;
}
