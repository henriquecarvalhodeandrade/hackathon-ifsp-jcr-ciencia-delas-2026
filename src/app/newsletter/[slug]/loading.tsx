import { Container, Skeleton, SkeletonCard, SkeletonText } from "@/components/ui";

export default function EditionLoading() {
  return (
    <Container size="narrow" className="py-8 sm:py-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando a edição…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-6 h-56 rounded-dialog" />
        <div className="mt-8">
          <SkeletonText lines={3} />
        </div>
        <Skeleton className="mt-8 h-28 rounded-card" />
        <div className="mt-10 grid gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </Container>
  );
}
