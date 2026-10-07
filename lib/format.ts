const KINDS: Record<string, string> = {
  text: "Note",
  photo: "Photo",
  video: "Video",
  short: "Short",
  long_video: "Longer video",
  reel: "Reel",
};

export function kindLabel(kind: string) {
  return KINDS[kind] ?? kind;
}

export function isVideoKind(kind: string) {
  return kind === "video" || kind === "short" || kind === "long_video" || kind === "reel";
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
