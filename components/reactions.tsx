import { Frown, Heart, Laugh, Sparkles, ThumbsUp, type LucideIcon } from "lucide-react";
import type { ReactionKind } from "@/lib/social";
import { cn } from "@/lib/utils";

export const REACTIONS: { kind: ReactionKind; label: string; Icon: LucideIcon; bg: string; text: string }[] = [
  { kind: "like", label: "Like", Icon: ThumbsUp, bg: "bg-brand", text: "text-brand-strong" },
  { kind: "love", label: "Love", Icon: Heart, bg: "bg-heart", text: "text-heart" },
  { kind: "haha", label: "Haha", Icon: Laugh, bg: "bg-[#f7b125]", text: "text-[#d18a00]" },
  { kind: "wow", label: "Wow", Icon: Sparkles, bg: "bg-[#7b5cff]", text: "text-[#6a4cf0]" },
  { kind: "sad", label: "Sad", Icon: Frown, bg: "bg-[#3b82f6]", text: "text-[#2f6fd8]" },
];

export function reactionMeta(kind: ReactionKind) {
  return REACTIONS.find((item) => item.kind === kind) ?? REACTIONS[0];
}

/** A small filled disc with the reaction icon, as used in summary rows. */
export function ReactionDisc({ kind, size = 18, className }: { kind: ReactionKind; size?: number; className?: string }) {
  const meta = reactionMeta(kind);
  const { Icon } = meta;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full text-white ring-2 ring-[rgb(var(--surface))]", meta.bg, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.6} fill={kind === "love" || kind === "like" ? "currentColor" : "none"} />
    </span>
  );
}
