import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, LogOut, Shield } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { RightRail } from "@/components/right-rail";
import { SideNav } from "@/components/side-nav";
import { TabBar } from "@/components/tab-bar";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { listPermissions, shareCircle, unreadCount } from "@/lib/social";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const db = getDb();
  const unread = unreadCount(db, user.id);
  const staff = listPermissions(db, user.id).length > 0;
  const role = ROLE_LABELS[user.role as Role] ?? user.role;

  if (user.suspended) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <p className="wordmark text-4xl text-brand">LINE</p>
        <h1 className="page-title mt-4">This account is suspended.</h1>
        <p className="mt-3 text-ink-2">You can sign out. Sharing and timeline access stay closed.</p>
        <form className="mt-6" action={logoutAction}>
          <button type="submit" className="press h-11 rounded-full bg-brand px-6 font-semibold text-brand-on">
            Log out
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      {/* Phone header: Vine green glass, white wordmark. */}
      <header className="glass-header safe-top sticky top-0 z-30 md:hidden">
        <div className="flex h-14 items-center justify-between pl-4 pr-2">
          <Link href="/timeline" aria-label="LINE timeline" className="wordmark text-[30px] text-[rgb(var(--header-ink))]">
            LINE
          </Link>
          <div className="flex items-center">
            <Link
              href="/posts"
              aria-label="My Posts"
              className="tap press flex items-center justify-center rounded-full text-[rgb(var(--header-ink))] hover:bg-white/15"
            >
              <Layers className="h-[22px] w-[22px]" aria-hidden />
            </Link>
            {staff ? (
              <Link
                href="/staff"
                aria-label="Staff desk"
                className="tap press flex items-center justify-center rounded-full text-[rgb(var(--header-ink))] hover:bg-white/15"
              >
                <Shield className="h-[22px] w-[22px]" aria-hidden />
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Log out"
                className="tap press flex items-center justify-center rounded-full text-[rgb(var(--header-ink))] hover:bg-white/15"
              >
                <LogOut className="h-[21px] w-[21px]" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] md:grid-cols-[88px_minmax(0,600px)] md:justify-center md:gap-6 md:px-4 lg:grid-cols-[248px_minmax(0,600px)] lg:gap-8 xl:grid-cols-[248px_minmax(0,600px)_320px]">
        <aside className="sticky top-0 hidden h-dvh flex-col py-6 md:flex">
          <Link href="/timeline" aria-label="LINE timeline" className="mb-6 flex items-center gap-2.5 px-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand to-brand-deep text-white shadow-glow">
              <span className="wordmark text-[22px]">L</span>
            </span>
            <span className="wordmark hidden text-[34px] text-brand lg:inline">LINE</span>
          </Link>
          <SideNav unread={unread} staff={staff} />
          <div className="mt-auto flex items-center gap-3 rounded-2xl p-2 lg:bg-surface lg:shadow-e1">
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 text-ink">
              <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="md" />
              <span className="hidden min-w-0 lg:block">
                <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                <span className="block truncate text-xs text-ink-3">
                  @{user.username}
                  {user.role !== "user" ? ` · ${role}` : ""}
                </span>
              </span>
            </Link>
            <form action={logoutAction} className="hidden lg:block">
              <button
                type="submit"
                aria-label="Log out"
                className="tap press flex items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 pb-[calc(var(--tabbar-h)+40px+env(safe-area-inset-bottom))] md:pb-16">
          {user.restricted ? (
            <p className="banner-warn mx-4 mt-4 px-3.5 py-3 text-sm font-medium md:mx-0">
              This account is restricted. You can read and adjust privacy. You cannot create or share.
            </p>
          ) : null}
          {children}
        </main>

        <aside className="sticky top-0 hidden h-dvh overflow-y-auto py-6 no-scrollbar xl:block" aria-label="Share with friends">
          <RightRail circle={shareCircle(db, user.id)} />
        </aside>
      </div>
      <TabBar unread={unread} />
    </div>
  );
}
