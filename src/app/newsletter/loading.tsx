import { Container, Skeleton, SkeletonCard, SkeletonText } from "@/components/ui";

export default function NewsletterLoading() {
  return (
    <Container className="py-8 sm:py-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando a newsletter…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-10 w-full max-w-sm" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="grid gap-6 lg:col-start-1 lg:row-start-1">
            <Skeleton className="h-64 rounded-dialog" />
            <SkeletonText lines={3} />
          </div>
          <SkeletonCard className="h-96 lg:col-start-2 lg:row-start-1" />
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="hidden lg:block" />
        </div>
      </div>
    </Container>
  );
}
