"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { conversationHref } from "@/lib/messages/conversation";
import { fallbackMessage, friendlyMessagesError, SESSION_EXPIRED } from "@/lib/messages/errors";
import { startDirectConversation } from "@/lib/messages/queries";
import {
  conversationIdSchema,
  directMessageSchema,
  fieldErrorsOf,
  respondConversationSchema,
  startConversationSchema,
} from "@/lib/messages/schema";
import type {
  DirectMessageState,
  DirectMessageValues,
  MarkReadResult,
  MessagesActionState,
} from "@/lib/messages/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions das mensagens diretas. Cada uma confere a sessão e o perfil no servidor (o proxy
 * é só uma checagem otimista), valida com zod e deixa o RLS + triggers + RPCs do banco garantirem
 * as regras (participantes, pedido de mensagem, ensino médio, anti-spam). Quem envia é sempre a
 * usuária da sessão; os avisos (`direct_message`) são criados por trigger.
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

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function nonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Começa (ou reabre) a conversa com uma pesquisadora e leva até ela. Falhou (perfil incompleto,
 * ensino médio sem conexão, limite do dia…): `{ ok: false, error }` para o botão mostrar.
 */
export async function startConversationAction(
  _prev: MessagesActionState,
  formData: FormData,
): Promise<MessagesActionState> {
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const parsed = startConversationSchema.safeParse({ profile_id: str(formData, "profile_id") });
  if (!parsed.success) {
    return {
      ok: false,
      error: fieldErrorsOf(parsed.error).profile_id?.[0] ?? fallbackMessage("start"),
    };
  }

  const supabase = await createClient();
  const result = await startDirectConversation(supabase, parsed.data.profile_id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(INBOX);
  redirect(conversationHref(result.id));
}

/**
 * Envia uma mensagem. O banco decide se pode (participante — CD085; pedido de mensagem sem
 * resposta ou recusado — CD086, com o mesmo texto: a recusa nunca é revelada; ensino médio —
 * CD084; limite — CD088) e avisa a outra participante. Responder a um pedido recebido aceita o
 * pedido; responder a um pedido recusado reabre a conversa.
 */
export async function sendDirectMessageAction(
  _prev: DirectMessageState,
  formData: FormData,
): Promise<DirectMessageState> {
  const values: DirectMessageValues = { body: str(formData, "body") };
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error, values, nonce: nonce() };

  const parsed = directMessageSchema.safeParse({
    conversation_id: str(formData, "conversation_id"),
    body: values.body,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error: fieldErrors.body?.[0] ?? fieldErrors.conversation_id?.[0] ?? fallbackMessage("send"),
      fieldErrors,
      values,
      nonce: nonce(),
    };
  }
  const { conversation_id: conversationId, body } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("direct_messages")
    .insert({ conversation_id: conversationId, body });
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.warn(`[mensagens] mensagem — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    }
    return { ok: false, error: friendlyMessagesError(error, "send"), values, nonce: nonce() };
  }

  revalidatePath(conversationHref(conversationId));
  revalidatePath(INBOX);
  return { ok: true, message: "Mensagem enviada.", nonce: nonce() };
}

/** Aceita ou recusa um pedido de mensagem recebido (`respond_conversation_request`). */
export async function respondConversationAction(
  _prev: MessagesActionState,
  formData: FormData,
): Promise<MessagesActionState> {
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const parsed = respondConversationSchema.safeParse({
    conversation_id: str(formData, "conversation_id"),
    accept: str(formData, "accept"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error:
        fieldErrors.conversation_id?.[0] ?? fieldErrors.accept?.[0] ?? fallbackMessage("respond"),
    };
  }
  const { conversation_id: conversationId, accept } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_conversation_request", {
    p_conversation_id: conversationId,
    p_accept: accept,
  });
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.warn(
        `[mensagens] responder pedido — ${error.code ?? ""} ${error.message.slice(0, 160)}`,
      );
    }
    return { ok: false, error: friendlyMessagesError(error, "respond") };
  }

  revalidatePath(conversationHref(conversationId));
  // A caixa de entrada (abas e contagem de pedidos) e o selo do cabeçalho mudam.
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: accept
      ? "Pedido aceito. Agora vocês podem conversar."
      : "Pedido recusado. Ela não recebe aviso da recusa.",
  };
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
