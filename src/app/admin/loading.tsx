import { Container, Skeleton, SkeletonText } from "@/components/ui";

export default function AdminLoading() {
  return (
    <Container size="wide" className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando o painel de moderação…
      </p>
      <div aria-hidden="true" className="grid gap-3 pt-8 pb-6 sm:pt-12 sm:pb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <Skeleton className="mt-4 h-11 w-80" />
      </div>
      <div aria-hidden="true" className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="grid gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="grid gap-4 rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <div className="flex gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="h-4 w-64" />
              <div className="rounded-control border border-border p-4">
                <SkeletonText lines={3} />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="hidden h-64 xl:block" />
      </div>
    </Container>
  );
}
