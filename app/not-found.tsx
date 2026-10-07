import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="wordmark text-4xl text-brand">LINE</p>
      <h1 className="page-title mt-4">That page isn’t here.</h1>
      <p className="mt-2 text-sm text-ink-2">If it was a private post, it wasn’t shared with you.</p>
      <Link className="press mt-6 inline-flex h-11 w-fit items-center rounded-full bg-brand px-6 font-semibold text-brand-on" href="/timeline">
        Back to the timeline
      </Link>
    </main>
  );
}
