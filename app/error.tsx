"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="kicker">LINE</p>
      <h1 className="mt-2 font-serif text-4xl">Something went wrong.</h1>
      <p className="mt-3 text-sm">{error.message}</p>
      <button className="mt-4 border border-ink px-3 py-2 text-sm" onClick={() => reset()} type="button">
        Try again
      </button>
    </main>
  );
}
