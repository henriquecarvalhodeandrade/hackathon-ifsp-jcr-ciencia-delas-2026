export default function FeedLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      {/* Banner de boas-vindas skeleton */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded-lg bg-muted" />
            <div className="h-4 w-72 rounded-lg bg-muted" />
          </div>
          <div className="h-9 w-32 rounded-xl bg-muted shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* Composer skeleton */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-16 w-full rounded-xl bg-muted" />
            <div className="flex justify-end">
              <div className="h-8 w-24 rounded-xl bg-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Título + Posts skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-64 rounded-lg bg-muted" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 rounded-lg bg-muted" />
                  <div className="h-3 w-24 rounded-lg bg-muted" />
                </div>
              </div>
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
            <div className="mt-4 pt-3 border-t border-border/60">
              <div className="h-7 w-40 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
