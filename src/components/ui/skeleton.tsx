import { cn } from "@/lib/utils";

/** Bloco de carregamento. Envolva grupos de skeletons em um elemento com aria-busy/role="status". */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/** Linhas de texto simuladas; a última é mais curta. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Cartão de carregamento genérico (avatar + título + texto). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-card border border-border bg-surface p-5 shadow-card", className)}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText className="mt-5" lines={3} />
    </div>
  );
}
