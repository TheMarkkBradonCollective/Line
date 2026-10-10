import { PageHeader } from "@/components/page-header";
import { RULES } from "@/lib/rules";

export const metadata = { title: "How LINE works" };

/** The same rules as docs/RULES.md, from one source. */
export default function HowLineWorksPage() {
  return (
    <div>
      <PageHeader kicker="Settings" title="How LINE works" subtitle="The rules, in plain language. The app enforces exactly these." />
      <div className="grid gap-3 px-4 pb-6 md:px-0" data-testid="rules">
        {RULES.map((section, i) => (
          <section key={section.title} className="surface-card p-4">
            <h2 className="flex items-center gap-2.5 font-display text-[18px] font-bold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-strong">{i + 1}</span>
              {section.title}
            </h2>
            <ul className="mt-2.5 grid gap-2">
              {section.points.map((point) => (
                <li key={point} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
