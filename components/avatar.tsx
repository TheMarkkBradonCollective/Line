import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
} as const;

type Size = keyof typeof SIZES;

/** Lighter top-left, deeper bottom-right, so a flat color reads like a lit photo frame. */
function fill(color: string) {
  return `radial-gradient(120% 120% at 25% 15%, color-mix(in srgb, ${color} 70%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 75%, black) 100%)`;
}

export function Avatar({
  initials,
  color,
  name,
  size = "md",
  ring = false,
  className,
}: {
  initials: string;
  color: string;
  name: string;
  size?: Size;
  ring?: boolean;
  className?: string;
}) {
  const face = (
    <span
      className={cn(
        SIZES[size],
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight text-white",
        !ring && className,
      )}
      style={{ background: fill(color) }}
      title={name}
    >
      <span className="sr-only">{name}</span>
      <span aria-hidden className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]">
        {initials}
      </span>
    </span>
  );
  if (!ring) return face;
  return (
    <span
      className={cn("inline-flex shrink-0 rounded-full p-[3px]", className)}
      style={{ background: "conic-gradient(from 210deg, rgb(var(--brand)), #7cf2c8, rgb(var(--brand-deep)), rgb(var(--brand)))" }}
    >
      <span className="inline-flex rounded-full bg-surface p-[3px]">{face}</span>
    </span>
  );
}

type Face = { initials: string; avatarColor: string; displayName: string };

/** Overlapping avatars. Used for share chains, so order matters: first person on the left. */
export function AvatarStack({ people, size = "xs", max = 4 }: { people: Face[]; size?: Size; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((person, index) => (
        <span
          key={`${person.displayName}-${index}`}
          className="-ml-1.5 inline-flex rounded-full ring-2 ring-[rgb(var(--surface))] first:ml-0"
          style={{ zIndex: shown.length - index }}
        >
          <Avatar initials={person.initials} color={person.avatarColor} name={person.displayName} size={size} />
        </span>
      ))}
      {extra > 0 ? (
        <span className="-ml-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-3 px-1 text-[10px] font-semibold text-ink-2 ring-2 ring-[rgb(var(--surface))]">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
