/** Resultados das Server Actions das mensagens diretas (chamadas direto do cliente). */

/** Enviar, aceitar/recusar pedido. (A primeira mensagem de um rascunho redireciona no sucesso.) */
export type SendResult = { ok: true } | { ok: false; error: string };

export type MarkReadResult = { ok: true } | { ok: false; error: string };

/** Selos do cabeçalho: conversas com mensagem nova e avisos não lidos do sino. */
export interface HeaderCounts {
  messages: number;
  notifications: number;
}
