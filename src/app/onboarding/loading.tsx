import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function LoadingOnboarding() {
  return (
    <Container size="narrow" className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        Preparando seu cadastro…
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <div className="mt-6 rounded-dialog border border-border bg-surface p-5 sm:p-8">
          <Skeleton className="h-7 w-40" />
          <SkeletonText className="mt-6" lines={6} />
        </div>
      </div>
    </Container>
  );
}
