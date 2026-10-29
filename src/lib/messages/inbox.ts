/**
 * Caixa de entrada (/mensagens): em que aba cada conversa aparece e como a linha se apresenta.
 * Puro, sem rede nem banco — coberto por inbox.test.ts. As linhas vêm da RPC
 * `list_my_conversations()` (docs/18-rede-social.md §2.5), já com os dados da outra pessoa.
 */
import { conversationHref, type ConversationStatus } from "./conversation";

export type InboxTab = "conversas" | "pedidos";

export const INBOX_TABS: readonly InboxTab[] = ["conversas", "pedidos"];

export const INBOX_TAB_LABELS: Record<InboxTab, string> = {
  conversas: "Conversas",
  pedidos: "Pedidos",
};

export function parseInboxTab(value: string | string[] | undefined): InboxTab | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return INBOX_TABS.includes(raw as InboxTab) ? (raw as InboxTab) : null;
}

export function inboxHref(tab: InboxTab = "conversas"): string {
  return tab === "conversas" ? "/mensagens" : `/mensagens?aba=${tab}`;
}

/** Linha de `list_my_conversations()` (mais recentes primeiro). */
export interface InboxRow {
  id: string;
  status: ConversationStatus;
  initiator_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  unread: boolean;
  other_id: string;
  other_name: string;
  other_avatar_url: string | null;
  other_headline: string | null;
  other_career_stage: string | null;
  created_at: string;
}

/** Já há mensagens na conversa? (A última remetente só é gravada quando chega uma mensagem.) */
export function hasMessages(
  row: Pick<InboxRow, "last_sender_id" | "last_message_preview">,
): boolean {
  return row.last_sender_id !== null || Boolean(row.last_message_preview);
}

/**
 * Aba da conversa para quem está logada, ou null (não aparece na lista):
 *  - Pedidos: pedido (`request`) que outra pessoa me mandou;
 *  - Conversas: as aceitas; as que eu comecei e ainda esperam resposta — inclusive as recusadas,
 *    que para quem pediu continuam "aguardando" (a interface nunca conta que foi recusado); e as
 *    que eu recusei (responder reabre — continuam ao alcance, com o selo "Você recusou");
 *  - nenhuma: conversa vazia que outra pessoa abriu e ainda não escreveu (não há o que ler).
 */
export function inboxTabOf(
  row: Pick<InboxRow, "status" | "initiator_id" | "last_sender_id" | "last_message_preview">,
  userId: string,
): InboxTab | null {
  const mine = row.initiator_id === userId;
  if (!mine && !hasMessages(row)) return null;
  if (row.status === "request" && !mine) return "pedidos";
  return "conversas";
}

/**
 * Situação mostrada na linha (selo). Recusa só aparece para quem recusou; para quem pediu, um
 * pedido recusado continua "Aguardando resposta".
 */
export type InboxBadge = "draft" | "waiting" | "request" | "declined-by-me" | null;

export interface InboxItem {
  id: string;
  href: string;
  tab: InboxTab;
  other: {
    id: string;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
    careerStage: string | null;
  };
  /** Prévia da última mensagem ("Você: …" quando fui eu), ou null se ainda não há mensagens. */
  preview: string | null;
  /** Momento da última atividade (última mensagem ou criação). */
  at: string;
  unread: boolean;
  badge: InboxBadge;
}

/** "Você: " antes da prévia quando a última mensagem é minha. */
export function previewText(
  row: Pick<InboxRow, "last_message_preview" | "last_sender_id">,
  userId: string,
): string | null {
  const text = row.last_message_preview?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return row.last_sender_id === userId ? `Você: ${text}` : text;
}

export function inboxBadge(
  row: Pick<InboxRow, "status" | "initiator_id" | "last_sender_id" | "last_message_preview">,
  userId: string,
): InboxBadge {
  if (row.status === "active") return null;
  if (row.initiator_id === userId) {
    // Pedido aberto por mim e ainda sem a mensagem: falta escrever. Recusado cai sempre em
    // "aguardando", tenha ou não mensagem.
    return row.status === "request" && !hasMessages(row) ? "draft" : "waiting";
  }
  return row.status === "request" ? "request" : "declined-by-me";
}

export const INBOX_BADGE_LABELS: Record<Exclude<InboxBadge, null>, string> = {
  draft: "Pedido não enviado",
  waiting: "Aguardando resposta",
  request: "Pedido de mensagem",
  "declined-by-me": "Você recusou",
};

export function toInboxItem(row: InboxRow, userId: string): InboxItem | null {
  const tab = inboxTabOf(row, userId);
  if (!tab) return null;
  return {
    id: row.id,
    href: conversationHref(row.id),
    tab,
    other: {
      id: row.other_id,
      name: row.other_name || "Pesquisadora",
      avatarUrl: row.other_avatar_url,
      headline: row.other_headline,
      careerStage: row.other_career_stage,
    },
    preview: previewText(row, userId),
    at: row.last_message_at ?? row.created_at,
    // Aguardando: não há mensagem dela para ler.
    unread: row.unread && row.last_sender_id !== userId,
    badge: inboxBadge(row, userId),
  };
}

export interface Inbox {
  conversas: InboxItem[];
  pedidos: InboxItem[];
  /** Conversas (aba "Conversas") com mensagem nova. */
  unreadConversations: number;
}

/** Separa as linhas nas duas abas, mais recentes primeiro. */
export function buildInbox(rows: readonly InboxRow[], userId: string): Inbox {
  const items = rows
    .map((row) => toInboxItem(row, userId))
    .filter((item): item is InboxItem => item !== null)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const conversas = items.filter((item) => item.tab === "conversas");
  return {
    conversas,
    pedidos: items.filter((item) => item.tab === "pedidos"),
    unreadConversations: conversas.filter((item) => item.unread).length,
  };
}

/**
 * Aba aberta por padrão: a pedida; sem pedido na URL, "Conversas" — exceto quando ainda não há
 * conversas e há pedidos esperando.
 */
export function resolveInboxTab(requested: InboxTab | null, inbox: Inbox): InboxTab {
  if (requested) return requested;
  if (inbox.conversas.length === 0 && inbox.pedidos.length > 0) return "pedidos";
  return "conversas";
}
