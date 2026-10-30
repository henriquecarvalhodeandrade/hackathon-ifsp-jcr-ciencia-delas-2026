import { Container, Skeleton, SkeletonText } from "@/components/ui";

function PaperCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Skeleton className="size-10" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="grid flex-1 gap-3">
        <Skeleton className="h-5 w-28 rounded-badge" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

/** Carregamento da Vitrine: mesma grade de cartões da página final. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando papers…
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
          <Skeleton className="mt-6 h-11 w-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-card" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <PaperCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </Container>
  );
}
