import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signInAction, signUpAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/notice";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSetting } from "@/lib/social";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = ["Create", "Share", "Receive", "Reshare", "Continue"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; mode?: string }>;
}) {
  const query = await searchParams;
  const db = getDb();
  const current = await getCurrentUser();
  const tagline = await getSetting(db, "site_tagline") || "Sent, not served.";
  // Open unless a staff member closes sign-ups from the console.
  const signupsOpen = (await getSetting(db, "signups_open")) !== "0";
  const signup = query.mode === "signup";

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Hero */}
      <section className="safe-top relative overflow-hidden bg-gradient-to-br from-brand via-[#00ad83] to-[#006f53] text-white lg:sticky lg:top-0 lg:h-dvh">
        <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="520" cy="80" r="220" fill="white" opacity="0.08" />
          <circle cx="40" cy="560" r="200" fill="black" opacity="0.08" />
          <path d="M-20 420 C 140 360 260 480 420 400 S 640 360 640 360" stroke="white" strokeOpacity="0.22" strokeWidth="3" fill="none" strokeDasharray="2 10" strokeLinecap="round" />
        </svg>
        <div className="relative mx-auto flex max-w-xl flex-col px-6 pb-10 pt-8 lg:h-full lg:justify-center lg:px-12">
          <p className="wordmark text-[56px] text-white drop-shadow-sm lg:text-[88px]">LINE</p>
          <h1 className="mt-4 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.04em] lg:text-[64px]">{tagline}</h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/90 lg:text-lg">
            It looks like the social app you know, with one rule: no share, no see. Profiles are open; posts reach only the people they were shared with. No Discover. No algorithm.
          </p>
          <ol className="mt-6 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/25 backdrop-blur">{step}</span>
                {index < STEPS.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-white/70" aria-hidden /> : null}
              </li>
            ))}
          </ol>
          {current && !current.suspended ? (
            <Link
              href="/timeline"
              className="press mt-7 inline-flex h-12 w-fit items-center gap-2.5 rounded-full bg-white pl-1.5 pr-5 text-[15px] font-semibold text-[#02261c] shadow-e2"
            >
              <Avatar initials={current.initials} color={current.avatarColor} name={current.displayName} size="sm" />
              Continue as {current.displayName.split(" ")[0]}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>

      {/* Sign in / sign up */}
      <section className="mx-auto w-full max-w-md px-5 py-8 lg:px-10 lg:py-14">
        <Notice notice={query.notice} error={query.error} />
        <div className="mb-6 grid grid-cols-2 rounded-full bg-surface-2 p-1 text-[14px] font-semibold" role="tablist" aria-label="Account">
          <Link
            href="/"
            role="tab"
            aria-selected={!signup}
            className={cn("rounded-full py-2.5 text-center", !signup ? "bg-surface text-ink shadow-e1" : "text-ink-3 hover:text-ink")}
          >
            Sign in
          </Link>
          <Link
            href="/?mode=signup"
            role="tab"
            aria-selected={signup}
            className={cn("rounded-full py-2.5 text-center", signup ? "bg-surface text-ink shadow-e1" : "text-ink-3 hover:text-ink")}
          >
            Create account
          </Link>
        </div>

        {signup ? (
          signupsOpen ? (
            <form action={signUpAction} className="grid gap-3" data-testid="signup-form">
              <h2 className="page-title">Join LINE</h2>
              <p className="-mt-1 text-sm text-ink-2">Your profile is open to people on LINE. Your posts only reach the people you share them with.</p>
              <Field label="Your name" name="displayName" autoComplete="name" placeholder="Alex Rivera" required minLength={2} />
              <Field label="Username" name="username" autoComplete="username" placeholder="alex" required minLength={3} pattern="[A-Za-z0-9_.@]{3,24}" hint="Letters, numbers, dots and underscores." />
              <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." />
              <SubmitButton>Create account</SubmitButton>
              <p className="text-[12.5px] text-ink-3">We’ll email you a link to confirm your address.</p>
            </form>
          ) : (
            <p className="surface-card p-4 text-sm text-ink-2">Sign-ups are closed right now. Check back soon.</p>
          )
        ) : (
          <form action={signInAction} className="grid gap-3" data-testid="signin-form">
            <h2 className="page-title">Welcome back</h2>
            <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
            <SubmitButton>Sign in</SubmitButton>
            <p className="text-[13px] text-ink-3">
              New here?{" "}
              <Link href="/?mode=signup" className="font-semibold text-brand-strong hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      <input className="field" {...props} />
      {hint ? <span className="mt-1 block text-[12px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="press mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-brand-on shadow-glow hover:bg-brand-deep hover:text-white"
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
