import { OpportunityCardSkeleton, PageHeaderSkeleton } from "@/components/opportunities/skeletons";
import { Container, Skeleton } from "@/components/ui";

/** Carregamento do Explorar ICs: filtros e a mesma grade de cartões da página final. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando vagas…
      </p>
      <div aria-hidden="true">
        <PageHeaderSkeleton />
        <Skeleton className="h-64 w-full rounded-card sm:h-56" />
        <Skeleton className="mt-8 h-6 w-40" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <OpportunityCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </Container>
  );
}
