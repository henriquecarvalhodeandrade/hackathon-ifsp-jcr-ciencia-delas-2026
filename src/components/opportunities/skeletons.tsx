import { Container, Skeleton, SkeletonText } from "@/components/ui";

/** Cartão de vaga carregando (mesmo formato do <OpportunityCard>). */
export function OpportunityCardSkeleton() {
  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-32 rounded-badge" />
        <Skeleton className="h-5 w-20 rounded-badge" />
      </div>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-3/5" />
      <SkeletonText lines={2} />
      <Skeleton className="mt-2 h-4 w-2/5" />
    </div>
  );
}

/** Cabeçalho de página carregando (com link de volta opcional). */
export function PageHeaderSkeleton({ back = false }: { back?: boolean }) {
  return (
    <div className="pt-8 pb-6 sm:pt-12 sm:pb-8">
      {back && <Skeleton className="mb-6 h-4 w-36" />}
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-full max-w-md" />
      <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
    </div>
  );
}

/** Lista de cartões largos (candidaturas, vagas publicadas) carregando. */
export function ListCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="grid gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-6 w-24 rounded-badge" />
          </div>
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

/** Formulário de publicar/editar vaga carregando. */
export function OpportunityFormSkeleton({ label }: { label: string }) {
  return (
    <Container size="narrow" className="pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true">
        <PageHeaderSkeleton back />
        <div className="grid gap-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid gap-5 rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
