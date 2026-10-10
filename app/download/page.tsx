import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck, Smartphone } from "lucide-react";
import { ANDROID_RELEASE } from "@/lib/app-release";

export const metadata = { title: "Get LINE for Android" };

const STEPS = [
  { title: "Download the APK", body: "Tap the button above. Your browser may warn that this type of file can harm your device; tap Download anyway." },
  { title: "Allow installs from this source", body: "Open the file. If Android asks, go to Settings → Install unknown apps, pick your browser (Chrome, Samsung Internet…), and turn on Allow from this source." },
  { title: "Install and open", body: "Go back, tap Install, then Open. Sign in with your LINE account or create one." },
];

export default function DownloadPage() {
  return (
    <main className="min-h-dvh bg-surface">
      <section className="safe-top relative overflow-hidden bg-gradient-to-br from-brand via-[#00ad83] to-[#006f53] text-white">
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="520" cy="60" r="200" fill="white" opacity="0.08" />
          <circle cx="40" cy="380" r="180" fill="black" opacity="0.08" />
        </svg>
        <div className="relative mx-auto max-w-2xl px-6 pb-12 pt-6">
          <Link href="/" className="press inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to LINE
          </Link>
          <div className="mt-8 flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-[22px] bg-white shadow-e2">
              <span className="wordmark text-[26px] text-brand">LINE</span>
            </div>
            <div>
              <h1 className="font-display text-[34px] font-bold leading-none tracking-[-0.03em] lg:text-[44px]">LINE for Android</h1>
              <p className="mt-2 text-[14px] text-white/85">
                Version {ANDROID_RELEASE.version} · {ANDROID_RELEASE.sizeMb} · {ANDROID_RELEASE.minAndroid}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/90">
            Everything shared with you, in your pocket. No share, no see — same rule, same account as the website.
          </p>
          <a
            href={ANDROID_RELEASE.url}
            download
            className="press mt-7 inline-flex h-14 items-center gap-3 rounded-full bg-white px-7 text-[16px] font-bold text-[#02261c] shadow-e2"
            data-testid="apk-download"
          >
            <Download className="h-5 w-5" aria-hidden /> Download APK
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="page-title flex items-center gap-2"><Smartphone className="h-5 w-5 text-brand" aria-hidden /> How to install</h2>
        <ol className="mt-5 grid gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="surface-card flex gap-4 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="surface-card mt-6 flex gap-3 p-4 text-[13px] text-ink-2">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <p>
            Signed release build, package <code>social.line.share</code>. SHA-256:{" "}
            <code className="break-all">{ANDROID_RELEASE.sha256}</code>. On iPhone? Just use the website and Add to Home Screen.
          </p>
        </div>
      </section>
    </main>
  );
}
