import Link from "next/link";
import { Notice } from "@/components/notice";
import { TimelineCard } from "@/components/timeline-card";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTimeline } from "@/lib/social";
import { redirect } from "next/navigation";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const items = getTimeline(getDb(), user.id);

  return (
    <div>
      <div className="px-4 pb-3 pt-4">
        <h1 className="font-display text-3xl font-semibold">Timeline</h1>
        <p className="mt-1 text-sm font-semibold text-muted">Only what a person sent you, or what you put on your own timeline.</p>
        <Notice notice={query.notice} error={query.error} />
      </div>
      {items.length === 0 ? (
        <div className="mx-4 rounded-3xl bg-[#f7f7f7] px-5 py-10 text-center">
          <p className="text-4xl" aria-hidden>🌿</p>
          <p className="mt-3 font-display text-2xl font-semibold">Nothing here yet</p>
          <p className="mt-2 text-sm font-semibold text-muted">LINE does not fill this page. When someone sends you a post, it will say who did.</p>
          <Link href="/create" className="mt-4 inline-flex rounded-full bg-pine px-5 py-2 text-sm font-extrabold text-white">
            Create something
          </Link>
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <TimelineCard key={item.shareId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
