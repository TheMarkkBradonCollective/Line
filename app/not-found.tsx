import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="kicker">LINE</p>
      <h1 className="mt-2 font-serif text-4xl">That page is not here.</h1>
      <p className="mt-3 text-sm text-muted">If this was a private post, it was not shared with you.</p>
      <Link className="mt-4 inline-block underline" href="/timeline">
        Back to the timeline
      </Link>
    </main>
  );
}
