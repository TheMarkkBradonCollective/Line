export function Avatar({
  initials,
  color,
  name,
  size = "md",
}: {
  initials: string;
  color: string;
  name: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center font-medium text-card`}
      style={{ background: color }}
      aria-hidden={name ? undefined : true}
      title={name}
    >
      {initials}
    </span>
  );
}
