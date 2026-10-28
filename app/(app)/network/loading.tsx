export default function NetworkLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-muted" />
        <div className="h-4 w-64 rounded-lg bg-muted" />
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-border pb-0">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-muted shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded-lg bg-muted" />
                <div className="h-3 w-24 rounded-lg bg-muted" />
              </div>
            </div>
            <div className="h-8 w-24 rounded-xl bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
