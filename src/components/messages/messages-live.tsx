"use client";

import { useParams } from "next/navigation";
import {
  CONVERSATION_REFRESH_MS,
  CONVERSATION_REFRESH_SUBSCRIBED_MS,
  INBOX_REFRESH_MS,
} from "@/lib/messages/conversation";
import { useLiveRefresh, type LiveTable } from "./use-live-refresh";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mensagens ao vivo — um canal só para a área toda (montado pelo layout de /mensagens, então a
 * lista lateral e a conversa aberta se atualizam juntas, com um único pedido por rajada):
 *  - qualquer mudança nas minhas conversas (nova, mensagem nova, aceite, leitura da outra pessoa —
 *    o RLS do Realtime só entrega as minhas);
 *  - com uma conversa aberta, também as mensagens novas dela (INSERT em `direct_messages`), e a
 *    atualização periódica de reserva fica mais curta (5 s sem o Realtime, 20 s com ele).
 * Não desenha nada.
 */
export function MessagesLive() {
  const params = useParams<{ id?: string }>();
  const openId = typeof params.id === "string" && UUID.test(params.id) ? params.id : null;
  const tables: LiveTable[] = [{ table: "direct_conversations", event: "*" }];
  if (openId) {
    tables.push({
      table: "direct_messages",
      event: "INSERT",
      match: { column: "conversation_id", value: openId },
    });
  }
  useLiveRefresh({
    channel: openId ? `conversa-${openId}` : "caixa-de-entrada",
    tables,
    pollMs: openId ? CONVERSATION_REFRESH_MS : INBOX_REFRESH_MS,
    subscribedPollMs: openId ? CONVERSATION_REFRESH_SUBSCRIBED_MS : INBOX_REFRESH_MS,
  });
  return null;
}
