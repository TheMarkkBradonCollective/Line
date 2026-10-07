import Link from "next/link";
import { ArrowRight, Lock, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { User } from "@/lib/types";

type Circle = { user: User; sentTo: number; got: number; open: boolean }[];

const STEPS = ["Create", "Share", "Receive", "Reshare", "Continue"];

/** Desktop right column. Your own friends, so you can pass something on. Never a recommendation feed. */
export function RightRail({ circle }: { circle: Circle }) {
  return (
    <div className="grid gap-4">
      <section className="surface-card p-4" aria-labelledby="rail-friends">
        <div className="flex items-center justify-between">
          <h2 id="rail-friends" className="font-display text-lg font-bold tracking-tight">
            Share with
          </h2>
          <Link href="/friends" className="text-sm font-semibold text-brand-strong hover:underline">
            Friends
          </Link>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-3">Your people. Tap Share on a post to send it to them.</p>
        <ul className="mt-3 grid gap-0.5">
          {circle.slice(0, 7).map(({ user, sentTo, got, open }) => (
            <li key={user.id}>
              <Link
                href={`/u/${user.username}`}
                className="group flex min-h-[52px] items-center gap-3 rounded-2xl px-2 py-1.5 text-ink hover:bg-surface-2"
              >
                <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{user.displayName}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">
                    {open ? (
                      <>
                        You sent {sentTo} · Got {got}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" aria-hidden /> Not taking shares
                      </span>
                    )}
                  </span>
                </span>
                {open ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-strong opacity-70 transition group-hover:opacity-100">
                    <Send className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {circle.length === 0 ? <li className="px-2 py-3 text-sm text-ink-3">Add a friend to start passing things on.</li> : null}
        </ul>
      </section>

      <section className="surface-card overflow-hidden" aria-labelledby="rail-how">
        <div className="bg-gradient-to-br from-brand to-brand-deep px-4 py-4 text-white">
          <h2 id="rail-how" className="font-display text-lg font-bold tracking-tight">
            Sent, not served.
          </h2>
          <p className="mt-0.5 text-[13px] text-white/90">Nothing lands here unless a person picked you.</p>
        </div>
        <ol className="flex flex-wrap items-center gap-1.5 px-4 py-3.5 text-[12.5px] font-semibold text-ink-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="rounded-full bg-surface-2 px-2.5 py-1">{step}</span>
              {index < STEPS.length - 1 ? <ArrowRight className="h-3 w-3 text-ink-3" aria-hidden /> : null}
            </li>
          ))}
        </ol>
      </section>
      <p className="px-2 text-xs text-ink-3">No Discover. No algorithm. Just people passing things to people.</p>
    </div>
  );
}
