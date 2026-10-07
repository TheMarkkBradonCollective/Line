import { createPostAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { RecipientPicker } from "@/components/recipient-picker";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { kindLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getSetting, listCustomLists, listFriends, listGroups, MEDIA_PLATES } from "@/lib/social";
import { redirect } from "next/navigation";

const KINDS = [
  ["text", "Note", "Writing only"],
  ["photo", "Photo", "Placeholder frame"],
  ["video", "Video", "No transcoding"],
  ["short", "Short", "Short-form placeholder"],
  ["long_video", "Longer video", "Long-form placeholder"],
  ["reel", "Reel", "Reel placeholder"],
] as const;

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
    <div className="mx-auto max-w-2xl">
      <p className="kicker">Create</p>
      <h1 className="mt-1 font-serif text-4xl">Make it, then choose who receives it</h1>
      <p className="mt-2 text-sm text-muted">
        A new post stays off every timeline, including yours, until you send it. Listing it on Discover is a separate choice and still does not deliver it.
      </p>
      <div className="mt-5">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {paused ? (
        <p className="banner-warn mb-4 px-3 py-2 text-sm">Sharing is paused by an emergency control. You can draft, but delivery will be refused.</p>
      ) : null}
      <form action={createPostAction} className="grid gap-6">
        <fieldset className="grid gap-2">
          <legend className="kicker mb-2">Kind</legend>
          {KINDS.map(([id, label, hint]) => (
            <label key={id} className="flex items-center gap-3 border border-rule bg-card px-3 py-2 text-sm">
              <input type="radio" name="kind" value={id} defaultChecked={id === "text"} />
              <span>
                <span className="font-medium">{label}</span> <span className="text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="grid gap-2">
          <span className="kicker">Words</span>
          <textarea className="field min-h-32" name="body" required placeholder="Write the thing you actually want someone to have." />
        </label>
        <fieldset className="grid gap-2">
          <legend className="kicker mb-2">Placeholder frame</legend>
          <p className="text-sm text-muted">Used for photos, video, shorts, longer video, and reels. Real upload is not connected. Notes ignore this.</p>
          {MEDIA_PLATES.map((plate) => (
            <label key={plate.id} className="flex items-center gap-3 border border-rule bg-card px-3 py-2 text-sm">
              <input type="radio" name="plate" value={plate.id} />
              <span className="inline-block h-8 w-8 border border-rule" style={{ background: plate.tone }} />
              <span>{plate.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-start gap-3 border border-rule bg-card p-3 text-sm">
          <input className="mt-1" type="checkbox" name="discover" />
          <span>
            <span className="block font-medium">Also list on Discover</span>
            <span className="text-muted">Public shelf only. This does not put the post on your timeline or anyone else’s.</span>
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="allow_reshare" defaultChecked />
          People who receive it may share it onward
        </label>
        <label className="grid gap-2 text-sm">
          <span className="kicker">Note on the share</span>
          <input className="field" name="note" maxLength={200} placeholder="Optional. Shown with the delivery, not as a message thread." />
        </label>
        <RecipientPicker friends={listFriends(db, user.id)} groups={listGroups(db, user.id)} lists={listCustomLists(db, user.id)} />
        <Button type="submit" variant="stamp" size="lg">
          Share this
        </Button>
        <p className="text-xs text-muted">Kinds available: {KINDS.map((item) => kindLabel(item[0])).join(", ")}.</p>
      </form>
    </div>
  );
}
