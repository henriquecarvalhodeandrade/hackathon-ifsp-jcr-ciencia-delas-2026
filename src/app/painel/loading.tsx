import { Container, Skeleton, SkeletonText } from "@/components/ui";
import { cn } from "@/lib/utils";

function SkeletonSection({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="mt-5 grid gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <SkeletonText lines={2} className="flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carregamento do /painel: cabeçalho + as duas colunas de blocos. */
export default function Loading() {
  return (
    <Container className="pt-8 pb-14 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando seu painel…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-full max-w-md" />
        <Skeleton className="mt-3 h-5 w-full max-w-lg" />
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-8">
          <div className="grid gap-6">
            <SkeletonSection rows={5} />
            <SkeletonSection rows={2} />
          </div>
          <div className="grid gap-6">
            <SkeletonSection rows={3} />
            <SkeletonSection rows={3} className="hidden lg:block" />
          </div>
        </div>
      </div>
    </Container>
  );
}
