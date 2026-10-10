import { redirect } from "next/navigation";
import { updatePasswordAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { getAuthIdentity } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  if (!(await getAuthIdentity())) redirect("/?mode=forgot&error=" + encodeURIComponent("That reset link expired. Send a new one."));
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="wordmark text-4xl text-brand">LINE</p>
      <h1 className="page-title mt-4">Set a new password</h1>
      <div className="mt-3"><Notice error={query.error} /></div>
      <form action={updatePasswordAction} className="mt-4 grid gap-3">
        <input className="field" type="password" name="password" autoComplete="new-password" placeholder="New password (8+ characters)" required minLength={8} />
        <input className="field" type="password" name="confirm" autoComplete="new-password" placeholder="Repeat it" required minLength={8} />
        <button type="submit" className="press h-12 rounded-full bg-brand font-semibold text-brand-on">Save password</button>
      </form>
    </main>
  );
}
