"use client";

import { INBOX_REFRESH_MS } from "@/lib/messages/conversation";
import { useLiveRefresh } from "./use-live-refresh";

/**
 * Caixa de entrada ao vivo: qualquer mudança nas minhas conversas (nova, mensagem nova, pedido
 * aceito — o RLS do Realtime só entrega as minhas) atualiza a lista; sem o Realtime, atualiza a
 * cada 30 s com a aba visível. Não desenha nada.
 */
export function InboxLive() {
  useLiveRefresh({
    channel: "caixa-de-entrada",
    tables: [{ table: "direct_conversations", event: "*" }],
    pollMs: INBOX_REFRESH_MS,
    subscribedPollMs: INBOX_REFRESH_MS,
  });
  return null;
}
