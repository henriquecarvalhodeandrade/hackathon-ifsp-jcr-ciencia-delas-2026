import { Container, Skeleton } from "@/components/ui";
import { FeedSkeleton } from "@/components/feed/skeletons";

/** Carregamento do /feed: cabeçalho + as três colunas. */
export default function FeedLoading() {
  return (
    <Container className="pb-14" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando o feed…
      </p>
      <div aria-hidden="true" className="pt-6 pb-5 sm:pt-8 sm:pb-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-4 h-9 w-32" />
        <Skeleton className="mt-3 h-5 w-full max-w-md" />
      </div>
      <FeedSkeleton />
    </Container>
  );
}
