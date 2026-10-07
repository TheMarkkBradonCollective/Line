"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, House, Plus, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; Icon: LucideIcon };

// Two tabs on each side of the raised Create button. Both sides get the same
// flex basis, so the button sits on the exact horizontal center at any width.
const LEFT: Tab[] = [
  { href: "/timeline", label: "Home", Icon: House },
  { href: "/reels", label: "Reels", Icon: Clapperboard },
];
const RIGHT: Tab[] = [
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

function activePath(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabLink({ tab, active, badge }: { tab: Tab; active: boolean; badge?: number }) {
  const { Icon } = tab;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap group relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] font-semibold tracking-tight",
        active ? "text-brand" : "text-ink-3 hover:text-ink",
      )}
    >
      <span className="relative">
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
        {badge ? (
          <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-[rgb(var(--surface))]">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span>{tab.label}</span>
      <span
        aria-hidden
        className={cn(
          "absolute bottom-1 h-1 w-1 rounded-full bg-brand transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}

export function TabBar({ requests = 0 }: { requests?: number }) {
  const pathname = usePathname();
  const createActive = activePath(pathname, "/create");
  return (
    <nav
      aria-label="Primary"
      data-testid="tab-bar"
      className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <div className="flex h-[60px] items-stretch px-2">
        <div className="flex flex-1 basis-0 items-stretch">
          {LEFT.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={activePath(pathname, tab.href)} />
          ))}
        </div>
        <div className="relative flex w-[76px] shrink-0 justify-center">
          <Link
            href="/create"
            data-testid="create-button"
            aria-current={createActive ? "page" : undefined}
            aria-label="Create"
            className="create-fab absolute -top-5 flex h-[60px] w-[60px] items-center justify-center rounded-[22px] bg-brand text-white"
          >
            <Plus className="h-8 w-8" strokeWidth={2.4} aria-hidden />
          </Link>
        </div>
        <div className="flex flex-1 basis-0 items-stretch">
          {RIGHT.map((tab) => (
            <TabLink
              key={tab.href}
              tab={tab}
              active={activePath(pathname, tab.href)}
              badge={tab.href === "/friends" ? requests : undefined}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
