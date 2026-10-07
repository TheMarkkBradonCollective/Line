import { redirect } from "next/navigation";
import { BellOff, CheckCheck, Forward, Play, Repeat2, Send } from "lucide-react";
import { markAllReadAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/lib/db";
import { formatWhen, isVideoKind } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { listNotifications } from "@/lib/social";
import { cn } from "@/lib/utils";

type Item = ReturnType<typeof listNotifications>[number];

const KIND = {
  shared_with_you: { Icon: Send, verb: "sent you", tint: "bg-brand text-brand-on" },
  shared_onward: { Icon: Forward, verb: "passed your post on", tint: "bg-[#7c5cff] text-white" },
  reshared_video: { Icon: Repeat2, verb: "reshared your video", tint: "bg-[#ff7a45] text-white" },
} as const;

function thumb(tone: string | null) {
  const [a, b] = (tone ?? "#00bf8f,#009e78").split(",").map((part) => part.trim());
  return { background: `linear-gradient(135deg, ${a}, ${b ?? a})` };
}

function Row({ item }: { item: Item }) {
  const meta = KIND[item.kind as keyof typeof KIND] ?? KIND.shared_with_you;
  const { Icon } = meta;
  const what = item.post_kind === "text" ? "a note" : item.post_kind && isVideoKind(item.post_kind) ? "a video" : "a photo";
  const body = (
    <>
      <span className="relative shrink-0">
        <Avatar initials={item.actor_initials} color={item.actor_color} name={item.actor_name} size="md" />
        <span className={cn("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-[rgb(var(--surface))]", meta.tint)}>
          <Icon className="h-3 w-3" strokeWidth={2.6} aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] leading-snug text-ink">
          <span className="font-semibold">{item.actor_name}</span>{" "}
          {item.kind === "shared_with_you" ? `sent you ${what}` : meta.verb}
        </span>
        {item.post_body ? <span className="mt-0.5 block truncate text-[13px] text-ink-3">{item.post_body}</span> : null}
        <span className="mt-0.5 block text-[12px] text-ink-3">{formatWhen(item.created_at)}</span>
      </span>
      {item.post_id ? (
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl" style={thumb(item.post_tone)} aria-hidden>
          {item.post_kind && isVideoKind(item.post_kind) ? (
            <Play className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 fill-white text-white" />
          ) : null}
        </span>
      ) : null}
      {!item.read ? <span className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand" aria-label="Unread" /> : null}
    </>
  );
  const cls = cn("relative flex min-h-[72px] items-center gap-3 py-3 pl-5 pr-4", !item.read && "bg-brand-soft/50");
  return item.post_id ? (
    // A plain link on purpose: opening marks the alert read, so it must never be prefetched.
    <a href={`/notifications/${item.id}/open`} className={cn(cls, "text-ink hover:bg-surface-2")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const items = listNotifications(getDb(), user.id);
  const fresh = items.filter((item) => !item.read);
  const earlier = items.filter((item) => item.read);

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="When someone sends you something, or passes on what you made."
        action={
          fresh.length ? (
            <form action={markAllReadAction}>
              <button type="submit" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-semibold text-ink-2 shadow-e1 ring-1 ring-line/60 hover:text-ink">
                <CheckCheck className="h-4 w-4" aria-hidden /> Mark read
              </button>
            </form>
          ) : null
        }
      />
      <div className="px-4 md:px-0">
        {items.length === 0 ? (
          <EmptyState icon={BellOff} title="All quiet">
            When a friend shares with you, or passes your post along, you’ll see it here. This is not another feed.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {fresh.length ? (
              <section>
                <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-ink-3">New · {fresh.length}</h2>
                <div className="surface-card divide-y divide-line/70 overflow-hidden">
                  {fresh.map((item) => (
                    <Row key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}
            {earlier.length ? (
              <section>
                <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Earlier</h2>
                <div className="surface-card divide-y divide-line/70 overflow-hidden">
                  {earlier.map((item) => (
                    <Row key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
