export default function Loading() {
  return (
    <div className="pt-4 md:pt-6" aria-busy="true" aria-label="Loading">
      <div className="px-4 md:px-1">
        <div className="skeleton h-8 w-40 rounded-xl" />
        <div className="skeleton mt-2.5 h-3.5 w-60 rounded-full" />
      </div>
      {[0, 1].map((key) => (
        <div key={key} className="mt-5 bg-surface md:overflow-hidden md:rounded-[28px] md:border md:border-line/60">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="skeleton h-9 w-16 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <div className="skeleton h-3.5 w-44 rounded-full" />
              <div className="skeleton h-3 w-28 rounded-full" />
            </div>
          </div>
          <div className="skeleton aspect-square" />
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="skeleton h-11 w-28 rounded-full" />
            <div className="skeleton h-6 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
