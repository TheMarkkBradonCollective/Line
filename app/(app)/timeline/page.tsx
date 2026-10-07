import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Inbox } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { TimelineCard } from "@/components/timeline-card";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTimeline } from "@/lib/social";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const items = getTimeline(getDb(), user.id);
  const senders = new Set(items.filter((item) => item.sharedBy.id !== user.id).map((item) => item.sharedBy.id)).size;

  return (
    <div>
      <div className="z-20 md:sticky md:top-0 md:bg-bg/80 md:pt-6 md:backdrop-blur-xl">
        <div className="flex items-end justify-between px-4 pb-3 pt-4 md:px-1 md:pt-0">
          <div>
            <h1 className="page-title">Timeline</h1>
            <p className="mt-1 text-[13px] text-ink-3">
              {items.length
                ? `${items.length} ${items.length === 1 ? "post" : "posts"} from ${senders} ${senders === 1 ? "person" : "people"} who picked you`
                : "Only what people send you"}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 md:px-0">
        <Notice notice={query.notice} error={query.error} />
      </div>
      {items.length === 0 ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Inbox}
            title="Quiet for now"
            action={
              <Link href="/create" className="press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-brand-on shadow-glow">
                <Camera className="h-4 w-4" aria-hidden /> Make something
              </Link>
            }
          >
            LINE never fills this page for you. When a friend sends you something, it shows up here with their name on it.
          </EmptyState>
        </div>
      ) : (
        <div>
          {items.map((item, index) => (
            <TimelineCard key={item.shareId} item={item} index={index} />
          ))}
          <p className="px-6 py-8 text-center text-[13px] text-ink-3">That’s everything people sent you. No filler below.</p>
        </div>
      )}
    </div>
  );
}
