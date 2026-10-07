import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { SectionLink } from "@/components/section-link";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { listPermissions, unreadCount } from "@/lib/social";
import { redirect } from "next/navigation";

const NAV = [
  ["/timeline", "Timeline"],
  ["/create", "Create"],
  ["/discover", "Discover"],
  ["/friends", "Friends"],
  ["/profile", "Profile"],
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
        <p className="kicker">LINE</p>
        <h1 className="mt-2 font-serif text-4xl">This account is suspended.</h1>
        <p className="mt-3 text-muted">You can sign out. Sharing and timeline access stay closed.</p>
        <form className="mt-6" action={logoutAction}>
          <Button type="submit" variant="outline">Log out</Button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-rule px-4 pb-16 pt-6 md:flex">
          <Link href="/timeline" className="font-serif text-3xl tracking-[0.14em] text-pine">
            LINE
          </Link>
          <p className="mt-1 text-sm italic text-muted">Sent, not served.</p>
          <nav className="mt-8 grid gap-1">
            {NAV.map(([href, label]) => (
              <SectionLink key={href} href={href}>
                {label}
              </SectionLink>
            ))}
            <SectionLink href="/posts">My Posts</SectionLink>
            <SectionLink href="/notifications">Alerts{unread ? ` (${unread})` : ""}</SectionLink>
            {staff ? <SectionLink href="/staff">Staff</SectionLink> : null}
          </nav>
          <div className="mt-auto text-sm">
            <p className="font-medium">{user.displayName}</p>
            <p className="text-muted">@{user.username}</p>
            <p className="text-muted">{role}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1 pb-20 md:pb-12">
          <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <Link href="/timeline" className="font-serif text-2xl tracking-[0.12em] text-pine md:hidden">
              LINE
            </Link>
            <p className="hidden text-sm text-muted md:block">A timeline only holds what a person sent.</p>
            <div className="ml-auto flex items-center gap-2">
              <Link className="text-sm md:hidden" href="/notifications">
                Alerts{unread ? ` (${unread})` : ""}
              </Link>
              <Link className="text-sm md:hidden" href="/posts">
                My Posts
              </Link>
              {staff ? (
                <Link className="text-sm md:hidden" href="/staff">
                  Staff
                </Link>
              ) : null}
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Log out
                </Button>
              </form>
            </div>
          </header>
          {user.restricted ? (
            <p className="banner-warn border-b px-4 py-2 text-sm">
              This account is restricted. You can read and adjust privacy. You cannot create or share.
            </p>
          ) : null}
          <div className="px-4 py-6">{children}</div>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-rule bg-white md:hidden">
        {NAV.map(([href, label]) => (
          <SectionLink key={href} href={href} variant="tab">
            {label}
          </SectionLink>
        ))}
      </nav>
    </div>
  );
}
