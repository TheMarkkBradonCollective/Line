import { loginAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getSetting, listUsers } from "@/lib/social";
import { roleRank } from "@/lib/staff";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
      <section>
        <p className="kicker">LINE</p>
        <h1 className="mt-3 font-serif text-6xl leading-[0.95] tracking-tight md:text-7xl">{tagline}</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed">
          A post, photo, or video shows up on a timeline only when a person shares it with that person, or when they publish it to their own. LINE is not a feed that goes looking for an audience.
        </p>
        <ol className="mt-8 grid gap-3 text-sm sm:grid-cols-5">
          {["Create", "Share", "Receive", "Reshare", "Continue"].map((step, index) => (
            <li key={step} className="border border-rule bg-card px-3 py-3">
              <span className="kicker">0{index + 1}</span>
              <p className="mt-1 font-medium">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 max-w-xl space-y-3 text-sm leading-relaxed text-muted">
          <p>Discover is a separate public shelf. Browsing it, or being recommended something there, never places it on your timeline. Keeping a public post means sharing it with someone.</p>
          <p>You choose who may share with you. Finding your profile is not permission to deliver a post.</p>
          <p>{signups ? "New accounts are open." : "New accounts are closed. This demo signs you in as a seeded person. There is no password."}</p>
        </div>
        {current && !current.suspended ? (
          <p className="mt-6">
            <Link className="underline" href="/timeline">
              Continue as {current.displayName}
            </Link>
          </p>
        ) : null}
      </section>
      <section>
        <Notice notice={query.notice} error={query.error} />
        <h2 className="font-serif text-3xl">Sign in</h2>
        <p className="mt-2 text-sm text-muted">Pick a person. Staff desks are gated by permissions, so the role you pick changes which tools open.</p>
        <AccountList title="People" users={people} />
        <AccountList title="Staff" users={staff} showRole />
      </section>
    </main>
  );
}

function AccountList({
  title,
  users,
  showRole = false,
}: {
  title: string;
  users: { username: string; displayName: string; role: string; avatarColor: string; initials: string; bio: string }[];
  showRole?: boolean;
}) {
  return (
    <div className="mt-6">
      <h3 className="kicker">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {users.map((user) => (
          <li key={user.username}>
            <form action={loginAction}>
              <input type="hidden" name="username" value={user.username} />
              <Button type="submit" variant="outline" className="h-auto w-full items-start justify-start gap-3 px-3 py-3 text-left">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center text-xs text-card" style={{ background: user.avatarColor }}>
                  {user.initials}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">
                    {user.displayName} <span className="font-normal text-muted">@{user.username}</span>
                  </span>
                  {showRole ? (
                    <span className="block text-xs uppercase tracking-wider text-muted">{ROLE_LABELS[user.role as Role] ?? user.role}</span>
                  ) : (
                    <span className="block truncate text-xs text-muted">{user.bio}</span>
                  )}
                </span>
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
