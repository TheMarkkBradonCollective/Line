import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Clapperboard, Layers, LifeBuoy, LogOut, Search, Shield, ShieldCheck, Users } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listPermissions } from "@/lib/social";

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const staff = listPermissions(getDb(), user.id).length > 0;
  const items = [
    { href: "/posts", label: "My posts and who has them", Icon: Layers },
    { href: "/reels", label: "Reels", Icon: Clapperboard },
    { href: "/friends", label: "Friends", Icon: Users },
    { href: "/friends?tab=groups", label: "Groups and lists", Icon: Users },
    { href: "/notifications", label: "Notifications", Icon: Bell },
    { href: "/search", label: "Find people", Icon: Search },
    { href: "/friends?tab=privacy", label: "Privacy and blocking", Icon: ShieldCheck },
    { href: "/profile?tab=edit", label: "Help and support", Icon: LifeBuoy },
    ...(staff ? [{ href: "/staff", label: "Staff desk", Icon: Shield }] : []),
  ];
  return (
    <div className="px-4 pt-4 md:px-0 md:pt-6">
      <h1 className="page-title">Menu</h1>
      <Link href="/profile" className="surface-card mt-4 flex items-center gap-3 p-3.5 text-ink">
        <Avatar initials={user.initials} color={user.avatarColor} name={user.displayName} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{user.displayName}</span>
          <span className="block text-[13px] text-ink-3">See your profile</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-3" aria-hidden />
      </Link>
      <ul className="surface-card mt-3 divide-y divide-line/70 overflow-hidden">
        {items.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-[52px] items-center gap-3 px-4 text-[15px] font-semibold text-ink hover:bg-surface-2">
              <Icon className="h-5 w-5 text-brand-strong" aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction} className="mt-3">
        <button type="submit" className="press surface-card flex min-h-[52px] w-full items-center gap-3 px-4 text-[15px] font-semibold text-ink hover:bg-surface-2">
          <LogOut className="h-5 w-5 text-ink-3" aria-hidden /> Log out
        </button>
      </form>
      <p className="mt-6 text-center text-[12.5px] text-ink-3">LINE · No share, no see.</p>
    </div>
  );
}
