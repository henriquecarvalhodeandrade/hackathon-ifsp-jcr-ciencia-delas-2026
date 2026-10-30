import { Container, Skeleton, SkeletonCard } from "@/components/ui";

/** Carregamento da /portfolio: cabeçalho e a grade de itens. */
export default function Loading() {
  return (
    <Container className="pt-8 pb-16 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando seu portfólio…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-9 w-full max-w-xs" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        <Skeleton className="mt-10 h-6 w-32" />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
