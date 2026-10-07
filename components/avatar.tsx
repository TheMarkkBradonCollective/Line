export function Avatar({
  initials,
  color,
  name,
  size = "md",
}: {
  initials: string;
  color: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "sm" ? "h-10 w-10 text-xs" : size === "lg" ? "h-24 w-24 text-2xl border-4 border-white" : "h-12 w-12 text-sm";
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white shadow-sm`}
      style={{ background: color }}
      title={name}
    >
      <span className="sr-only">{name}</span>
      <span aria-hidden>{initials}</span>
    </span>
  );
}
