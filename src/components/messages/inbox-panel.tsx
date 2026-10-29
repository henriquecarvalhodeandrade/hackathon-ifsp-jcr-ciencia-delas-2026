"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Inbox as InboxIcon,
  MessageSquare,
  MessagesSquare,
  Users,
} from "lucide-react";
import { Alert, TabNav, type TabNavItem } from "@/components/ui";
import {
  inboxHref,
  INBOX_TAB_LABELS,
  parseInboxTab,
  resolveInboxTab,
  type Inbox,
} from "@/lib/messages/inbox";
import { cn, formatNumber } from "@/lib/utils";
import { ConversationList } from "./conversation-list";

export const INBOX_NAV_LABEL = "Caixa de entrada";

/**
 * Caixa de entrada (montada pelo layout de /mensagens, então não some nem volta para o topo ao
 * trocar de conversa): abas "Conversas" e "Pedidos" (com a contagem de pedidos e, recolhido, o
 * grupo "Recusados") e a lista. A aba vem da URL (`?aba=`) ou, com uma conversa aberta, é a dela —
 * por isso é um componente de cliente (layouts não recebem `searchParams`). No computador é a
 * coluna da esquerda, com rolagem própria; no celular é a tela /mensagens (escondida quando uma
 * conversa está aberta).
 */
export function InboxPanel({
  inbox,
  failed,
  nowIso,
  className,
}: {
  inbox: Inbox;
  failed: boolean;
  /** "Agora" do servidor (os horários relativos batem com o HTML do servidor). */
  nowIso: string;
  className?: string;
}) {
  const search = useSearchParams();
  const params = useParams<{ id?: string }>();
  const currentId = typeof params.id === "string" ? params.id : null;
  const tab = resolveInboxTab(parseInboxTab(search.get("aba") ?? undefined), inbox, currentId);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const items = tab === "pedidos" ? inbox.pedidos : inbox.conversas;
  const currentDeclined = currentId ? inbox.recusados.some((i) => i.id === currentId) : false;

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
    <nav
      data-inbox-pane=""
      aria-labelledby="caixa-de-entrada"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card",
        className,
      )}
    >
      <div className="shrink-0 px-4 pt-4 sm:px-5">
        <h2 id="caixa-de-entrada" className="font-display text-2xl font-semibold text-fg">
          Mensagens
        </h2>
      </div>
      <TabNav
        label={INBOX_NAV_LABEL}
        items={tabs}
        scroll={false}
        className="mx-0 shrink-0 px-2 pt-1 sm:mx-0 sm:px-2"
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {failed ? (
          <Alert
            variant="danger"
            title="Não conseguimos carregar as suas mensagens"
            className="m-4"
          >
            Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
          </Alert>
        ) : (
          <>
            {items.length > 0 ? (
              <ConversationList items={items} currentId={currentId ?? undefined} now={now} />
            ) : (
              <EmptyInbox tab={tab} />
            )}
            {tab === "pedidos" && inbox.recusados.length > 0 && (
              <details open={currentDeclined} className="group border-t border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-semibold text-fg-muted hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-open:rotate-90"
                  />
                  Recusados
                  <span className="rounded-pill bg-surface-2 px-1.5 py-px text-xs text-fg-subtle tabular">
                    {formatNumber(inbox.recusados.length)}
                  </span>
                </summary>
                <ConversationList
                  items={inbox.recusados}
                  currentId={currentId ?? undefined}
                  now={now}
                  className="border-t border-border"
                />
              </details>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

function EmptyInbox({ tab }: { tab: "conversas" | "pedidos" }) {
  const pedidos = tab === "pedidos";
  return (
    <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-primary [&_svg]:size-6"
      >
        {pedidos ? <InboxIcon /> : <MessageSquare />}
      </span>
      <h3 className="font-display text-lg font-semibold text-fg">
        {pedidos ? "Nenhum pedido de mensagem" : "Nenhuma conversa ainda"}
      </h3>
      <p className="max-w-xs text-sm text-fg-muted">
        {pedidos
          ? "Quando alguém que ainda não é sua conexão quiser conversar, o pedido aparece aqui para você aceitar ou recusar."
          : "Encontre pesquisadoras no diretório e use o botão “Mensagem” no perfil delas para começar uma conversa."}
      </p>
      {!pedidos && (
        <Link
          href="/pesquisadoras"
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface-2 [&_svg]:size-4"
        >
          <Users aria-hidden="true" />
          Encontrar pesquisadoras
        </Link>
      )}
    </div>
  );
}
