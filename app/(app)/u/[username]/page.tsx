import { ProfileView } from "@/components/profile-view";

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  return <ProfileView username={username} notice={query.notice} error={query.error} tab={query.tab} />;
}
