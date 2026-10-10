import { redirect } from "next/navigation";
import { ReelsPlayer } from "@/components/reels-player";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listReels } from "@/lib/social";

export default async function ReelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <ReelsPlayer reels={await listReels(getDb(), user.id)} viewerId={user.id} />;
}
