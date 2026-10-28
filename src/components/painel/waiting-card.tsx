import Link from "next/link";
import { Bell, ChevronRight, Hand, Hourglass, Inbox, MessageSquareText } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import type { WaitingData } from "@/lib/painel/queries";
import { formatRelativeTime, pluralize } from "@/lib/utils";
import { PainelSection } from "./painel-section";

interface WaitingItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
}

/** Monta as linhas na ordem de urgência: conversas, pedidos recebidos, enviados, avisos. */
export function waitingItems(waiting: WaitingData, now: number = Date.now()): WaitingItem[] {
  const items: WaitingItem[] = [];

  for (const c of waiting.conversations) {
    items.push({
      key: `conversa-${c.requestId}`,
      href: `/mentoria/conversa/${c.requestId}`,
      icon: <MessageSquareText />,
      title: c.name,
      detail: pluralize(c.unread, "mensagem nova", "mensagens novas"),
    });
  }

  const received = waiting.pendingReceived;
  if (received.count > 0) {
    items.push({
      key: "recebidos",
      href: "/mentoria?aba=recebidas",
      icon: <Inbox />,
      title:
        received.count === 1
          ? "1 pedido de mentoria aguardando sua resposta"
          : `${pluralize(received.count, "pedido")} de mentoria aguardando sua resposta`,
      detail: received.oldestAt
        ? `${received.count === 1 ? "Chegou" : "O mais antigo chegou"} ${formatRelativeTime(received.oldestAt, now)}`
        : undefined,
    });
  }

  for (const s of waiting.pendingSent) {
    items.push({
      key: `enviado-${s.requestId}`,
      href: "/mentoria?aba=enviadas",
      icon: <Hourglass />,
      title: `Aguardando a resposta de ${s.mentorName}`,
      detail: `Pedido enviado ${formatRelativeTime(s.createdAt, now)}`,
    });
  }
  const hiddenSent = waiting.pendingSentTotal - waiting.pendingSent.length;
  if (hiddenSent > 0) {
    items.push({
      key: "enviados-mais",
      href: "/mentoria?aba=enviadas",
      icon: <Hourglass />,
      title: `E mais ${pluralize(hiddenSent, "pedido enviado", "pedidos enviados")} aguardando resposta`,
    });
  }

  if (waiting.unreadNotifications > 0) {
    items.push({
      key: "notificacoes",
      href: "/notificacoes",
      icon: <Bell />,
      title: pluralize(
        waiting.unreadNotifications,
        "notificação não lida",
        "notificações não lidas",
      ),
    });
  }

  return items;
}

export interface WaitingCardProps {
  waiting: WaitingData;
  failed?: boolean;
  now?: number;
}

/** "O que está esperando você": só o que pede uma ação dela, cada linha leva direto ao lugar. */
export function WaitingCard({ waiting, failed = false, now }: WaitingCardProps) {
  const items = waitingItems(waiting, now);
  return (
    <PainelSection
      titleId="painel-pendencias"
      title="O que está esperando você"
      icon={<Hand />}
      failed={failed}
    >
      {items.length === 0 ? (
        <EmptyState
          variant="compact"
          headingLevel="h3"
          className="py-4"
          title="Nada pendente agora. Que tal ver as conversas do fórum?"
          action={
            <ButtonLink href="/forum" variant="outline" size="sm">
              Ir para o fórum
            </ButtonLink>
          }
        />
      ) : (
        <ul className="-mx-2 grid gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary ring-1 ring-border group-hover:bg-surface [&_svg]:size-4"
                >
                  {item.icon}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold text-pretty text-fg group-hover:text-primary">
                    {item.title}
                  </span>
                  {item.detail && (
                    <span className="text-sm text-fg-muted">
                      <span className="sr-only">, </span>
                      {item.detail}
                    </span>
                  )}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PainelSection>
  );
}
