import { Skeleton, SkeletonText } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Grade das três colunas do /feed (a mesma da página). */
export const FEED_GRID =
  "grid grid-cols-1 items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_17rem] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]";

/** Publicação simulada (autora, texto e rodapé). */
export function PostCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-card border border-border bg-surface p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded-badge" />
      </div>
      <SkeletonText lines={3} className="mt-4" />
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}

function SideSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-card border border-border bg-surface p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 grid gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <SkeletonText lines={2} className="flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carregamento do /feed: mini perfil, compositor, abas, publicações e colunas laterais. */
export function FeedSkeleton() {
  return (
    <div aria-hidden="true" className={FEED_GRID}>
      <div className="hidden rounded-card border border-border bg-surface shadow-card lg:block">
        <Skeleton className="h-14 rounded-none rounded-t-card" />
        <div className="-mt-8 grid justify-items-center gap-2 px-4 pb-4">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
      <div className="grid min-w-0 gap-4 md:mx-auto md:w-full md:max-w-2xl lg:max-w-none">
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card sm:p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-11 flex-1 rounded-pill" />
        </div>
        <div className="flex gap-2 border-b border-border pb-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton className="hidden sm:block" />
      </div>
      <div className="hidden gap-6 lg:grid">
        <SideSkeleton rows={3} />
        <SideSkeleton rows={4} />
      </div>
    </div>
  );
}

/** Carregamento da página de uma publicação. */
export function PostDetailSkeleton() {
  return (
    <div aria-hidden="true" className="pb-14">
      <Skeleton className="mt-8 h-4 w-32" />
      <PostCardSkeleton className="mt-6" />
      <Skeleton className="mt-10 h-7 w-40" />
      <div className="mt-5 grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
            <SkeletonText lines={2} className="mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
