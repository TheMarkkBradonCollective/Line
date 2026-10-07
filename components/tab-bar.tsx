"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/timeline", label: "Timeline", icon: "home" },
  { href: "/create", label: "Create", icon: "camera" },
  { href: "/friends", label: "Friends", icon: "people" },
  { href: "/profile", label: "Profile", icon: "person" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
] as const;

function activePath(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile" || pathname.startsWith("/u/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name }: { name: string }) {
  const common = { viewBox: "0 0 24 24", className: "h-6 w-6", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true as const };
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="3" />
        <path d="M3.5 19c.6-2.6 2.7-4 5.5-4s4.9 1.4 5.5 4" />
        <circle cx="17" cy="9.5" r="2.2" />
        <path d="M16 15c2 .3 3.4 1.4 4 3.5" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M8 8h2l1.2-2h3.6L16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    );
  }
  if (name === "person") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1-3 3.2-4.5 7-4.5S18 16 19 19" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function TabBar({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#ededed] bg-white md:hidden">
      {TABS.map((tab) => {
        const active = activePath(pathname, tab.href);
        if (tab.icon === "camera") {
          return (
            <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className="flex items-start justify-center">
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-pine text-white shadow-[0_8px_18px_rgba(0,191,143,0.45)]">
                <Icon name="camera" />
                <span className="sr-only">{tab.label}</span>
              </span>
            </Link>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold ${active ? "text-pine" : "text-[#8d8d8d]"}`}
          >
            <span className="relative">
              <Icon name={tab.icon} />
              {tab.href === "/notifications" && unread > 0 ? (
                <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-pine px-1 text-center text-[9px] leading-4 text-white">{unread}</span>
              ) : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
