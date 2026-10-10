"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Clapperboard, House, Layers, Plus, Search, Shield, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function activePath(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ unread, staff, requests = 0 }: { unread: number; staff: boolean; requests?: number }) {
  const pathname = usePathname();
  const items: { href: string; label: string; Icon: LucideIcon; badge?: number }[] = [
    { href: "/timeline", label: "Home", Icon: House },
    { href: "/discover", label: "Discover", Icon: Compass },
    { href: "/reels", label: "Reels", Icon: Clapperboard },
    { href: "/friends", label: "Friends", Icon: Users, badge: requests },
    { href: "/notifications", label: "Notifications", Icon: Bell, badge: unread },
    { href: "/search", label: "Find people", Icon: Search },
    { href: "/profile", label: "Profile", Icon: UserRound },
    { href: "/posts", label: "My Posts", Icon: Layers },
  ];
  if (staff) items.push({ href: "/staff", label: "Staff", Icon: Shield });

  return (
    <nav aria-label="Primary" className="grid gap-1">
      {items.map(({ href, label, Icon, badge }) => {
        const active = activePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press group flex min-h-[48px] items-center gap-3.5 rounded-2xl px-3.5 text-[15px] font-semibold tracking-tight",
              active ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
            )}
          >
            <span className="relative">
              <Icon
                className={cn("h-[22px] w-[22px]", active ? "text-brand-strong" : "")}
                strokeWidth={active ? 2.4 : 1.9}
                aria-hidden
              />
              {badge ? (
                <span className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-brand-on ring-2 ring-[rgb(var(--bg))]">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            <span className="hidden lg:inline">{label}</span>
            <span className="sr-only lg:hidden">{label}</span>
          </Link>
        );
      })}
      <Link
        href="/create"
        aria-current={activePath(pathname, "/create") ? "page" : undefined}
        className="press mt-4 flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-brand text-[15px] font-semibold text-brand-on shadow-glow hover:bg-brand-deep hover:text-white"
      >
        <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        <span className="hidden lg:inline">Create</span>
        <span className="sr-only lg:hidden">Create</span>
      </Link>
    </nav>
  );
}
