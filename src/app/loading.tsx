import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Carregamento genérico das páginas (as rotas podem ter o próprio loading.tsx). */
export default function Loading() {
  return (
    <Container className="py-8 sm:py-12" aria-busy="true">
      <div role="status" className="sr-only">
        Carregando conteúdo…
      </div>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-full max-w-md" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="hidden lg:block" />
        </div>
      </div>
    </Container>
  );
}
