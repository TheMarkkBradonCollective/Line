import { redirect } from "next/navigation";
import { Clapperboard, Image as ImageIcon, MessageCircle, Repeat2, Send, Type, Video } from "lucide-react";
import { createPostAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { RecipientPicker } from "@/components/recipient-picker";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { areFriends, getSetting, getUserByUsername, listCustomLists, listFriends, listGroups, MEDIA_PLATES } from "@/lib/social";

const KINDS = [
  { id: "text", label: "Text", hint: "A status or a note", Icon: Type, tint: "text-brand-strong bg-brand-soft" },
  { id: "photo", label: "Photo", hint: "One or several", Icon: ImageIcon, tint: "text-[#2f8f3a] bg-[#e3f6e5]" },
  { id: "video", label: "Video", hint: "Plays in the feed", Icon: Video, tint: "text-heart bg-[#ffe4ea]" },
  { id: "reel", label: "Reel", hint: "Vertical, full screen", Icon: Clapperboard, tint: "text-[#6a4cf0] bg-[#ece8ff]" },
] as const;

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card min-w-0 p-4 sm:p-5">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="step-n flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-strong" data-n={n} aria-hidden />
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
  searchParams: Promise<{ notice?: string; error?: string; type?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const paused = getSetting(db, "sharing_paused") === "1";
  const type = KINDS.some((kind) => kind.id === query.type) ? query.type! : "text";
  const target = query.to ? getUserByUsername(db, query.to.toLowerCase()) : null;
  const targetIsFriend = Boolean(target && areFriends(db, user.id, target.id));

  return (
    <div>
      <PageHeader title="Create post" subtitle="Make it, then choose exactly who gets it. Nobody sees it unless you share it with them." />
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        {target && target.id !== user.id ? (
          <p className="mb-4 flex items-start gap-2.5 rounded-2xl bg-brand-soft px-3.5 py-3 text-[13.5px] text-ink" data-testid="message-target">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
            {targetIsFriend
              ? `Sending to ${target.displayName}. On LINE, a message is a post shared with just them.`
              : `You can share with ${target.displayName} once you’re friends and their settings allow it.`}
          </p>
        ) : null}
        {paused ? (
          <p className="banner-warn mb-4 px-3.5 py-3 text-sm">Sharing is paused by an emergency control. You can draft, but delivery will be refused.</p>
        ) : null}
      </div>
      <form action={createPostAction} className="create-form grid grid-cols-1 gap-3 px-4 md:px-0">
        <Step n={1} title="What are you posting?">
          <fieldset>
            <legend className="sr-only">Type of post</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="type-picker">
              {KINDS.map(({ id, label, hint, Icon, tint }) => (
                <label
                  key={id}
                  className="pick flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-2xl border border-line bg-surface p-3 text-left has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60"
                >
                  <input type="radio" name="kind" value={id} defaultChecked={id === type} className="sr-only" />
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-semibold text-ink">{label}</span>
                    <span className="block text-[12px] text-ink-3">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block">
            <span className="sr-only">What’s on your mind?</span>
            <textarea
              className="field min-h-32 resize-none text-[17px] leading-relaxed"
              name="body"
              required
              placeholder={`What’s on your mind, ${user.displayName.split(" ")[0]}?`}
            />
          </label>
        </Step>

        <div data-step="frames">
          <Step n={2} title="Add photos or a clip" hint="Real upload isn’t connected yet, so pick placeholder frames. Photos can use several; video and reels use the first.">
            <fieldset>
              <legend className="sr-only">Placeholder frames</legend>
              <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
                {MEDIA_PLATES.map((plate) => {
                  const [a, b] = plate.tone.split(",");
                  return (
                    <label key={plate.id} className="group relative shrink-0 cursor-pointer">
                      <input type="checkbox" name="plate" value={plate.id} className="peer sr-only" />
                      <span
                        className="flex h-28 w-24 items-end overflow-hidden rounded-2xl p-2 ring-2 ring-transparent ring-offset-2 ring-offset-[rgb(var(--surface))] transition peer-checked:ring-brand peer-focus-visible:ring-brand"
                        style={{ background: `linear-gradient(150deg, ${a}, ${b ?? a})` }}
                      >
                        <span className="text-[11px] font-semibold leading-tight text-white drop-shadow">{plate.label}</span>
                      </span>
                      <span className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white shadow-e1 peer-checked:flex" aria-hidden>
                        ✓
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Step>
        </div>

        <Step n={3} title="Who gets it?" hint="Each pick puts it in that person’s feed. Nobody else sees it — not even on your profile.">
          <RecipientPicker
            friends={listFriends(db, user.id)}
            groups={listGroups(db, user.id)}
            lists={listCustomLists(db, user.id)}
            selected={target && targetIsFriend ? [target.id] : []}
          />
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
          <Send className="h-5 w-5" aria-hidden /> Post and share
        </button>
      </form>
    </div>
  );
}
