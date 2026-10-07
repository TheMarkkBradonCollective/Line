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
    <div className="mx-auto max-w-2xl">
      <p className="kicker">Timeline</p>
      <h1 className="mt-1 font-serif text-4xl">What people sent you</h1>
      <p className="mt-2 text-sm text-muted">
        Each item is here because someone shared it with you, or because you published it to yourself. Discover does not add to this page.
      </p>
      <div className="mt-5">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {items.length === 0 ? (
        <div className="desk-card px-4 py-8">
          <p className="font-serif text-2xl">Nothing has been shared with you.</p>
          <p className="mt-2 text-sm text-muted">LINE does not fill this page. When someone sends you a post, it will say who did.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {items.map((item) => (
            <TimelineCard key={item.shareId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
