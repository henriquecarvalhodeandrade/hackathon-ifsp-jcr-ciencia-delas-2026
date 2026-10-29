import { Container, Skeleton } from "@/components/ui";

/**
 * Carregamento da caixa de entrada: cabeçalho, abas e algumas linhas (e o painel vazio ao lado).
 * Também é ele que impede a pré-busca de links para `/mensagens?com=<perfil>` de rodar a página
 * (que cria a conversa): a pré-busca padrão de rotas dinâmicas para no loading.tsx mais próximo.
 */
export default function Loading() {
  return (
    <Container className="pt-8 pb-14 sm:pt-12" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando mensagens…
      </p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-9 w-48" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="rounded-card border border-border bg-surface">
            <div className="flex gap-2 border-b border-border px-3 py-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-24" />
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3 border-b border-border px-4 py-3.5 last:border-0">
                <Skeleton className="size-10 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="hidden h-[28rem] rounded-card lg:block" />
        </div>
      </div>
    </Container>
  );
}
