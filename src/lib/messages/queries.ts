import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  CONVERSATION_MESSAGE_LIMIT,
  toDirectMessages,
  type ConversationStatus,
  type DirectMessage,
} from "./conversation";
import { friendlyMessagesError } from "./errors";
import type { InboxRow } from "./inbox";

/**
 * Leituras das mensagens diretas, sempre com o cliente da sessão: o RLS só devolve a conversa e
 * as mensagens para as duas participantes (nem a moderação lê — conversas diretas são privadas;
 * denuncia-se o perfil). Conversa alheia ou inexistente volta como "not-found": a página responde
 * 404 nos dois casos, sem revelar qual é.
 */

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

const PERSON_COLUMNS = "id, full_name, avatar_url, headline, institution, state, career_stage";

/** A outra participante (mesmo formato do `PersonSummary`). */
export interface ConversationPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
}

export interface DirectConversation {
  id: string;
  status: ConversationStatus;
  /** Fui eu que comecei a conversa. */
  iAmInitiator: boolean;
  created_at: string;
  other: ConversationPerson;
  /** Em ordem cronológica (as mais antigas primeiro). */
  messages: DirectMessage[];
  /** Há mensagens mais antigas que as carregadas. */
  truncated: boolean;
  /** Mensagens minhas entre as carregadas (o pedido de mensagem permite uma). */
  mySentCount: number;
}

export type DirectConversationResult =
  { kind: "ok"; conversation: DirectConversation } | { kind: "not-found" } | { kind: "error" };

function warn(what: string, error: { code?: string; message: string }) {
  console.warn(`[mensagens] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
}

export async function loadDirectConversation(
  supabase: ServerClient,
  conversationId: string,
  userId: string,
): Promise<DirectConversationResult> {
  const { data: row, error } = await supabase
    .from("direct_conversations")
    .select("id, user_a, user_b, initiator_id, status, user_a_read_at, user_b_read_at, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    warn("conversa", error);
    return { kind: "error" };
  }
  if (!row || (row.user_a !== userId && row.user_b !== userId)) return { kind: "not-found" };

  const iAmA = row.user_a === userId;
  const otherId = iAmA ? row.user_b : row.user_a;

  const [person, recent] = await Promise.all([
    supabase.from("profiles").select(PERSON_COLUMNS).eq("id", otherId).maybeSingle(),
    supabase
      .from("direct_messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CONVERSATION_MESSAGE_LIMIT + 1),
  ]);
  if (recent.error) {
    warn("conversa (mensagens)", recent.error);
    return { kind: "error" };
  }
  // Perfil ilegível (ex.: suspenso): a conversa continua acessível, com um nome genérico.
  if (person.error) warn("conversa (perfil)", person.error);

  const rows = recent.data ?? [];
  const messages = toDirectMessages(rows.slice(0, CONVERSATION_MESSAGE_LIMIT).reverse(), {
    userId,
    myReadAt: iAmA ? row.user_a_read_at : row.user_b_read_at,
    otherReadAt: iAmA ? row.user_b_read_at : row.user_a_read_at,
  });
  const other = person.data;

  return {
    kind: "ok",
    conversation: {
      id: row.id,
      status: row.status,
      iAmInitiator: row.initiator_id === userId,
      created_at: row.created_at,
      other: {
        id: otherId,
        full_name: other?.full_name || "Pesquisadora",
        avatar_url: other?.avatar_url ?? null,
        headline: other?.headline ?? null,
        institution: other?.institution ?? null,
        state: other?.state ?? null,
        career_stage: other?.career_stage ?? null,
      },
      messages,
      truncated: rows.length > CONVERSATION_MESSAGE_LIMIT,
      mySentCount: messages.filter((m) => m.mine).length,
    },
  };
}

/**
 * Uma leitura por requisição: o layout da conversa (checagem de acesso → 404), os metadados e a
 * página compartilham o mesmo resultado.
 */
export const getDirectConversation = cache(
  async (conversationId: string, userId: string): Promise<DirectConversationResult> => {
    const supabase = await createClient();
    return loadDirectConversation(supabase, conversationId, userId);
  },
);

/** Caixa de entrada (`list_my_conversations()`, mais recentes primeiro). */
export async function loadInbox(
  supabase: ServerClient,
): Promise<{ rows: InboxRow[]; failed: boolean }> {
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) {
    warn("caixa de entrada", error);
    return { rows: [], failed: true };
  }
  return { rows: (data ?? []) as InboxRow[], failed: false };
}

/** Uma leitura da caixa por requisição (a página e a lista lateral da conversa). */
export const getInbox = cache(async () => {
  const supabase = await createClient();
  return loadInbox(supabase);
});

export type DraftTarget =
  /** Já existe a conversa do par: a página leva até ela. */
  | { kind: "existing"; conversationId: string }
  | { kind: "draft"; person: ConversationPerson; connected: boolean; highSchool: boolean }
  | { kind: "self" }
  | { kind: "not-found" }
  | { kind: "error" };

/**
 * Rascunho de conversa (`/mensagens/nova?com=<perfil>`), só leitura — nada é criado aqui (a
 * conversa nasce na primeira mensagem, em `sendFirstMessageAction`). Procura a conversa do par
 * (o RLS deixa ler as minhas), o perfil da pessoa e se já somos conexões.
 */
export async function loadDraftTarget(
  supabase: ServerClient,
  userId: string,
  profileId: string,
): Promise<DraftTarget> {
  if (profileId === userId) return { kind: "self" };
  const [userA, userB] = userId < profileId ? [userId, profileId] : [profileId, userId];
  const [existing, person, connection] = await Promise.all([
    supabase
      .from("direct_conversations")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(`${PERSON_COLUMNS}, onboarded_at`)
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${userId})`,
      )
      .limit(1),
  ]);
  if (existing.error || person.error) {
    warn("rascunho", (existing.error ?? person.error)!);
    return { kind: "error" };
  }
  if (existing.data) return { kind: "existing", conversationId: existing.data.id };
  const row = person.data;
  if (!row || !row.onboarded_at) return { kind: "not-found" };
  if (connection.error) warn("rascunho (conexão)", connection.error);
  return {
    kind: "draft",
    person: {
      id: row.id,
      full_name: row.full_name || "Pesquisadora",
      avatar_url: row.avatar_url ?? null,
      headline: row.headline ?? null,
      institution: row.institution ?? null,
      state: row.state ?? null,
      career_stage: row.career_stage ?? null,
    },
    connected: (connection.data ?? []).length > 0,
    highSchool: row.career_stage === "high_school",
  };
}

/**
 * Acha ou cria a conversa com outra pesquisadora (`start_direct_conversation`). O banco decide se
 * pode (perfil completo — CD060; não consigo mesma — CD065; ensino médio só com conexões — CD084;
 * limite diário — CD089) e se ela já nasce aceita ou como pedido de mensagem.
 */
export async function startDirectConversation(
  supabase: ServerClient,
  profileId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("start_direct_conversation", { p_other: profileId });
  if (error || typeof data !== "string" || !data) {
    if (error && !error.code?.startsWith("CD")) warn("começar conversa", error);
    return { ok: false, error: friendlyMessagesError(error, "start") };
  }
  return { ok: true, id: data };
}

const countUnreadConversations = cache(async (): Promise<number> => {
  try {
    if (!isSupabaseConfigured()) return 0;
    const user = await getCurrentUser();
    if (!user) return 0;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("count_unread_conversations");
    if (error) {
      warn("conversas não lidas", error);
      return 0;
    }
    return typeof data === "number" && Number.isFinite(data) ? Math.max(0, data) : 0;
  } catch (error) {
    // cookies() fora de uma requisição dinâmica etc.: o Next precisa ver esses erros.
    unstable_rethrow(error);
    return 0;
  }
});

/**
 * Quantas conversas têm mensagem nova para mim (`count_unread_conversations()`), para o selo de
 * mensagens do cabeçalho. Nunca lança: sem Supabase, sem sessão ou com qualquer erro, devolve 0
 * (o selo some e o resto da página segue). Uma leitura por requisição.
 */
export async function getUnreadConversationCount(): Promise<number> {
  return countUnreadConversations();
}
