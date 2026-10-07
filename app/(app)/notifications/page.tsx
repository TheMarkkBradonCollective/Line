import Link from "next/link";
import { markAllReadAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { listNotifications } from "@/lib/social";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const items = listNotifications(getDb(), user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="kicker">Alerts</p>
          <h1 className="mt-1 font-serif text-4xl">What changed</h1>
        </div>
        {items.some((item) => !item.read) ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="ghost" size="sm">Mark all read</Button>
          </form>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        Someone shared something with you, or shared your post onward. This is not a second timeline.
      </p>
      <ul className="mt-5 grid gap-2">
        {items.length === 0 ? (
          <li className="rounded-3xl bg-[#f7f7f7] px-4 py-8 text-center">
            <p className="text-3xl" aria-hidden>🔔</p>
            <p className="mt-2 font-display text-xl font-semibold">No alerts</p>
            <p className="mt-1 text-sm font-semibold text-muted">When someone shares with you, or passes your post on, it shows up here. This is not another timeline.</p>
          </li>
        ) : null}
        {items.map((item) => (
          <li key={item.id} className="border border-rule bg-card px-3 py-3 text-sm">
            <p className={item.read ? "text-muted" : "font-medium"}>{item.text}</p>
            <p className="mt-1 text-xs text-muted">{formatWhen(item.created_at)}</p>
            {item.post_id ? (
              <Link className="mt-2 inline-block underline" href={`/notifications/${item.id}/open`}>
                Open the post
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
