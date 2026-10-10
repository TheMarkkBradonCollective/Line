import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile-view";

const SECTIONS = new Set(["photos", "videos", "loops", "about", "friends", "followers", "following", "report"]);

/** "See all" pages for a profile: full lists instead of tabs. */
export default async function UserProfileSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; section: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { username, section } = await params;
  if (!SECTIONS.has(section)) notFound();
  const query = await searchParams;
  return <ProfileView username={username} notice={query.notice} error={query.error} tab={section === "loops" ? "reels" : section} />;
}
