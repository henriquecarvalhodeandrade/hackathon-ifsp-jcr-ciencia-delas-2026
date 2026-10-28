import "server-only";
import { cache } from "react";
import type { MentorshipStatus } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { CONVERSATION_MESSAGE_LIMIT, countByRequest } from "./conversation";
import {
  PERSON_COLUMNS,
  toPerson,
  type Person,
  type PersonRow,
  type ServerClient,
} from "./queries";

/**
 * Leituras da conversa da mentoria, sempre com o cliente da sessão: o RLS só devolve o pedido e
 * as mensagens para as duas participantes (nem a moderação lê). Pedido alheio ou inexistente
 * volta como `null` — a página responde 404 nos dois casos, sem revelar qual é.
 */

export interface ConversationMessage {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  /** Enviada pela usuária logada. */
  mine: boolean;
}

export interface Conversation {
  request: {
    id: string;
    status: MentorshipStatus;
    message: string;
    created_at: string;
    responded_at: string | null;
    updated_at: string;
  };
  /** Papel da usuária logada. */
  role: "mentee" | "mentor";
  other: Person;
  /** Em ordem cronológica (as mais antigas primeiro). */
  messages: ConversationMessage[];
  /** Há mensagens mais antigas que as carregadas. */
  truncated: boolean;
  /** Mensagens da outra participante ainda não lidas (entre as carregadas). */
  unreadFromOther: number;
}

export type ConversationResult =
  { kind: "ok"; conversation: Conversation } | { kind: "not-found" } | { kind: "error" };

function warn(what: string, error: { code?: string; message: string }) {
  console.warn(`[mentoria] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
}

export async function loadConversation(
  supabase: ServerClient,
  requestId: string,
  userId: string,
): Promise<ConversationResult> {
  const { data: row, error } = await supabase
    .from("mentorship_requests")
    .select(
      `id, status, message, created_at, responded_at, updated_at, mentee_id, mentor_id,
       mentee:profiles!mentorship_requests_mentee_id_fkey(${PERSON_COLUMNS}),
       mentor:profiles!mentorship_requests_mentor_id_fkey(${PERSON_COLUMNS})`,
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error) {
    warn("conversa (pedido)", error);
    return { kind: "error" };
  }
  if (!row || (row.mentee_id !== userId && row.mentor_id !== userId)) return { kind: "not-found" };

  const role = row.mentee_id === userId ? "mentee" : "mentor";
  const otherRow = (role === "mentee" ? row.mentor : row.mentee) as PersonRow | null;
  const otherId = role === "mentee" ? row.mentor_id : row.mentee_id;

  const { data: rows, error: messagesError } = await supabase
    .from("mentorship_messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CONVERSATION_MESSAGE_LIMIT + 1);
  if (messagesError) {
    warn("conversa (mensagens)", messagesError);
    return { kind: "error" };
  }

  const recent = (rows ?? []).slice(0, CONVERSATION_MESSAGE_LIMIT).reverse();
  const messages: ConversationMessage[] = recent.map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    read_at: m.read_at,
    mine: m.sender_id === userId,
  }));

  return {
    kind: "ok",
    conversation: {
      request: {
        id: row.id,
        status: row.status,
        message: row.message,
        created_at: row.created_at,
        responded_at: row.responded_at,
        updated_at: row.updated_at,
      },
      role,
      other: toPerson(otherRow, otherId),
      messages,
      truncated: (rows ?? []).length > CONVERSATION_MESSAGE_LIMIT,
      unreadFromOther: messages.filter((m) => !m.mine && m.read_at === null).length,
    },
  };
}

/**
 * Uma leitura por requisição: o layout da conversa (checagem de acesso → 404), os metadados e a
 * página compartilham o mesmo resultado.
 */
export const getConversation = cache(
  async (requestId: string, userId: string): Promise<ConversationResult> => {
    const supabase = await createClient();
    return loadConversation(supabase, requestId, userId);
  },
);

/**
 * Mensagens recebidas e ainda não lidas, por conversa (para o selo do botão "Conversar").
 * Em caso de erro devolve um mapa vazio: o selo some, a conversa continua acessível.
 */
export async function loadUnreadCounts(
  supabase: ServerClient,
  userId: string,
  requestIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(requestIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("mentorship_messages")
    .select("request_id")
    .in("request_id", ids)
    .neq("sender_id", userId)
    .is("read_at", null)
    .limit(5000);
  if (error) {
    warn("mensagens não lidas", error);
    return new Map();
  }
  return countByRequest(data ?? []);
}
