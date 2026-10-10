import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight, EyeOff, KeyRound, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const items = [
    { href: "/profile?tab=edit", label: "Edit profile and bio", Icon: Pencil },
    { href: "/friends?tab=privacy", label: "Privacy and blocking", Icon: ShieldCheck },
    { href: "/hidden", label: "Hidden people and posts", Icon: EyeOff },
    { href: "/reset-password", label: "Change password", Icon: KeyRound },
    { href: "/how-line-works", label: "How LINE works", Icon: BookOpen },
  ];
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="px-4 md:px-0"><Notice notice={query.notice} error={query.error} /></div>
      <ul className="surface-card mx-4 divide-y divide-line/70 overflow-hidden md:mx-0">
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
      <section className="surface-card mx-4 mt-6 p-4 md:mx-0" data-testid="delete-account">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-bold tracking-tight text-heart"><Trash2 className="h-5 w-5" aria-hidden /> Delete account</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">Deletes your profile, your posts (and their shares, comments and reactions), your photos and videos, friendships and follows. This can’t be undone.</p>
        <form action={deleteAccountAction} className="mt-3 grid gap-2">
          <input className="field" name="confirm" placeholder={`Type ${user.username} to confirm`} autoComplete="off" required />
          <button type="submit" className="press h-11 rounded-full bg-heart font-semibold text-white">Delete my account</button>
        </form>
      </section>
    </div>
  );
}
