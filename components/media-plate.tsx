import { kindLabel } from "@/lib/format";

export function MediaPlate({
  kind,
  label,
  tone,
}: {
  kind: string;
  label: string;
  tone: string;
}) {
  const tall = kind === "short" || kind === "reel";
  return (
    <figure className={`mt-4 border border-rule ${tall ? "max-w-[220px]" : ""}`}>
      <div
        className={`flex flex-col justify-between p-4 text-ink ${tall ? "aspect-[9/14]" : "aspect-[4/3]"}`}
        style={{ background: tone }}
      >
        <span className="kicker">{kindLabel(kind)} · placeholder</span>
        <figcaption className="font-serif text-2xl leading-tight">{label}</figcaption>
      </div>
      <figcaption className="border-t border-rule bg-card px-3 py-2 text-xs text-muted">
        Placeholder frame. Nothing was uploaded or transcoded.
      </figcaption>
    </figure>
  );
}
