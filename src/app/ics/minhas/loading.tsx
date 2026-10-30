import { ListCardsSkeleton, PageHeaderSkeleton } from "@/components/opportunities/skeletons";
import { Container, Skeleton } from "@/components/ui";

/** Carregamento de "Minhas candidaturas e vagas": abas e lista de cartões. */
export default function Loading() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando suas candidaturas e vagas…
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
