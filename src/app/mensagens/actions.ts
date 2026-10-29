"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { conversationHref } from "@/lib/messages/conversation";
import { fallbackMessage, friendlyMessagesError, SESSION_EXPIRED } from "@/lib/messages/errors";
import { getUnreadConversationCount, startDirectConversation } from "@/lib/messages/queries";
import {
  conversationIdSchema,
  directMessageSchema,
  fieldErrorsOf,
  respondConversationSchema,
  startConversationSchema,
} from "@/lib/messages/schema";
import type { HeaderCounts, MarkReadResult, SendResult } from "@/lib/messages/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions das mensagens diretas. Cada uma confere a sessão e o perfil no servidor (o proxy
 * é só uma checagem otimista), valida com zod e deixa o RLS + triggers + RPCs do banco garantirem
 * as regras (participantes, pedido de mensagem, ensino médio, anti-spam). Quem envia é sempre a
 * usuária da sessão; os avisos (`direct_message`) são criados por trigger. São chamadas direto do
 * cliente (envio otimista), com argumentos simples — nunca recebem o id de quem envia.
 */

const INBOX = "/mensagens";

async function getMemberId(): Promise<{ userId: string } | { error: string }> {
  if (!isSupabaseConfigured())
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  const user = await getCurrentUser();
  if (!user) return { error: SESSION_EXPIRED };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) {
    return { error: "Complete o seu perfil antes de conversar com outras membras." };
  }
  return { userId: user.id };
}

function warnUnexpected(what: string, error: { code?: string; message: string }) {
  if (!error.code?.startsWith("CD")) {
    console.warn(`[mensagens] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
  }
}

/** Primeiro erro de validação (zod) da mensagem, em pt-BR. */
function invalidMessage(error: Parameters<typeof fieldErrorsOf>[0], fallback: string): string {
  const fieldErrors = fieldErrorsOf(error);
  return (
    fieldErrors.body?.[0] ??
    fieldErrors.conversation_id?.[0] ??
    fieldErrors.profile_id?.[0] ??
    fallback
  );
}

/**
 * Envia uma mensagem. O banco decide se pode (participante — CD085; pedido de mensagem sem
 * resposta ou recusado — CD086, com o mesmo texto: a recusa nunca é revelada; ensino médio —
 * CD084; limite — CD088) e avisa a outra participante. Responder a um pedido recebido aceita o
 * pedido; responder a um pedido recusado reabre a conversa. A resposta já traz a página nova
 * (revalidatePath): a mensagem provisória da tela dá lugar à do servidor no mesmo passo.
 */
export async function sendDirectMessageAction(
  conversationId: string,
  body: string,
): Promise<SendResult> {
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const parsed = directMessageSchema.safeParse({ conversation_id: conversationId, body });
  if (!parsed.success) {
    return { ok: false, error: invalidMessage(parsed.error, fallbackMessage("send")) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("direct_messages")
    .insert({ conversation_id: parsed.data.conversation_id, body: parsed.data.body });
  if (error) {
    warnUnexpected("mensagem", error);
    return { ok: false, error: friendlyMessagesError(error, "send") };
  }

  revalidatePath(INBOX, "layout");
  return { ok: true };
}

/**
 * Primeira mensagem de um rascunho (`/mensagens/nova?com=<perfil>`): só agora a conversa é criada
 * (`start_direct_conversation` — perfil completo CD060, não consigo mesma CD065, ensino médio
 * CD084 e limite diário CD089 são conferidos ANTES de criar qualquer linha) e a mensagem entra
 * logo em seguida. Deu certo: leva até a conversa. Assim, abrir "Mensagem" e desistir não deixa
 * conversas vazias (que não dá para apagar) nem gasta o limite de conversas novas do dia.
 */
export async function sendFirstMessageAction(profileId: string, body: string): Promise<SendResult> {
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const target = startConversationSchema.safeParse({ profile_id: profileId });
  if (!target.success) {
    return { ok: false, error: invalidMessage(target.error, fallbackMessage("start")) };
  }
  // Valida o texto antes de criar a conversa: mensagem inválida não pode deixar conversa vazia.
  const message = directMessageSchema.shape.body.safeParse(body);
  if (!message.success) {
    return {
      ok: false,
      error: message.error.issues[0]?.message ?? fallbackMessage("send"),
    };
  }

  const supabase = await createClient();
  const started = await startDirectConversation(supabase, target.data.profile_id);
  if (!started.ok) return { ok: false, error: started.error };

  const { error } = await supabase
    .from("direct_messages")
    .insert({ conversation_id: started.id, body: message.data });
  if (error) {
    // A conversa (vazia) já existe: some da lista, e o próximo envio cai nela.
    warnUnexpected("primeira mensagem", error);
    return { ok: false, error: friendlyMessagesError(error, "send") };
  }

  revalidatePath(INBOX, "layout");
  redirect(conversationHref(started.id));
}

/**
 * Aceita ou recusa um pedido de mensagem recebido (`respond_conversation_request`). Recusado
 * também pode ser aceito depois (o banco aceita declined → active).
 */
export async function respondConversationAction(
  conversationId: string,
  accept: boolean,
): Promise<SendResult> {
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const parsed = respondConversationSchema.safeParse({
    conversation_id: conversationId,
    accept: accept ? "true" : "false",
  });
  if (!parsed.success) {
    return { ok: false, error: invalidMessage(parsed.error, fallbackMessage("respond")) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_conversation_request", {
    p_conversation_id: parsed.data.conversation_id,
    p_accept: parsed.data.accept,
  });
  if (error) {
    warnUnexpected("responder pedido", error);
    return { ok: false, error: friendlyMessagesError(error, "respond") };
  }

  // A caixa de entrada (abas e contagem de pedidos) e o selo do cabeçalho mudam.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Registra que li a conversa até agora (`mark_conversation_read` — o banco grava a hora do
 * servidor e também marca como lidos os avisos `direct_message` desta conversa). Chamada pela
 * página quando está visível na tela (não na renderização: assim a pré-busca de links ou uma aba
 * em segundo plano não contam como leitura).
 */
export async function markReadAction(conversationId: string): Promise<MarkReadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };
  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) return { ok: false, error: fallbackMessage("read") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: parsed.data,
  });
  if (error) return { ok: false, error: friendlyMessagesError(error, "read") };

  // O selo de mensagens e o sino do cabeçalho (layout raiz) mostram as contagens.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Contagens dos selos do cabeçalho (para o `HeaderLive` decidir se vale atualizar a página). Os
 * avisos de mensagem direta ficam fora do sino — o ícone de mensagens já conta as conversas (o
 * mesmo critério do cabeçalho). Sem sessão ou com erro: zeros.
 */
export async function headerCountsAction(): Promise<HeaderCounts> {
  const user = await getCurrentUser();
  if (!user) return { messages: 0, notifications: 0 };
  const supabase = await createClient();
  const [messages, notifications] = await Promise.all([
    getUnreadConversationCount(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null)
      .neq("type", "direct_message"),
  ]);
  return { messages, notifications: notifications.error ? 0 : (notifications.count ?? 0) };
}
