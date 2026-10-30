import { Container, Skeleton, SkeletonCard } from "@/components/ui";

/** Carregamento da /rede: cabeçalho, abas e a grade de cartões de pessoas. */
export default function Loading() {
  return (
    <Container className="pt-8 pb-14 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando sua rede…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-full max-w-xs" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        <div className="mt-8 flex gap-3 border-b border-border pb-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="hidden h-6 w-24 sm:block" />
          <Skeleton className="hidden h-6 w-28 sm:block" />
        </div>
        <Skeleton className="mt-8 h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard
              key={i}
              className={i > 1 ? (i > 3 ? "hidden xl:block" : "hidden md:block") : undefined}
            />
          ))}
        </div>
      </div>
    </Container>
  );
}
