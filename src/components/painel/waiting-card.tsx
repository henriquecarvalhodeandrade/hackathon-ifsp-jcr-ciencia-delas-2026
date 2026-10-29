import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Hand,
  Hourglass,
  Inbox,
  MessageCircle,
  MessageCirclePlus,
  MessageSquareText,
  UserPlus,
} from "lucide-react";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import type { NetworkWaiting, WaitingPerson } from "@/lib/painel/network";
import type { WaitingData } from "@/lib/painel/queries";
import { formatRelativeTime, pluralize } from "@/lib/utils";
import { PainelSection } from "./painel-section";

interface WaitingItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  /** Pessoa da linha: o rosto dela no lugar do ícone. */
  person?: WaitingPerson;
  title: React.ReactNode;
  detail?: React.ReactNode;
}

/**
 * Monta as linhas na ordem de urgência: conversas (mentoria e diretas, com pedidos de mensagem),
 * pedidos de mentoria recebidos, convites de conexão, candidaturas nas vagas dela, pedidos de
 * mentoria enviados e, por fim, os outros avisos não lidos.
 */
export function waitingItems(
  waiting: WaitingData,
  now: number = Date.now(),
  network: NetworkWaiting | null = null,
): WaitingItem[] {
  const items: WaitingItem[] = [];

  for (const c of waiting.conversations) {
    items.push({
      key: `conversa-${c.requestId}`,
      href: `/mentoria/conversa/${c.requestId}`,
      icon: <MessageSquareText />,
      title: c.name,
      detail: `${pluralize(c.unread, "mensagem nova", "mensagens novas")} na mentoria`,
    });
  }

  if (network) {
    for (const c of network.conversations) {
      items.push({
        key: `mensagem-${c.id}`,
        href: `/mensagens/${c.id}`,
        icon: c.kind === "request" ? <MessageCirclePlus /> : <MessageCircle />,
        person: c.person,
        title: c.kind === "request" ? `${c.person.name} quer conversar` : c.person.name,
        detail:
          c.kind === "request"
            ? "Pedido de mensagem: responda para aceitar ou recuse"
            : `Mensagem nova ${formatRelativeTime(c.at, now)}`,
      });
    }
    const hidden = network.conversationsTotal - network.conversations.length;
    if (hidden > 0) {
      items.push({
        key: "mensagens-mais",
        href: "/mensagens",
        icon: <MessageCircle />,
        title: `E mais ${pluralize(hidden, "conversa esperando", "conversas esperando")} por você`,
      });
    }
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

  if (network) {
    for (const invite of network.invites) {
      items.push({
        key: `convite-${invite.id}`,
        href: "/rede?aba=convites",
        icon: <UserPlus />,
        person: invite.person,
        title: `${invite.person.name} quer se conectar`,
        detail: `Convite de conexão ${formatRelativeTime(invite.at, now)}`,
      });
    }
    const hiddenInvites = network.invitesTotal - network.invites.length;
    if (hiddenInvites > 0) {
      items.push({
        key: "convites-mais",
        href: "/rede?aba=convites",
        icon: <UserPlus />,
        title: `E mais ${pluralize(hiddenInvites, "convite", "convites")} de conexão para responder`,
      });
    }

    for (const application of network.applications) {
      items.push({
        key: `candidatura-${application.id}`,
        href: `/ics/${application.opportunityId}/candidaturas`,
        icon: <ClipboardList />,
        person: application.person,
        title: `${application.person.name} se candidatou`,
        detail: `À vaga “${application.opportunityTitle}”, ${formatRelativeTime(application.at, now)}`,
      });
    }
    const hiddenApplications = network.applicationsTotal - network.applications.length;
    if (hiddenApplications > 0) {
      items.push({
        key: "candidaturas-mais",
        href: "/ics/minhas?aba=publicadas",
        icon: <ClipboardList />,
        title: `E mais ${pluralize(hiddenApplications, "candidatura nova", "candidaturas novas")} nas suas vagas`,
      });
    }
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

  // As mensagens diretas, os convites e as candidaturas já aparecem acima, com nome: esta contagem
  // deixa esses tipos de fora (loadPainelData), para nada ser contado duas vezes.
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
      detail: network ? "Curtidas, comentários, respostas e outros avisos" : undefined,
    });
  }

  return items;
}

export interface WaitingCardProps {
  waiting: WaitingData;
  failed?: boolean;
  now?: number;
  /**
   * Pendências da rede social (loadNetworkWaiting). `null` = não carregou: só esta parte avisa,
   * as pendências da mentoria continuam. Sem a prop, o bloco mostra só a mentoria.
   */
  network?: NetworkWaiting | null;
}

/** "O que está esperando você": só o que pede uma ação dela, cada linha leva direto ao lugar. */
export function WaitingCard({ waiting, failed = false, now, network }: WaitingCardProps) {
  const items = waitingItems(waiting, now, network ?? null);
  const networkFailed = network === null;
  return (
    <PainelSection
      titleId="painel-pendencias"
      title="O que está esperando você"
      icon={<Hand />}
      failed={failed}
    >
      {items.length === 0 ? (
        networkFailed ? (
          <NetworkFailedNote />
        ) : (
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
        )
      ) : (
        <div className="grid gap-3">
          <ul className="-mx-2 grid gap-1">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2"
                >
                  {item.person ? (
                    <Avatar
                      name={item.person.name}
                      src={item.person.avatarUrl}
                      seed={item.person.id}
                      size="md"
                      className="size-9"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary ring-1 ring-border group-hover:bg-surface [&_svg]:size-4"
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-semibold text-pretty text-fg group-hover:text-primary">
                      {item.title}
                    </span>
                    {item.detail && (
                      <span className="text-sm break-words text-fg-muted">
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
          {networkFailed && <NetworkFailedNote />}
        </div>
      )}
    </PainelSection>
  );
}

/** A parte da rede não carregou: aviso calmo, sem esconder o que veio da mentoria. */
function NetworkFailedNote() {
  return (
    <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-3 text-sm text-fg-muted">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>
        Não conseguimos carregar as mensagens, os convites e as candidaturas agora. Recarregue a
        página em instantes.
      </span>
    </p>
  );
}
