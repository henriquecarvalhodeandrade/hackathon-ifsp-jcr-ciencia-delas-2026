import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function LoadingMyProfile() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando seu perfil…
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-9 w-56" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="hidden gap-3 lg:grid lg:content-start">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
          <div className="grid gap-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-card border border-border bg-surface p-6 sm:p-8">
                <Skeleton className="h-6 w-40" />
                <SkeletonText className="mt-6" lines={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
