import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/notice";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getSetting, listUsers } from "@/lib/social";
import { roleRank } from "@/lib/staff";

export const dynamic = "force-dynamic";

const STEPS = ["Create", "Share", "Receive", "Reshare", "Continue"];

type Person = { username: string; displayName: string; role: string; avatarColor: string; initials: string; bio: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const db = getDb();
  const current = await getCurrentUser();
  const tagline = getSetting(db, "site_tagline") || "Sent, not served.";
  const signups = getSetting(db, "signups_open") === "1";
  const users = listUsers(db);
  const people = users.filter((user) => user.role === "user");
  const staff = users.filter((user) => user.role !== "user").sort((a, b) => roleRank(a.role) - roleRank(b.role));

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Hero */}
      <section className="safe-top relative overflow-hidden bg-gradient-to-br from-brand via-[#00ad83] to-[#006f53] text-white lg:sticky lg:top-0 lg:h-dvh">
        <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="520" cy="80" r="220" fill="white" opacity="0.08" />
          <circle cx="40" cy="560" r="200" fill="black" opacity="0.08" />
          <path d="M-20 420 C 140 360 260 480 420 400 S 640 360 640 360" stroke="white" strokeOpacity="0.22" strokeWidth="3" fill="none" strokeDasharray="2 10" strokeLinecap="round" />
        </svg>
        <div className="relative mx-auto flex max-w-xl flex-col px-6 pb-10 pt-8 lg:h-full lg:justify-center lg:px-12">
          <p className="wordmark text-[56px] text-white drop-shadow-sm lg:text-[88px]">LINE</p>
          <h1 className="mt-4 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.04em] lg:text-[64px]">{tagline}</h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/90 lg:text-lg">
            It looks like the social app you know, with one rule: no share, no see. Profiles are open; posts reach only the people they were shared with. No Discover. No algorithm.
          </p>
          <ol className="mt-6 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/25 backdrop-blur">{step}</span>
                {index < STEPS.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-white/70" aria-hidden /> : null}
              </li>
            ))}
          </ol>
          {current && !current.suspended ? (
            <Link
              href="/timeline"
              className="press mt-7 inline-flex h-12 w-fit items-center gap-2.5 rounded-full bg-white pl-1.5 pr-5 text-[15px] font-semibold text-[#02261c] shadow-e2"
            >
              <Avatar initials={current.initials} color={current.avatarColor} name={current.displayName} size="sm" />
              Continue as {current.displayName.split(" ")[0]}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>

      {/* Sign in */}
      <section className="mx-auto w-full max-w-xl px-5 py-8 lg:px-10 lg:py-14">
        <Notice notice={query.notice} error={query.error} />
        <h2 className="page-title">Sign in</h2>
        <p className="mt-1.5 text-sm text-ink-2">
          Pick a person to try the demo. {signups ? "New accounts are open." : "There’s no password."}
        </p>
        <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-wider text-ink-3">People</h3>
        <ul className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {people.map((user, index) => (
            <li key={user.username} className="animate-rise" style={{ ["--i" as string]: Math.min(index, 8) }}>
              <PersonCard user={user} />
            </li>
          ))}
        </ul>
        <h3 className="mt-8 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-3">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Staff
        </h3>
        <p className="mt-1 text-[13px] text-ink-3">Desks open from permission grants, not the title.</p>
        <ul className="surface-card mt-2.5 divide-y divide-line/70 overflow-hidden">
          {staff.map((user) => (
            <li key={user.username}>
              <form action={loginAction}>
                <input type="hidden" name="username" value={user.username} />
                <button type="submit" className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{user.displayName}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">@{user.username}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
                    {ROLE_LABELS[user.role as Role] ?? user.role}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PersonCard({ user }: { user: Person }) {
  return (
    <form action={loginAction}>
      <input type="hidden" name="username" value={user.username} />
      <button
        type="submit"
        className="press group flex w-full flex-col items-center gap-2 rounded-3xl bg-surface px-3 pb-3.5 pt-4 text-center shadow-e1 ring-1 ring-line/60 hover:shadow-e2 hover:ring-brand/50"
      >
        <span className="rounded-full p-[2px] transition group-hover:bg-gradient-to-br group-hover:from-brand group-hover:to-brand-deep">
          <span className="block rounded-full bg-surface p-[2px]">
            <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="lg" />
          </span>
        </span>
        <span className="min-w-0 max-w-full">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{user.displayName}</span>
          <span className="block truncate text-[12.5px] text-ink-3">@{user.username}</span>
        </span>
      </button>
    </form>
  );
}
