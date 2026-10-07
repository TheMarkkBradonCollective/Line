import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/session";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  return <ProfileView username={user.username} notice={query.notice} error={query.error} tab={query.tab} />;
}
