import { notFound, redirect } from "next/navigation";
import { shareExistingAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { RecipientPicker } from "@/components/recipient-picker";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canViewPost, getPost, getSetting, listCustomLists, listFriends, listGroups, mustUser } from "@/lib/social";

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { postId } = await params;
  const query = await searchParams;
  const db = getDb();
  const post = getPost(db, Number(postId));
  if (!post || !canViewPost(db, user, post) || post.hidden) notFound();
  const author = mustUser(db, post.authorId);
  const paused = getSetting(db, "sharing_paused") === "1";

  return (
    <div className="mx-auto max-w-2xl">
      <p className="kicker">Share</p>
      <h1 className="mt-1 font-serif text-4xl">Choose who receives this</h1>
      <p className="mt-3 border border-rule bg-card px-3 py-3 text-sm">
        Originally created by {author.displayName}. “{post.body.slice(0, 180)}”
      </p>
      <p className="mt-3 text-sm text-muted">
        Confirming puts the post on the timelines you pick. It does not send a direct message, and it does not publish to people you leave unchecked.
      </p>
      <div className="mt-4">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {paused ? <p className="banner-warn mb-4 px-3 py-2 text-sm">Sharing is paused.</p> : null}
      <form action={shareExistingAction} className="grid gap-5">
        <input type="hidden" name="postId" value={post.id} />
        <label className="grid gap-1 text-sm">
          Note
          <input className="field" name="note" maxLength={200} placeholder="Optional note on the share" />
        </label>
        <RecipientPicker friends={listFriends(db, user.id)} groups={listGroups(db, user.id)} lists={listCustomLists(db, user.id)} />
        <Button type="submit" variant="stamp" size="lg">
          Share
        </Button>
      </form>
    </div>
  );
}
