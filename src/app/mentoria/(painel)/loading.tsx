import { Container, Skeleton, SkeletonCard } from "@/components/ui";

/** Carregamento da /mentoria: cabeçalho, abas e dois cartões de sugestão. */
export default function Loading() {
  return (
    <Container className="pt-8 pb-14 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando mentoria…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-9 w-full max-w-lg" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        <div className="mt-8 flex gap-3 border-b border-border pb-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="hidden h-6 w-40 sm:block" />
          <Skeleton className="hidden h-6 w-32 sm:block" />
        </div>
        <Skeleton className="mt-8 h-24 w-full rounded-card" />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard className="hidden lg:block" />
        </div>
      </div>
    </Container>
  );
}
