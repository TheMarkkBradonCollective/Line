"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function activePath(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile" || pathname.startsWith("/u/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SectionLink({
  href,
  children,
  variant = "side",
}: {
  href: string;
  children: ReactNode;
  variant?: "side" | "tab";
}) {
  const pathname = usePathname();
  const active = activePath(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        variant === "tab" ? "px-1 py-3 text-center text-[11px] tracking-wide" : "border-l-2 px-2 py-2 text-sm",
        active ? "border-pine font-medium text-pine" : "border-transparent text-ink hover:bg-[#f3f3f3]",
      )}
    >
      {children}
    </Link>
  );
}
