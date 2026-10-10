"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Clapperboard, Compass, House, Layers, Plus, UserRound, Users, UsersRound, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_TABS, normalizeTabs, TAB_OPTIONS, TAB_STORAGE_KEY, type TabKey } from "@/lib/tab-bar";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; Icon: LucideIcon };

const ICONS: Record<TabKey, LucideIcon> = {
  home: House,
  discover: Compass,
  reels: Clapperboard,
  friends: Users,
  profile: UserRound,
  alerts: Bell,
  groups: UsersRound,
  posts: Layers,
};

function toTab(key: TabKey): Tab & { key: TabKey } {
  return { key, href: TAB_OPTIONS[key].href, label: TAB_OPTIONS[key].label, Icon: ICONS[key] };
}

function activePath(pathname: string, href: string) {
  href = href.split("?")[0];
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

/**
 * Two tabs on each side of the raised Create button, chosen in Settings → Tab bar.
 * Both sides get the same flex basis, so Create sits on the exact horizontal center for any layout.
 * The saved choice comes from the server; before the tab_bar column exists, a local copy is used.
 */
export function TabBar({ requests = 0, unread = 0, saved = null }: { requests?: number; unread?: number; saved?: string | null }) {
  const pathname = usePathname();
  const [keys, setKeys] = useState<TabKey[]>(saved ? normalizeTabs(saved) : [...DEFAULT_TABS]);
  useEffect(() => {
    const load = () => {
      if (saved) return setKeys(normalizeTabs(saved));
      try {
        const local = window.localStorage.getItem(TAB_STORAGE_KEY);
        setKeys(local ? normalizeTabs(local) : [...DEFAULT_TABS]);
      } catch {
        /* storage blocked */
      }
    };
    load();
    const onChange = (event: Event) => setKeys(normalizeTabs((event as CustomEvent<string[]>).detail));
    window.addEventListener("line-tabbar", onChange);
    return () => window.removeEventListener("line-tabbar", onChange);
  }, [saved]);
  const LEFT = keys.slice(0, 2).map(toTab);
  const RIGHT = keys.slice(2, 4).map(toTab);
  const badgeFor = (key: TabKey) => (key === "friends" ? requests : key === "alerts" ? unread : undefined);
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
            <TabLink key={tab.key} tab={tab} active={activePath(pathname, tab.href)} badge={badgeFor(tab.key)} />
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
              key={tab.key}
              tab={tab}
              active={activePath(pathname, tab.href)}
              badge={badgeFor(tab.key)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
