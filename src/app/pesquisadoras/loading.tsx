import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function LoadingDirectory() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando pesquisadoras…
      </p>
      <div aria-hidden="true" className="pt-8 pb-6 sm:pt-12 sm:pb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-full max-w-xs" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <Skeleton className="mt-6 h-48 w-full rounded-card" />
      </div>
      <div aria-hidden="true" className="grid gap-5 py-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} className={i > 3 ? "hidden lg:block" : undefined} />
        ))}
      </div>
    </Container>
  );
}
