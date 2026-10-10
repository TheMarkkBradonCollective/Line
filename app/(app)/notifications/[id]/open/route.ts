import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { markNotificationRead } from "@/lib/social";
import { redirect } from "next/navigation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await context.params;
  const row = await markNotificationRead(getDb(), user.id, Number(id));
  if (row?.group_id && row.post_id) redirect(`/groups/${row.group_id}/post/${row.post_id}`);
  if (row?.group_id) redirect(`/groups/${row.group_id}`);
  if (row?.kind === "message" ) redirect(`/messages`);
  redirect(row?.post_id ? `/post/${row.post_id}` : "/notifications");
}
