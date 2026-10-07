import { redirect } from "next/navigation";
import { Clapperboard, Film, Image as ImageIcon, Repeat2, Send, Smartphone, Type, Video } from "lucide-react";
import { createPostAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { RecipientPicker } from "@/components/recipient-picker";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSetting, listCustomLists, listFriends, listGroups, MEDIA_PLATES } from "@/lib/social";

const KINDS = [
  ["text", "Note", Type],
  ["photo", "Photo", ImageIcon],
  ["video", "Video", Video],
  ["short", "Short", Smartphone],
  ["long_video", "Long video", Film],
  ["reel", "Reel", Clapperboard],
] as const;

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card min-w-0 p-4 sm:p-5">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-strong">{n}</span>
        <div>
          <h2 className="font-display text-[17px] font-bold leading-tight tracking-tight">{title}</h2>
          {hint ? <p className="text-[12.5px] text-ink-3">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const paused = getSetting(db, "sharing_paused") === "1";

  return (
    <div>
      <PageHeader title="Create" subtitle="Make it, then choose exactly who gets it. Nothing goes anywhere until you pick." />
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        {paused ? (
          <p className="banner-warn mb-4 px-3.5 py-3 text-sm">Sharing is paused by an emergency control. You can draft, but delivery will be refused.</p>
        ) : null}
      </div>
      <form action={createPostAction} className="grid grid-cols-1 gap-3 px-4 md:px-0">
        <Step n={1} title="What are you making?">
          <fieldset>
            <legend className="sr-only">Kind</legend>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(([id, label, Icon]) => (
                <label key={id} className="pick flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-[13px] font-semibold text-ink-2 has-[:checked]:text-brand-strong">
                  <input type="radio" name="kind" value={id} defaultChecked={id === "text"} className="sr-only" />
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block">
            <span className="sr-only">Words</span>
            <textarea
              className="field min-h-36 resize-none text-[17px] leading-relaxed"
              name="body"
              required
              placeholder="Write the thing you actually want someone to have…"
            />
          </label>
        </Step>

        <Step n={2} title="Pick a frame" hint="For photos and video. Real upload isn’t connected yet, so you pick a placeholder.">
          <fieldset>
            <legend className="sr-only">Placeholder frame</legend>
            <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
              {MEDIA_PLATES.map((plate) => {
                const [a, b] = plate.tone.split(",");
                return (
                  <label key={plate.id} className="group relative shrink-0 cursor-pointer">
                    <input type="radio" name="plate" value={plate.id} className="peer sr-only" />
                    <span
                      className="flex h-28 w-24 items-end overflow-hidden rounded-2xl p-2 ring-2 ring-transparent ring-offset-2 ring-offset-[rgb(var(--surface))] transition peer-checked:ring-brand peer-focus-visible:ring-brand"
                      style={{ background: `linear-gradient(150deg, ${a}, ${b ?? a})` }}
                    >
                      <span className="text-[11px] font-semibold leading-tight text-white drop-shadow">{plate.label}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Step>

        <Step n={3} title="Who gets it?" hint="Each pick puts it on that person’s timeline. Nobody else sees it.">
          <RecipientPicker friends={listFriends(db, user.id)} groups={listGroups(db, user.id)} lists={listCustomLists(db, user.id)} />
          <label className="mt-4 block">
            <span className="sr-only">Note on the share</span>
            <input className="field rounded-full" name="note" maxLength={200} placeholder="Add a note (optional)" />
          </label>
          <label className="pick mt-3 flex min-h-[52px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5">
            <Repeat2 className="h-4 w-4 text-ink-3" aria-hidden />
            <span className="flex-1 text-[14px] font-semibold">People who get it may pass it on</span>
            <input type="checkbox" name="allow_reshare" defaultChecked />
          </label>
        </Step>

        <button
          type="submit"
          className="press mt-2 flex h-14 items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-brand-on shadow-glow hover:bg-brand-deep hover:text-white"
        >
          <Send className="h-5 w-5" aria-hidden /> Share it
        </button>
      </form>
    </div>
  );
}
