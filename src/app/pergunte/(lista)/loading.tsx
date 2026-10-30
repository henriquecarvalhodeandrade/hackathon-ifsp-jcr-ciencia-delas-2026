import { Container, Skeleton, SkeletonCard, SkeletonText } from "@/components/ui";

/**
 * Carregamento só da lista (/pergunte). Ele mora no grupo (lista) de propósito: um loading.tsx em
 * src/app/pergunte/ envolveria também /pergunte/[id] num Suspense, a página começaria a ser
 * enviada antes do notFound() e uma pergunta inexistente responderia 200 em vez de 404.
 */
export default function Loading() {
  return (
    <Container aria-busy="true" className="pb-16">
      <p role="status" className="sr-only">
        Carregando perguntas…
      </p>
      <div aria-hidden="true" className="grid gap-8">
        <div className="grid max-w-3xl gap-3 pt-8 sm:pt-12">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <SkeletonText lines={2} />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
          <Skeleton className="h-[30rem] rounded-card" />
          <Skeleton className="h-80 rounded-card" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </Container>
  );
}
