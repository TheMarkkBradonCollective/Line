"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="wordmark text-4xl text-brand">LINE</p>
      <h1 className="page-title mt-4">Something went wrong.</h1>
      {/* Never echo error details: they could describe content the viewer can't see. */}
      <p className="mt-2 text-sm text-ink-2">Try again in a moment.{error.digest ? ` (Ref ${error.digest})` : ""}</p>
      <button className="press mt-6 h-11 w-fit rounded-full bg-brand px-6 font-semibold text-brand-on" onClick={() => reset()} type="button">
        Try again
      </button>
    </main>
  );
}
