import { Container } from "@/components/ui";
import { FeedSkeleton } from "@/components/feed/skeletons";

/** Carregamento do /feed: as três colunas (compositor fechado, abas e publicações). */
export default function FeedLoading() {
  return (
    <Container className="pt-4 pb-14 sm:pt-6" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando o feed…
      </p>
      <FeedSkeleton />
    </Container>
  );
}
