/**
 * Regras de apresentação da mentoria (puras, sem rede nem banco — cobertas por testes).
 * Abas, rótulos de status, selo de origem da sugestão, avisos pós-ação e textos padrão.
 */
import { MENTORSHIP_STATUS, type MentorshipStatus } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Abas (?aba=)
// ---------------------------------------------------------------------------

export const MENTORSHIP_TABS = ["sugestoes", "enviadas", "recebidas", "ativas"] as const;
export type MentorshipTab = (typeof MENTORSHIP_TABS)[number];

export const MENTORSHIP_TAB_LABELS: Record<MentorshipTab, string> = {
  sugestoes: "Sugestões",
  enviadas: "Solicitações enviadas",
  recebidas: "Solicitações recebidas",
  ativas: "Mentorias ativas",
};

export function parseTab(value: unknown): MentorshipTab | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (MENTORSHIP_TABS as readonly string[]).includes(v)
    ? (v as MentorshipTab)
    : null;
}

export interface TabContext {
  requested: MentorshipTab | null;
  /** A aba "recebidas" só existe para mentoras (ou para quem ainda tem pedidos recebidos). */
  showReceived: boolean;
  seeksMentorship: boolean;
  isMentor: boolean;
  pendingReceived: number;
  /** Link direto ?mentora=<id> sempre abre na aba de sugestões. */
  hasDeepLink: boolean;
}

/**
 * Aba ativa: a pedida na URL (se existir para ela); senão, mentoras com pedidos aguardando
 * vão para "recebidas", mentorandas para "sugestões" e mentoras para "recebidas".
 */
export function resolveTab(ctx: TabContext): MentorshipTab {
  if (ctx.hasDeepLink) return "sugestoes";
  if (ctx.requested && (ctx.requested !== "recebidas" || ctx.showReceived)) return ctx.requested;
  if (ctx.showReceived && ctx.pendingReceived > 0) return "recebidas";
  if (ctx.seeksMentorship) return "sugestoes";
  if (ctx.isMentor) return "recebidas";
  return "sugestoes";
}

export function tabHref(tab: MentorshipTab): string {
  return `/mentoria?aba=${tab}`;
}

// ---------------------------------------------------------------------------
// Status dos pedidos
// ---------------------------------------------------------------------------

/** Subconjunto das variantes de <Badge> usadas aqui (mantém este módulo sem dependência de UI). */
export type StatusTone = "warning" | "success" | "neutral" | "primary" | "danger";

const STATUS_TONE: Record<MentorshipStatus, StatusTone> = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
  cancelled: "neutral",
  completed: "primary",
};

export function statusTone(status: MentorshipStatus): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function statusLabel(status: MentorshipStatus): string {
  return MENTORSHIP_STATUS[status] ?? status;
}

/** Pedido ainda em andamento (não pode haver outro igual para a mesma dupla). */
export function isOpenStatus(status: MentorshipStatus | null | undefined): boolean {
  return status === "pending" || status === "accepted";
}

// ---------------------------------------------------------------------------
// Origem da sugestão (IA x afinidade)
// ---------------------------------------------------------------------------

/** Nome do provedor a partir do modelo gravado em mentor_suggestions.model. */
export function aiProviderLabel(model: string | null | undefined): string | null {
  const m = (model ?? "").trim().toLowerCase();
  if (!m) return null;
  if (m.includes("gemini") || m.includes("gemma")) return "Gemini";
  if (m.startsWith("openrouter/") || m.includes(":free")) return "OpenRouter";
  if (m.startsWith("openai/gpt-oss") || m.includes("groq")) return "Groq";
  return null;
}

/** Selo exibido no cartão: "Sugestão por IA (Gemini)" ou "Sugestão por afinidade". */
export function suggestionSourceLabel(source: "ai" | "heuristic", model?: string | null): string {
  if (source !== "ai") return "Sugestão por afinidade";
  const provider = aiProviderLabel(model);
  return provider ? `Sugestão por IA (${provider})` : "Sugestão por IA";
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** Primeiro nome (ignora títulos como "Dra."). */
export function firstName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const titles = new Set(["dra", "dra.", "dr", "dr.", "profa", "profa.", "prof", "prof."]);
  const name = parts.find((p) => !titles.has(p.toLowerCase()));
  return name ?? "";
}

export const REQUEST_MESSAGE_MIN = 20;
export const REQUEST_MESSAGE_MAX = 1500;
export const RESPONSE_MESSAGE_MAX = 1000;

/**
 * Rascunho inicial do pedido de mentoria. A mentoranda edita antes de enviar; a pergunta para
 * puxar conversa (quando houver) entra no fim para dar um ponto de partida concreto.
 */
export function defaultRequestMessage(
  mentorName: string | null | undefined,
  starter?: string | null,
): string {
  const name = firstName(mentorName);
  const greeting = name ? `Olá, ${name}! ` : "Olá! ";
  const body =
    "Vi o seu perfil na Artemis e gostaria muito de contar com a sua mentoria. " +
    "Hoje estou trabalhando em [conte rapidamente sua pesquisa ou momento de carreira] e queria ajuda com [o que você busca].";
  const question = starter?.trim() ? `\n\nUma pergunta para começarmos: ${starter.trim()}` : "";
  return `${greeting}${body}${question}`;
}

/** Acrescenta uma pergunta ao fim da mensagem (sem duplicar). */
export function appendStarter(message: string, starter: string): string {
  const s = starter.trim();
  if (!s || message.includes(s)) return message;
  const base = message.trimEnd();
  return base ? `${base}\n\n${s}` : s;
}

/** Itens em comum entre duas listas, na ordem da primeira, sem repetição. */
export function sharedItems<T>(
  a: readonly T[] | null | undefined,
  b: readonly T[] | null | undefined,
): T[] {
  if (!a?.length || !b?.length) return [];
  const other = new Set(b);
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of a) {
    if (other.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Capacidade da mentora
// ---------------------------------------------------------------------------

export interface CapacitySummary {
  used: number;
  capacity: number;
  openSlots: number;
  full: boolean;
  /** 0–100 para o medidor. */
  percent: number;
}

export function capacitySummary(
  accepted: number,
  capacity: number | null | undefined,
): CapacitySummary {
  const cap = Math.max(0, Math.floor(capacity ?? 0));
  const used = Math.max(0, Math.floor(accepted));
  const openSlots = Math.max(0, cap - used);
  return {
    used,
    capacity: cap,
    openSlots,
    full: used >= cap,
    percent: cap === 0 ? 100 : Math.min(100, Math.round((used / cap) * 100)),
  };
}

// ---------------------------------------------------------------------------
// Avisos após uma ação (?aviso=) — só chaves conhecidas, nunca texto vindo da URL.
// ---------------------------------------------------------------------------

export const NOTICE_KEYS = [
  "enviado",
  "cancelado",
  "mentoria-cancelada",
  "aceito",
  "recusado",
  "concluido",
  "consentimento",
  // Reconhecimento da mentoria (src/lib/recognition/actions.ts)
  "retorno-enviado",
  "retorno-apagado",
  "declaracao-pedida",
  "declaracao-emitida",
  "declaracao-revogada",
  "declaracao-cancelada",
] as const;
export type NoticeKey = (typeof NOTICE_KEYS)[number];

export interface Notice {
  variant: "success" | "info";
  title: string;
  body: string;
}

const NOTICES: Record<NoticeKey, Notice> = {
  enviado: {
    variant: "success",
    title: "Pedido enviado!",
    body: "A mentora recebeu uma notificação. Assim que ela responder, você recebe um aviso por aqui.",
  },
  cancelado: {
    variant: "info",
    title: "Pedido cancelado",
    body: "Avisamos a mentora. Se quiser, você pode procurar outra mentora nas sugestões.",
  },
  "mentoria-cancelada": {
    variant: "info",
    title: "Mentoria cancelada",
    body: "Avisamos a mentora, e a mentoria agora aparece em “Encerradas”. Quando quiser, você pode buscar outra mentora nas sugestões.",
  },
  aceito: {
    variant: "success",
    title: "Mentoria aceita!",
    body: "O contato da mentoranda já aparece abaixo. Que tal combinar o primeiro encontro ainda esta semana?",
  },
  recusado: {
    variant: "info",
    title: "Pedido recusado",
    body: "Avisamos a pesquisadora com cuidado. Obrigada por responder: assim ela pode seguir em busca de outra mentora.",
  },
  concluido: {
    variant: "success",
    title: "Mentoria concluída",
    body: "Que bom que vocês chegaram até aqui! A mentoria agora aparece no histórico.",
  },
  consentimento: {
    variant: "success",
    title: "Sugestões com IA ativadas",
    body: "Na próxima vez que você buscar mentoras, usamos também a análise semântica e as explicações por IA (quando a IA estiver disponível). Você pode retirar a autorização quando quiser no seu perfil.",
  },
  "retorno-enviado": {
    variant: "success",
    title: "Obrigada por contar como foi!",
    body: "Só você vê as suas respostas. Elas entram apenas nos números gerais da plataforma, e só a partir de 5 retornos.",
  },
  "retorno-apagado": {
    variant: "info",
    title: "Retorno apagado",
    body: "Suas respostas foram apagadas. Se quiser, você pode contar como foi de novo.",
  },
  "declaracao-pedida": {
    variant: "success",
    title: "Declaração pedida",
    body: "A sua autorização já está registrada. A declaração é emitida assim que a outra participante autorizar o nome dela.",
  },
  "declaracao-emitida": {
    variant: "success",
    title: "Declaração emitida!",
    body: "Ela já pode ser conferida pelo código na página pública de verificação. Abra a declaração para imprimir ou salvar em PDF.",
  },
  "declaracao-revogada": {
    variant: "info",
    title: "Declaração revogada",
    body: "Na página de verificação, o código agora aparece como revogado, sem nomes. Se quiserem, vocês podem pedir uma nova.",
  },
  "declaracao-cancelada": {
    variant: "info",
    title: "Pedido de declaração cancelado",
    body: "Nenhum nome foi publicado. Se quiserem, vocês podem pedir a declaração de novo.",
  },
};

export function parseNotice(value: unknown): Notice | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (NOTICE_KEYS as readonly string[]).includes(v)
    ? NOTICES[v as NoticeKey]
    : null;
}
