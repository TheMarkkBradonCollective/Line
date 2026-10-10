import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addGroupMemberAction, removeGroupMemberAction, setGroupRoleAction } from "@/app/group-actions";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCommunity } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";
import { listFriends } from "@/lib/social";

export default async function GroupMembersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const data = await getCommunity(db, user.id, Number(id));
  if (!data) notFound();
  const admin = data.role !== "member";
  const inGroup = new Set(data.members.map((m) => m.user.id));
  const addable = admin ? (await listFriends(db, user.id)).filter((f) => !inGroup.has(f.id)) : [];
  return (
    <div>
      <PageHeader kicker={data.group.name} title="Members" subtitle={`${data.members.length} member${data.members.length === 1 ? "" : "s"}. Admins can add their own friends.`} action={<Link href={`/groups/${data.group.id}`} className="chip h-10">Back to group</Link>} />
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        <ul className="grid gap-1 rounded-[24px] bg-surface p-2 shadow-e1" data-testid="group-members">
          {data.members.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 rounded-2xl p-2">
              <Avatar initials={m.user.initials} color={m.user.avatarColor} src={m.user.avatarUrl} name={m.user.displayName} size="md" />
              <span className="min-w-0 flex-1">
                <Link href={m.user.id === user.id ? "/profile" : `/u/${m.user.username}`} className="block truncate text-[15px] font-semibold hover:underline">
                  {m.user.displayName}
                </Link>
                <span className="text-[12.5px] capitalize text-ink-3">{m.role}</span>
              </span>
              {data.role === "owner" && m.role !== "owner" ? (
                <form action={setGroupRoleAction}>
                  <input type="hidden" name="groupId" value={data.group.id} />
                  <input type="hidden" name="userId" value={m.user.id} />
                  <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                  <button className="chip h-9 text-[13px]">{m.role === "admin" ? "Remove admin" : "Make admin"}</button>
                </form>
              ) : null}
              {admin && m.role !== "owner" && m.user.id !== user.id && (data.role === "owner" || m.role === "member") ? (
                <form action={removeGroupMemberAction}>
                  <input type="hidden" name="groupId" value={data.group.id} />
                  <input type="hidden" name="userId" value={m.user.id} />
                  <button className="chip h-9 text-[13px] text-danger">Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {admin ? (
          <section className="mt-6 rounded-[24px] bg-surface p-4 shadow-e1">
            <h2 className="font-display text-lg font-bold tracking-tight">Add friends</h2>
            <p className="text-[13px] text-ink-3">New members only see posts shared into the group from now on.</p>
            {addable.length ? (
              <form action={addGroupMemberAction} className="mt-3 grid gap-3">
                <input type="hidden" name="groupId" value={data.group.id} />
                <div className="flex flex-wrap gap-2">
                  {addable.map((f) => (
                    <label key={f.id} className="pick chip min-h-[44px] cursor-pointer pl-1.5 pr-3.5">
                      <input type="checkbox" name="member" value={f.id} className="sr-only" />
                      <Avatar initials={f.initials} color={f.avatarColor} src={f.avatarUrl} name={f.displayName} size="xs" />
                      {f.displayName}
                    </label>
                  ))}
                </div>
                <Button type="submit">Add to group</Button>
              </form>
            ) : (
              <p className="mt-2 text-[13px] text-ink-3">All your friends are already here.</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
