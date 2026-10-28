export default function ExploreLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-80 rounded-xl bg-muted" />
          <div className="h-4 w-96 max-w-full rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-muted" />
      </div>

      {/* Filtros skeleton */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-10 flex-1 rounded-xl bg-muted" />
          <div className="h-10 sm:w-64 rounded-xl bg-muted" />
        </div>
        <div className="h-4 w-56 rounded bg-muted" />
      </div>

      {/* Grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 rounded-full bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
            </div>
            <div className="flex gap-1.5 pt-1">
              <div className="h-4 w-16 rounded-full bg-muted" />
              <div className="h-4 w-20 rounded-full bg-muted" />
              <div className="h-4 w-14 rounded-full bg-muted" />
            </div>
            <div className="mt-auto pt-3 border-t border-border/60 flex justify-between">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
