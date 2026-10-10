import { notFound, redirect } from "next/navigation";
import { ReelsPlayer } from "@/components/reels-player";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getReel, listReels } from "@/lib/social";

/** A direct link to one reel. If it was not shared with you, it does not exist for you. */
export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const db = getDb();
  const reel = await getReel(db, user.id, Number(id));
  if (!reel) notFound();
  const rest = (await listReels(db, user.id)).filter((item) => item.post.id !== reel.post.id);
  return <ReelsPlayer reels={[reel, ...rest]} viewerId={user.id} />;
}
