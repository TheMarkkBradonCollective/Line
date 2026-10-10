import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGroupAction, updateGroupAction } from "@/app/group-actions";
import { GroupPhoto } from "@/components/group-photo";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getCommunity } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";

export default async function GroupSettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const data = await getCommunity(getDb(), user.id, Number(id));
  if (!data || data.role === "member") notFound();
  const { group } = data;
  return (
    <div>
      <PageHeader kicker={group.name} title="Group settings" action={<Link href={`/groups/${group.id}`} className="chip h-10">Back to group</Link>} />
      <div className="grid gap-6 px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
        <form action={updateGroupAction} className="grid gap-3 rounded-[24px] bg-surface p-4 shadow-e1">
          <input type="hidden" name="groupId" value={group.id} />
          <div className="flex items-center gap-3">
            <GroupPhoto name={group.name} src={group.photoUrl} size="lg" />
            <div className="grid gap-1.5 text-[13px]">
              <label className="font-semibold">
                Group photo
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-[13px]" />
              </label>
              {group.photoUrl ? (
                <label className="flex items-center gap-2 text-ink-2">
                  <input type="checkbox" name="removePhoto" /> Remove photo
                </label>
              ) : null}
              <span className="text-ink-3">Group photos and names are seen by members only in LINE, but the photo file itself isn’t secret.</span>
            </div>
          </div>
          <label className="grid gap-1 text-[13px] font-semibold">
            Name
            <input className="field" name="name" defaultValue={group.name} required maxLength={60} />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            About
            <input className="field" name="about" defaultValue={group.about} maxLength={300} />
          </label>
          <Button type="submit">Save</Button>
        </form>
        {data.role === "owner" ? (
          <form action={deleteGroupAction} className="grid gap-3 rounded-[24px] border border-danger/30 bg-surface p-4">
            <input type="hidden" name="groupId" value={group.id} />
            <h2 className="font-display text-lg font-bold text-danger">Delete group</h2>
            <p className="text-[13px] text-ink-2">Removes the group, its member list and every group thread. The posts stay with their authors and anyone they were shared with directly.</p>
            <input className="field" name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
            <Button type="submit" variant="danger">Delete group</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
