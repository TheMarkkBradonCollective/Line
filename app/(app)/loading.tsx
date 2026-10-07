export default function Loading() {
  return (
    <div className="px-0 pt-4" aria-busy="true" aria-label="Loading">
      <div className="mx-4 h-8 w-36 rounded-full skeleton" />
      <div className="mx-4 mt-3 h-4 w-56 rounded-full skeleton" />
      <div className="mt-4 aspect-square skeleton" />
      <div className="mx-4 mt-3 h-4 w-40 rounded-full skeleton" />
      <div className="mx-4 mt-2 h-4 w-64 rounded-full skeleton" />
    </div>
  );
}
