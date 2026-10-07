import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { SectionLink } from "@/components/section-link";
import { TabBar } from "@/components/tab-bar";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { listPermissions, unreadCount } from "@/lib/social";
import { redirect } from "next/navigation";

const NAV = [
  ["/timeline", "Timeline"],
  ["/create", "Create"],
  ["/friends", "Friends"],
  ["/profile", "Profile"],
  ["/notifications", "Alerts"],
] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const db = getDb();
  const unread = unreadCount(db, user.id);
  const staff = listPermissions(db, user.id).length > 0;
  const role = ROLE_LABELS[user.role as Role] ?? user.role;

  if (user.suspended) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="font-display text-4xl font-bold text-pine">LINE</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">This account is suspended.</h1>
        <p className="mt-3 text-muted">You can sign out. Sharing and timeline access stay closed.</p>
        <form className="mt-6" action={logoutAction}>
          <button type="submit" className="rounded-full bg-pine px-5 py-2 font-extrabold text-white">Log out</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="safe-top sticky top-0 z-30 bg-pine text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <Link href="/timeline" className="font-display text-[2rem] font-bold leading-none tracking-tight text-white">
            LINE
          </Link>
          <div className="flex items-center gap-3">
            <Link className="hidden text-sm font-extrabold text-white/90 md:inline" href="/posts">
              My Posts
            </Link>
            {staff ? (
              <Link className="text-sm font-extrabold text-white/90" href="/staff">
                Staff
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button type="submit" className="rounded-full px-3 py-1 text-sm font-extrabold text-white hover:bg-white/15">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl">
        <aside className="sticky top-[4.25rem] hidden h-[calc(100vh-4.25rem)] w-56 shrink-0 flex-col px-4 py-6 md:flex">
          <nav className="grid gap-1">
            {NAV.map(([href, label]) => (
              <SectionLink key={href} href={href}>
                {label}
                {href === "/notifications" && unread ? ` (${unread})` : ""}
              </SectionLink>
            ))}
            <SectionLink href="/posts">My Posts</SectionLink>
            {staff ? <SectionLink href="/staff">Staff</SectionLink> : null}
          </nav>
          <div className="mt-auto text-sm">
            <p className="font-extrabold">{user.displayName}</p>
            <p className="font-semibold text-muted">@{user.username}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{role}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          {user.restricted ? (
            <p className="banner-warn mx-4 mt-4 px-3 py-2 text-sm">
              This account is restricted. You can read and adjust privacy. You cannot create or share.
            </p>
          ) : null}
          <div className="mx-auto w-full max-w-[480px] pb-28 md:pb-12">{children}</div>
        </div>
      </div>
      <TabBar unread={unread} />
    </div>
  );
}
