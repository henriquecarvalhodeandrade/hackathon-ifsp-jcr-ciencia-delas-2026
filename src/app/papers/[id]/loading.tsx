import { Container, Skeleton, SkeletonText } from "@/components/ui";

/** Carregamento da página do paper: cabeçalho, resumo e coluna lateral. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando paper…
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-6 h-3 w-40" />
          <Skeleton className="mt-4 h-9 w-full max-w-3xl" />
          <Skeleton className="mt-2 h-9 w-full max-w-xl" />
          <Skeleton className="mt-4 h-5 w-full max-w-lg" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-10">
          <div className="grid content-start gap-8">
            <div className="rounded-card bg-surface-2 p-6">
              <Skeleton className="h-6 w-44 bg-surface" />
              <SkeletonText className="mt-4" lines={3} />
            </div>
            <div>
              <Skeleton className="h-6 w-56" />
              <SkeletonText className="mt-4" lines={6} />
            </div>
          </div>
          <div className="grid content-start gap-4">
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        </div>
      </div>
    </Container>
  );
}
