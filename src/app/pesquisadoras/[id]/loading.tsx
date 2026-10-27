import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function LoadingProfile() {
  return (
    <Container className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando perfil…
      </p>
      <div aria-hidden="true">
        <Skeleton className="mt-6 h-4 w-28 sm:mt-10" />
        <div className="flex flex-col gap-5 py-6 sm:flex-row sm:items-start sm:gap-7 sm:py-8">
          <Skeleton className="size-28 rounded-full" />
          <div className="grid flex-1 gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-5 w-full max-w-lg" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6">
            <div className="rounded-card border border-border bg-surface p-6">
              <Skeleton className="h-6 w-32" />
              <SkeletonText className="mt-5" lines={4} />
            </div>
            <div className="rounded-card border border-border bg-surface p-6">
              <Skeleton className="h-6 w-40" />
              <SkeletonText className="mt-5" lines={3} />
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-6">
            <Skeleton className="h-5 w-36" />
            <SkeletonText className="mt-4" lines={3} />
          </div>
        </div>
      </div>
    </Container>
  );
}
