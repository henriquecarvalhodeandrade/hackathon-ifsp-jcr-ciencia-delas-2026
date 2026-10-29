import { Inbox as InboxIcon, MessageSquare, MessagesSquare, Users } from "lucide-react";
import { Alert, ButtonLink, Card, EmptyState, TabNav, type TabNavItem } from "@/components/ui";
import { inboxHref, INBOX_TAB_LABELS, type Inbox, type InboxTab } from "@/lib/messages/inbox";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";

export const INBOX_NAV_LABEL = "Caixa de entrada";

/**
 * Painel da caixa de entrada: abas "Conversas" e "Pedidos" (com a contagem de pedidos) e a lista.
 * Na /mensagens é a coluna da esquerda (a tela toda no celular); na conversa aberta, a lista
 * lateral (só em telas largas), com a conversa atual destacada.
 */
export function InboxPane({
  inbox,
  tab,
  failed,
  currentId,
  headingId = "caixa-de-entrada",
  className,
}: {
  inbox: Inbox;
  tab: InboxTab;
  failed: boolean;
  currentId?: string;
  headingId?: string;
  className?: string;
}) {
  const items = tab === "pedidos" ? inbox.pedidos : inbox.conversas;
  const tabs: TabNavItem[] = [
    {
      href: inboxHref("conversas"),
      label: INBOX_TAB_LABELS.conversas,
      icon: <MessagesSquare aria-hidden="true" />,
      count: inbox.unreadConversations > 0 ? inbox.unreadConversations : undefined,
      active: tab === "conversas",
    },
    {
      href: inboxHref("pedidos"),
      label: INBOX_TAB_LABELS.pedidos,
      icon: <InboxIcon aria-hidden="true" />,
      count: inbox.pedidos.length > 0 ? inbox.pedidos.length : undefined,
      active: tab === "pedidos",
    },
  ];

  return (
    <Card
      as="section"
      aria-labelledby={headingId}
      className={cn("grid min-w-0 content-start overflow-hidden", className)}
    >
      <h2 id={headingId} className="sr-only">
        {tab === "pedidos" ? "Pedidos de mensagem" : "Suas conversas"}
      </h2>
      <TabNav label={INBOX_NAV_LABEL} items={tabs} className="mx-0 px-2 pt-1 sm:mx-0 sm:px-2" />

      {failed ? (
        <Alert variant="danger" title="Não conseguimos carregar as suas mensagens" className="m-4">
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      ) : items.length > 0 ? (
        <ConversationList items={items} currentId={currentId} />
      ) : tab === "pedidos" ? (
        <EmptyState
          variant="compact"
          headingLevel="h3"
          icon={<InboxIcon />}
          title="Nenhum pedido de mensagem"
          description="Quando alguém que ainda não é sua conexão quiser conversar, o pedido aparece aqui para você aceitar ou recusar."
        />
      ) : (
        <EmptyState
          variant="compact"
          headingLevel="h3"
          icon={<MessageSquare />}
          title="Nenhuma conversa ainda"
          description="Encontre pesquisadoras no diretório e use o botão “Mensagem” no perfil delas para começar uma conversa."
          action={
            <ButtonLink href="/pesquisadoras" variant="outline" size="sm">
              <Users aria-hidden="true" />
              Encontrar pesquisadoras
            </ButtonLink>
          }
        />
      )}
    </Card>
  );
}
