import { CircleAlert, CircleCheck } from "lucide-react";

export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  const bad = Boolean(error);
  const Icon = bad ? CircleAlert : CircleCheck;
  return (
    <p
      role={bad ? "alert" : "status"}
      className={`animate-pop mb-4 flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-medium ${
        bad ? "banner-warn" : "border border-brand/30 bg-brand-soft text-ink"
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${bad ? "" : "text-brand-strong"}`} aria-hidden />
      <span>{error || notice}</span>
    </p>
  );
}
