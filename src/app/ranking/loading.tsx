import { Container, Skeleton } from "@/components/ui";

/** Carregamento do ranking: abas, filtros e pódio. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando ranking…
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
          <Skeleton className="mt-6 h-11 w-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-pill" />
          ))}
        </div>
        <Skeleton className="mt-4 h-24 w-full rounded-card" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-end">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-52 rounded-card" />
        </div>
      </div>
    </Container>
  );
}
