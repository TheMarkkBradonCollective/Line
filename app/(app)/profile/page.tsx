import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OwnProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  return <ProfileView username={user.username} notice={query.notice} error={query.error} />;
}
