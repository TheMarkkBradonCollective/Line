import { loginAction } from "@/app/actions";
import { Notice } from "@/components/notice";
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
    <main className="min-h-screen bg-white">
      <header className="safe-top bg-pine text-white">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4">
          <p className="font-display text-4xl font-bold leading-none tracking-tight">LINE</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:grid-cols-[1.05fr_0.95fr] md:py-12">
        <section>
          <h1 className="font-display text-5xl font-semibold leading-[0.95] md:text-6xl">{tagline}</h1>
          <p className="mt-4 max-w-xl text-lg font-semibold leading-relaxed">
            A post, photo, or video shows up on a timeline only when a person shares it with that person, or when they put it on their own. Nothing arrives because an algorithm went looking.
          </p>
          <ol className="mt-6 flex flex-wrap gap-2 text-sm font-extrabold">
            {["Create", "Share", "Receive", "Reshare", "Continue"].map((step, index) => (
              <li key={step} className="rounded-full bg-[#e7f8f3] px-3 py-2 text-pine">
                0{index + 1} {step}
              </li>
            ))}
          </ol>
          <div className="mt-6 max-w-xl space-y-3 text-sm font-semibold leading-relaxed text-muted">
            <p>You choose who receives it: one friend, a few friends, a group, or a list. It lands on their timeline. It is not a message thread.</p>
            <p>Finding someone’s profile is not permission to deliver a post. They decide who may share with them.</p>
            <p>{signups ? "New accounts are open." : "New accounts are closed. This demo signs you in as a seeded person. There is no password."}</p>
          </div>
          {current && !current.suspended ? (
            <p className="mt-6">
              <Link className="inline-flex rounded-full bg-pine px-4 py-2 font-extrabold text-white" href="/timeline">
                Continue as {current.displayName}
              </Link>
            </p>
          ) : null}
        </section>
        <section>
          <Notice notice={query.notice} error={query.error} />
          <h2 className="font-display text-3xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Pick a person. Staff desks open from permission grants, not from the title alone.</p>
          <AccountList title="People" users={people} />
          <AccountList title="Staff" users={staff} showRole />
        </section>
      </div>
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
    <div className="mt-5">
      <h3 className="kicker">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {users.map((user) => (
          <li key={user.username}>
            <form action={loginAction}>
              <input type="hidden" name="username" value={user.username} />
              <button type="submit" className="flex w-full items-center gap-3 rounded-2xl border border-[#ededed] bg-white px-3 py-2.5 text-left hover:border-pine">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: user.avatarColor }}>
                  {user.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-extrabold text-ink">
                    {user.displayName} <span className="font-bold text-muted">@{user.username}</span>
                  </span>
                  <span className="block truncate text-sm font-semibold text-muted">{user.bio}</span>
                  {showRole ? <span className="mt-0.5 block text-[11px] font-extrabold uppercase tracking-wide text-pine">{ROLE_LABELS[user.role as Role] ?? user.role}</span> : null}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
