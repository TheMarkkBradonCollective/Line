"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function activePath(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile" || pathname.startsWith("/u/");
  if (href === "/notifications") return pathname === "/notifications" || pathname.startsWith("/notifications/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = activePath(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-extrabold",
        active ? "bg-[#e7f8f3] text-pine" : "text-ink hover:bg-[#f6f6f6]",
      )}
    >
      {children}
    </Link>
  );
}
