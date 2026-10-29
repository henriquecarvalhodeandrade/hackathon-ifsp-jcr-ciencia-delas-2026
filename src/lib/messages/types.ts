/** Estados devolvidos pelas Server Actions das mensagens diretas (formato do useActionState). */

export type DirectMessageValues = { body: string };

/**
 * Envio de mensagem. `nonce` muda a cada resposta: remonta o campo (com o texto de volta, se deu
 * erro) e avisa o cliente de que houve um envio novo.
 */
export type DirectMessageState =
  | { ok: true; message: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: DirectMessageValues;
      nonce: string;
    }
  | null;

/** Aceitar/recusar pedido e começar conversa (no sucesso, a página muda ou redireciona). */
export type MessagesActionState =
  { ok: true; message: string } | { ok: false; error: string } | null;

export type MarkReadResult = { ok: true } | { ok: false; error: string };
