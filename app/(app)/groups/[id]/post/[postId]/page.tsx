import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Comments } from "@/components/comments";
import { GroupPostCard } from "@/components/group-post-card";
import { Notice } from "@/components/notice";
import { getDb } from "@/lib/db";
import { canUseGroupThread, getCommunity, groupFeed } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";
import { listComments } from "@/lib/social";

export default async function GroupThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string }>;
  searchParams: Promise<{ notice?: string; error?: string; reply?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id, postId } = await params;
  const query = await searchParams;
  const db = getDb();
  const groupId = Number(id);
  const data = await getCommunity(db, user.id, groupId);
  if (!data || !(await canUseGroupThread(db, user.id, groupId, Number(postId)))) notFound();
  const item = ((await groupFeed(db, user.id, groupId)) ?? []).find((i) => i.post.id === Number(postId));
  if (!item) notFound();
  const comments = (await listComments(db, user.id, item.post.id, { groupId })) ?? [];
  return (
    <div className="md:pt-6">
      <Link href={`/groups/${groupId}`} className="mx-4 mb-3 flex w-fit items-center gap-2 text-[13px] font-semibold text-brand-strong hover:underline md:mx-0">
        <Users className="h-4 w-4" aria-hidden /> {data.group.name}
      </Link>
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <GroupPostCard item={item} groupId={groupId} viewerId={user.id} role={data.role} />
      <div className="bg-surface md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" data-testid="group-thread">
        <Comments
          postId={item.post.id}
          comments={comments}
          viewer={user}
          replyingTo={Number(query.reply) || null}
          canComment={!user.restricted && !item.post.hidden}
          groupId={groupId}
          groupName={data.group.name}
        />
      </div>
    </div>
  );
}
