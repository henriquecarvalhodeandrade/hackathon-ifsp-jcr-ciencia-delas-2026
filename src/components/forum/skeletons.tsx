import { Container, Skeleton, SkeletonText } from "@/components/ui";

/** Linhas de tópico simuladas (mesma grade da ThreadList). */
export function ThreadListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-4/5 max-w-lg" />
            <Skeleton className="h-3 w-2/5 max-w-xs" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-6 w-16 rounded-pill" />
              <Skeleton className="h-6 w-20 rounded-pill" />
            </div>
          </div>
          <Skeleton className="hidden h-8 w-12 sm:block" />
        </li>
      ))}
    </ul>
  );
}

/** Cabeçalho de página simulado (eyebrow + título + descrição). */
export function PageHeaderSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div aria-hidden="true" className="pt-8 pb-6 sm:pt-12 sm:pb-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-full max-w-sm" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      {withSearch && <Skeleton className="mt-6 h-11 w-full" />}
    </div>
  );
}

export function ForumLoadingShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Container aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </Container>
  );
}

/** Tópico simulado (título, autora, corpo e respostas). */
export function ThreadSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-3xl pb-14">
      <Skeleton className="mt-8 h-4 w-56" />
      <Skeleton className="mt-6 h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-full" />
      <Skeleton className="mt-2 h-9 w-2/3" />
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <SkeletonText lines={6} className="mt-8" />
      <div className="mt-8 flex gap-2 border-y border-border py-3">
        <Skeleton className="h-8 w-24 rounded-pill" />
        <Skeleton className="h-8 w-20 rounded-pill" />
        <Skeleton className="h-8 w-28 rounded-pill" />
      </div>
      <Skeleton className="mt-10 h-7 w-40" />
      <div className="mt-5 grid gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
            <SkeletonText lines={3} className="mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formulário de tópico simulado. */
export function ThreadFormSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-6 rounded-card border border-border bg-surface p-6 shadow-card sm:p-8"
    >
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <div className="grid gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-56 w-full" />
      </div>
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
