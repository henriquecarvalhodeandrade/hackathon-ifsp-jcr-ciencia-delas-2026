import { Container, Skeleton } from "@/components/ui";

/** Carregamento dos formulários de adicionar e editar item do portfólio. */
export function PortfolioFormSkeleton({ label }: { label: string }) {
  return (
    <Container size="narrow" className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-6 h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-full max-w-sm" />
          <Skeleton className="mt-3 h-5 w-full" />
        </div>
        <div className="grid gap-8">
          <div className="grid gap-5 rounded-card border border-border bg-surface p-6 shadow-card">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="grid gap-5 rounded-card border border-border bg-surface p-6 shadow-card">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </Container>
  );
}
