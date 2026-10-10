import { notFound, redirect } from "next/navigation";
import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/session";

const SECTIONS = new Set(["photos", "videos", "loops", "about", "friends", "followers", "following", "activity", "edit"]);

export default async function OwnProfileSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { section } = await params;
  if (!SECTIONS.has(section)) notFound();
  const query = await searchParams;
  return <ProfileView username={user.username} notice={query.notice} error={query.error} tab={section === "loops" ? "reels" : section} />;
}
