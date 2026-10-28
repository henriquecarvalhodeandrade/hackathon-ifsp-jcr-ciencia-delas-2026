import { Container, Skeleton } from "@/components/ui";

/** Carregamento da conversa: cabeçalho, cartão da outra participante e algumas mensagens. */
export default function Loading() {
  return (
    <Container className="pt-8 pb-14 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando conversa…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-6 h-3 w-20" />
        <Skeleton className="mt-3 h-9 w-full max-w-sm" />
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-card border border-border bg-surface">
            <div className="flex items-center gap-4 border-b border-border p-4 sm:p-5">
              <Skeleton className="size-14 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
            </div>
            <div className="grid gap-4 p-4 sm:p-5">
              <Skeleton className="h-14 w-3/5 rounded-card" />
              <Skeleton className="ml-auto h-10 w-2/5 rounded-card" />
              <Skeleton className="h-20 w-2/3 rounded-card" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-card" />
            </div>
            <div className="border-t border-border p-4 sm:p-5">
              <Skeleton className="h-24 w-full rounded-control" />
            </div>
          </div>
          <Skeleton className="hidden h-96 rounded-card lg:block" />
        </div>
      </div>
    </Container>
  );
}
