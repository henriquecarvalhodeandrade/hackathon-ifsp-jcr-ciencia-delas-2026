import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { z } from "zod";
import { Alert, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { InboxLive } from "@/components/messages/inbox-live";
import { InboxPane } from "@/components/messages/inbox-pane";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { conversationHref } from "@/lib/messages/conversation";
import { buildInbox, inboxHref, parseInboxTab, resolveInboxTab } from "@/lib/messages/inbox";
import { getInbox, startDirectConversation } from "@/lib/messages/queries";
import { PROFILE_NOT_FOUND } from "@/lib/messages/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensagens", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const profileParam = z.guid();

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Caixa de entrada. Em telas largas, duas colunas (a lista à esquerda, "Selecione uma conversa"
 * à direita); no celular, só a lista. `?com=<perfil>` abre (ou cria) a conversa com a pessoa e
 * leva até ela; se o banco não deixar, o motivo aparece aqui. Links para `?com=` são seguros com a
 * pré-busca padrão porque o loading.tsx deste grupo corta a pré-busca antes da página (a RPC não
 * roda) — nunca use `prefetch={true}` neles. O `<MessageButton>` (POST) dispensa a navegação.
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
  const next =
    withProfile !== undefined
      ? `/mensagens?com=${encodeURIComponent(withProfile)}`
      : requestedTab
        ? inboxHref(requestedTab)
        : "/mensagens";
  const profile = await requireOnboardedProfile(next);

  let startError: string | null = null;
  if (withProfile !== undefined) {
    const parsed = profileParam.safeParse(withProfile);
    if (!parsed.success) {
      startError = PROFILE_NOT_FOUND;
    } else {
      const supabase = await createClient();
      const result = await startDirectConversation(supabase, parsed.data);
      // Fora de try/catch: redirect() interrompe a renderização lançando um erro do Next.
      if (result.ok) redirect(conversationHref(result.id));
      startError = result.error;
    }
  }

  const { rows, failed } = await getInbox();
  const inbox = buildInbox(rows, profile.id);
  const tab = resolveInboxTab(requestedTab, inbox);

  return (
    <Container>
      <PageHeader
        eyebrow="Sua rede"
        title="Mensagens"
        description="Converse com outras membras da Artemis. Quem ainda não é sua conexão chega como pedido de mensagem."
        className="pb-5 sm:pb-6"
      />

      <div className="grid gap-6 pb-14">
        {startError && (
          <Alert variant="danger" title="Não foi possível abrir a conversa" live>
            {startError}
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <InboxPane inbox={inbox} tab={tab} failed={failed} />
          <Card
            variant="outline"
            className="hidden min-h-[28rem] items-center justify-center border-dashed lg:flex"
          >
            <EmptyState
              variant="compact"
              headingLevel="h2"
              icon={<MessagesSquare />}
              title="Selecione uma conversa"
              description="Escolha uma conversa na lista para ler e responder. As mensagens ficam só entre vocês duas."
            />
          </Card>
        </div>
      </div>

      <InboxLive />
    </Container>
  );
}
