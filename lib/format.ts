const KINDS: Record<string, string> = {
  text: "Note",
  photo: "Photo",
  video: "Video",
  short: "Reel",
  long_video: "Video",
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

/** Short relative time: now, 5m, 3h, 2d, then a date. */
export function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return formatWhen(iso).split(",")[0];
}
