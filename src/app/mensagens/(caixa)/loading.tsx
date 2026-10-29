import { Skeleton } from "@/components/ui";

/**
 * Carregamento do painel da direita da caixa de entrada (a lista fica no layout e não recarrega).
 * No celular não há painel da direita: nada a mostrar.
 */
export default function Loading() {
  return (
    <div aria-busy="true" className="hidden min-h-0 flex-1 lg:flex">
      <p role="status" className="sr-only">
        Carregando mensagens…
      </p>
      <Skeleton aria-hidden="true" className="flex-1 rounded-card" />
    </div>
  );
}
