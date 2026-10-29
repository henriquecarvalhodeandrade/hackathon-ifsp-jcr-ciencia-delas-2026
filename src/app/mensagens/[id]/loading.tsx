import { Skeleton } from "@/components/ui";

/**
 * Carregamento da conversa (só o painel da direita; a lista fica no layout). Tem o formato do chat
 * e, no celular, já ocupa a tela toda (`data-chat-open`): nada pula quando a conversa chega.
 */
export default function Loading() {
  return (
    <div
      data-chat-open=""
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface lg:rounded-card lg:border lg:border-border lg:shadow-card"
    >
      <p role="status" className="sr-only">
        Carregando conversa…
      </p>
      <div aria-hidden="true" className="contents">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5 lg:px-5">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-4 lg:px-6">
          <Skeleton className="h-14 w-3/5 rounded-card" />
          <Skeleton className="ml-auto h-10 w-2/5 rounded-card" />
          <Skeleton className="h-12 w-1/2 rounded-card" />
          <Skeleton className="ml-auto h-10 w-1/3 rounded-card" />
        </div>
        <div className="flex shrink-0 items-end gap-2 border-t border-border px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:px-6 lg:pb-4">
          <Skeleton className="h-11 flex-1 rounded-control" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
