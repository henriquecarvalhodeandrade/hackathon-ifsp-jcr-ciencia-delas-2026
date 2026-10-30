import { ListCardsSkeleton, PageHeaderSkeleton } from "@/components/opportunities/skeletons";
import { Container, Skeleton } from "@/components/ui";

/** Carregamento das candidaturas recebidas: abas de status e cartões. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando candidaturas…
      </p>
      <div aria-hidden="true">
        <PageHeaderSkeleton back />
        <Skeleton className="h-11 w-full" />
        <div className="py-6 sm:py-8">
          <ListCardsSkeleton />
        </div>
      </div>
    </Container>
  );
}
