import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { markNotificationRead } from "@/lib/social";
import { redirect } from "next/navigation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await context.params;
  const postId = await markNotificationRead(getDb(), user.id, Number(id));
  redirect(postId ? `/post/${postId}` : "/notifications");
}
