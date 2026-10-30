import { PageHeaderSkeleton } from "@/components/opportunities/skeletons";
import { Container, Skeleton, SkeletonText } from "@/components/ui";

/** Carregamento da vaga: descrição à esquerda, resumo e quem publicou à direita. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando vaga…
      </p>
      <div aria-hidden="true">
        <PageHeaderSkeleton back />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-10">
          <div className="grid content-start gap-8">
            <div>
              <Skeleton className="h-6 w-56" />
              <SkeletonText className="mt-4" lines={6} />
            </div>
            <div>
              <Skeleton className="h-5 w-32" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-7 w-24 rounded-pill" />
                <Skeleton className="h-7 w-28 rounded-pill" />
              </div>
            </div>
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
          <div className="grid content-start gap-4">
            <Skeleton className="h-72 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
        </div>
      </div>
    </Container>
  );
}
