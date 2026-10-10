import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bell, BellOff, LogOut, PenSquare, Settings, Users } from "lucide-react";
import { leaveGroupAction, muteGroupAction } from "@/app/group-actions";
import { AvatarStack } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { GroupPhoto } from "@/components/group-photo";
import { GroupPostCard } from "@/components/group-post-card";
import { Notice } from "@/components/notice";
import { getDb } from "@/lib/db";
import { getCommunity, groupFeed } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const data = await getCommunity(db, user.id, Number(id));
  if (!data) notFound();
  const feed = (await groupFeed(db, user.id, data.group.id)) ?? [];
  const { group, role } = data;
  const admin = role !== "member";
  return (
    <div className="md:pt-6">
      <section className="bg-surface px-4 pb-4 pt-5 md:rounded-[24px] md:border md:border-line/60 md:shadow-e1" data-testid="group-header">
        <div className="flex items-start gap-4">
          <GroupPhoto name={group.name} src={group.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate">{group.name}</h1>
            {group.about ? <p className="mt-1 text-[14px] text-ink-2">{group.about}</p> : null}
            <Link href={`/groups/${group.id}/members`} className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:underline">
              <AvatarStack people={data.members.slice(0, 5).map((m) => m.user)} size="xs" />
              {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/create?group=${group.id}`} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-on" data-testid="group-post-button">
            <PenSquare className="h-4 w-4" aria-hidden /> Post in group
          </Link>
          <Link href={`/groups/${group.id}/members`} className="chip h-10">
            <Users className="h-4 w-4" aria-hidden /> Members
          </Link>
          {admin ? (
            <Link href={`/groups/${group.id}/settings`} className="chip h-10">
              <Settings className="h-4 w-4" aria-hidden /> Settings
            </Link>
          ) : null}
          <form action={muteGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="muted" value={data.muted ? "0" : "1"} />
            <button className="chip h-10">
              {data.muted ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
              {data.muted ? "Unmute" : "Mute"}
            </button>
          </form>
          <form action={leaveGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <button className="chip h-10 text-danger">
              <LogOut className="h-4 w-4" aria-hidden /> Leave
            </button>
          </form>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-3">You see posts shared here since you joined. Comments here stay in the group.</p>
      </section>
      <div className="px-4 pt-3 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      <div className="mt-2 md:mt-4" data-testid="group-feed">
        {feed.length === 0 ? (
          <div className="px-4 md:px-0">
            <EmptyState icon={Users} title="Nothing here yet">
              Post something, or share a post you can see into the group from its Share button.
            </EmptyState>
          </div>
        ) : (
          feed.map((item) => <GroupPostCard key={item.post.id} item={item} groupId={group.id} viewerId={user.id} role={role} />)
        )}
      </div>
    </div>
  );
}
