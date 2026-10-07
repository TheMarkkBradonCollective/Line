"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="wordmark text-4xl text-brand">LINE</p>
      <h1 className="page-title mt-4">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-2">{error.message}</p>
      <button className="press mt-6 h-11 w-fit rounded-full bg-brand px-6 font-semibold text-brand-on" onClick={() => reset()} type="button">
        Try again
      </button>
    </main>
  );
}
