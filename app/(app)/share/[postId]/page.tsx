import { notFound, redirect } from "next/navigation";
import { shareExistingAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { RecipientPicker } from "@/components/recipient-picker";
import { SharePanel } from "@/components/share-panel";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canViewPost, followCounts, sentToFollowers, getPost, listCustomLists, listFriends, listGroups } from "@/lib/social";

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
  const post = await getPost(db, Number(postId));
  if (!post || !await canViewPost(db, user, post) || post.hidden) notFound();

  return (
    <div className="pt-4 md:pt-6">
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <div className="surface-card mx-4 overflow-hidden pt-5 md:mx-0">
        <SharePanel postId={post.id} variant="page" />
      </div>
      {/* Works without JavaScript too. */}
      <noscript>
        <form action={shareExistingAction} className="mx-4 mt-6 grid gap-4 md:mx-0">
          <input type="hidden" name="postId" value={post.id} />
          <input className="field" name="note" maxLength={200} placeholder="Optional note" aria-label="Note" />
          <RecipientPicker followers={post.authorId === user.id ? { count: (await followCounts(db, user.id)).followers, alreadySent: await sentToFollowers(db, post.id) } : null} friends={await listFriends(db, user.id)} groups={await listGroups(db, user.id)} lists={await listCustomLists(db, user.id)} />
          <Button type="submit" size="lg">
            Share
          </Button>
        </form>
      </noscript>
    </div>
  );
}
