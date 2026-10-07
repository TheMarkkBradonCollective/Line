export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  const bad = Boolean(error);
  return (
    <p className={`mb-5 border px-3 py-2 text-sm ${bad ? "banner-warn" : "border-pine bg-[#e7f8f3] text-ink"}`}>
      {error || notice}
    </p>
  );
}
