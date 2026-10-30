/**
 * Conversa da mentoria (/mentoria/conversa/<pedido>): regras de apresentação puras, sem rede nem
 * banco — cobertas por conversation.test.ts. As regras de verdade (quem lê, quem envia, limite
 * anti-spam) estão no banco: migration 20261028181500_mentorship_messages.sql.
 */
import type { MentorshipStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

/** Tamanho máximo de uma mensagem (igual ao CHECK do banco). */
export const MESSAGE_MAX = 2000;
/** De quanto em quanto tempo a página da conversa se atualiza enquanto está visível. */
export const CONVERSATION_REFRESH_MS = 15_000;
/** Quantas mensagens (as mais recentes) a página carrega. */
export const CONVERSATION_MESSAGE_LIMIT = 300;

export function conversationHref(requestId: string): string {
  return `/mentoria/conversa/${requestId}`;
}

/**
 * A conversa existe para este pedido? Só depois do aceite: mentoria ativa (aberta), concluída ou
 * cancelada depois do aceite (só leitura). Cancelado com `responded_at` = foi aceito antes
 * (recusado é estado final e nunca chega a cancelado).
 */
export function hasConversation(request: {
  status: MentorshipStatus;
  responded_at: string | null;
}): boolean {
  if (request.status === "accepted" || request.status === "completed") return true;
  return request.status === "cancelled" && request.responded_at !== null;
}

/** Papel da OUTRA participante, visto por quem está logada. */
export function otherRoleLabel(myRole: "mentee" | "mentor"): "Mentora" | "Mentoranda" {
  return myRole === "mentee" ? "Mentora" : "Mentoranda";
}

export interface ConversationBanner {
  variant: "info" | "warning";
  title: string;
  body: string;
}

export interface ConversationState {
  /** Mostra o campo de envio (o banco confere de novo: CD027). */
  canSend: boolean;
  /** Aviso de conversa só para leitura (ou ainda fechada). */
  banner: ConversationBanner | null;
}

export function conversationState(
  status: MentorshipStatus,
  myRole: "mentee" | "mentor",
  otherFirstName: string,
  /**
   * O pedido chegou a ser aceito (`hasConversation`)? Só muda o cancelado: cancelado ainda
   * pendente nunca abriu conversa — não há nada "guardado para leitura".
   */
  opened = true,
): ConversationState {
  const other = otherFirstName || (myRole === "mentee" ? "sua mentora" : "sua mentoranda");
  switch (status) {
    case "accepted":
      return { canSend: true, banner: null };
    case "completed":
      return {
        canSend: false,
        banner: {
          variant: "info",
          title: "Mentoria concluída",
          body: `A conversa com ${other} fica guardada aqui só para leitura.`,
        },
      };
    case "cancelled":
      if (!opened) {
        return {
          canSend: false,
          banner: {
            variant: "info",
            title: "Pedido cancelado",
            body: "O pedido foi cancelado antes do aceite: esta conversa não chegou a ser aberta.",
          },
        };
      }
      return {
        canSend: false,
        banner: {
          variant: "info",
          title: "Mentoria cancelada",
          body: `A conversa com ${other} fica guardada aqui só para leitura.`,
        },
      };
    case "pending":
      return {
        canSend: false,
        banner: {
          variant: "info",
          title: "Pedido aguardando resposta",
          body:
            myRole === "mentor"
              ? "A conversa abre assim que você aceitar o pedido."
              : `A conversa abre assim que ${other} aceitar o seu pedido.`,
        },
      };
    case "declined":
    default:
      return {
        canSend: false,
        banner: {
          variant: "warning",
          title: "Pedido não aceito",
          body: "Esta conversa não chegou a ser aberta.",
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Separadores por dia (fuso de São Paulo)
// ---------------------------------------------------------------------------

const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-28" no fuso de São Paulo. */
export function dayKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "Hoje", "Ontem" ou "segunda-feira, 26 de outubro" (com o ano, se não for o atual). */
export function dayLabel(key: string, now: Date = new Date()): string {
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(now.getTime() - DAY_MS)) return "Ontem";
  // Meio-dia em São Paulo (15h UTC): longe da virada do dia em qualquer fuso usado aqui.
  const date = new Date(`${key}T15:00:00Z`);
  const sameYear = key.slice(0, 4) === dayKey(now).slice(0, 4);
  return formatDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Agrupa mensagens (já em ordem cronológica) por dia, na ordem em que aparecem. */
export function groupByDay<T extends { created_at: string }>(
  items: readonly T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(item.created_at);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: dayLabel(key, now), items: [item] });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Não lidas
// ---------------------------------------------------------------------------

/** Conta as linhas (mensagens não lidas recebidas) por conversa. */
export function countByRequest(rows: readonly { request_id: string }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.request_id, (out.get(row.request_id) ?? 0) + 1);
  return out;
}

/** "3 mensagens não lidas" (para leitor de tela, ao lado do número). */
export function unreadLabel(count: number): string {
  return count === 1 ? "1 mensagem não lida" : `${count} mensagens não lidas`;
}

// ---------------------------------------------------------------------------
// Sugestões para começar a conversa (estado vazio)
// ---------------------------------------------------------------------------

export interface ConversationStarter {
  /** Texto curto do botão. */
  label: string;
  /** Mensagem que vai para o campo (a pessoa edita antes de enviar). */
  text: string;
}

export function conversationStarters(
  myRole: "mentee" | "mentor",
  otherFirstName: string,
): ConversationStarter[] {
  const hello = otherFirstName ? `Olá, ${otherFirstName}!` : "Olá!";
  const first =
    myRole === "mentee"
      ? `${hello} Muito obrigada por aceitar a mentoria. Quais dias e horários ficam bons para o nosso primeiro encontro?`
      : `${hello} Que bom começar esta mentoria. Quais dias e horários ficam bons para o nosso primeiro encontro?`;
  const third =
    myRole === "mentee"
      ? {
          label: "Contar sobre a pesquisa",
          text: "Antes do encontro, posso te mandar um resumo curto do que estou pesquisando e do que mais quero aprender?",
        }
      : {
          label: "Perguntar o objetivo",
          text: "Para eu me preparar: o que você mais quer conquistar nos próximos 3 meses?",
        };
  return [
    { label: "Combinar o primeiro encontro", text: first },
    {
      label: "Escolher o formato",
      text: "Você prefere conversar por vídeo ou pessoalmente? Uma conversa de 30 a 45 minutos costuma bastar para começar.",
    },
    third,
  ];
}
