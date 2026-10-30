import { Container, Skeleton, SkeletonText } from "@/components/ui";

export default function NotificationsLoading() {
  return (
    <Container size="narrow" className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando notificações…
      </p>
      <div aria-hidden="true" className="grid gap-3 pt-8 pb-6 sm:pt-12 sm:pb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="mt-4 h-11 w-64" />
      </div>
      <div
        aria-hidden="true"
        className="divide-y divide-border rounded-card border border-border bg-surface shadow-card"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-4 p-5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-3/5" />
              <SkeletonText lines={1} />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
