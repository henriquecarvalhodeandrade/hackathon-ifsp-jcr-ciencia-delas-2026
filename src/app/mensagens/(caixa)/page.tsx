import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { Container, EmptyState } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { startConversationHref } from "@/lib/messages/conversation";
import { inboxHref, parseInboxTab } from "@/lib/messages/inbox";

export const metadata: Metadata = { title: "Mensagens", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Caixa de entrada. A lista fica no layout de /mensagens (no celular é a tela toda; no computador,
 * a coluna da esquerda); esta página é só o painel da direita: "Selecione uma conversa".
 * `?com=<perfil>` (links antigos) vai para o rascunho `/mensagens/nova?com=<perfil>`, que não
 * cria nada até a primeira mensagem.
 */
export default async function MensagensPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) {
    return (
      <Container className="py-12">
        <EmptyState
          icon={<MessagesSquare />}
          title="As mensagens ainda não estão disponíveis neste ambiente"
          description="Configure o Supabase (veja o aviso no topo da página) para conversar com outras membras."
        />
      </Container>
    );
  }

  const params = await searchParams;
  const withProfile = first(params.com);
  const requestedTab = parseInboxTab(params.aba);
  await requireOnboardedProfile(
    withProfile !== undefined
      ? startConversationHref(encodeURIComponent(withProfile))
      : requestedTab
        ? inboxHref(requestedTab)
        : "/mensagens",
  );
  if (withProfile !== undefined) redirect(startConversationHref(encodeURIComponent(withProfile)));

  return (
    <>
      <h1 className="sr-only">Mensagens</h1>
      <div className="hidden min-h-0 flex-1 items-center justify-center rounded-card border border-dashed border-border-strong bg-surface lg:flex">
        <EmptyState
          variant="compact"
          headingLevel="h2"
          icon={<MessagesSquare />}
          title="Selecione uma conversa"
          description="Escolha uma conversa na lista para ler e responder. As mensagens ficam só entre vocês duas."
        />
      </div>
    </>
  );
}
