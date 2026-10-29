/**
 * Validação (zod) das Server Actions das mensagens diretas. Mensagens em pt-BR, iguais às da
 * interface. Ids de usuárias NUNCA vêm do formulário para dizer "quem sou eu": só o id da conversa
 * e o perfil com quem conversar, conferidos de novo no banco.
 */
import { z } from "zod";
import { MESSAGE_MAX } from "./conversation";

const id = (message: string) => z.guid({ error: message });

const CONVERSATION_NOT_FOUND =
  "Não encontramos esta conversa. Recarregue a página e tente de novo.";
export const PROFILE_NOT_FOUND =
  "Não encontramos esta pesquisadora. Confira o link ou procure no diretório.";

export const conversationIdSchema = id(CONVERSATION_NOT_FOUND);

/**
 * Mensagem da conversa (o banco confere participante, pedido de mensagem e limite). O navegador
 * envia as quebras de linha do <textarea> como CRLF: viram LF antes de contar os caracteres, para
 * o limite valer igual ao contador do campo.
 */
export const directMessageSchema = z.object({
  conversation_id: conversationIdSchema,
  body: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value),
    z
      .string({ error: "Escreva uma mensagem antes de enviar." })
      .trim()
      .min(1, { error: "Escreva uma mensagem antes de enviar." })
      .max(MESSAGE_MAX, { error: "Use no máximo 2.000 caracteres." }),
  ),
});
export type DirectMessageInput = z.infer<typeof directMessageSchema>;

/** Aceitar ou recusar um pedido de mensagem (botões com `name="accept"`). */
export const respondConversationSchema = z.object({
  conversation_id: conversationIdSchema,
  accept: z
    .enum(["true", "false"], { error: "Escolha aceitar ou recusar o pedido." })
    .transform((value) => value === "true"),
});
export type RespondConversationInput = z.infer<typeof respondConversationSchema>;

/** Começar (ou reabrir) a conversa com uma pesquisadora. */
export const startConversationSchema = z.object({
  profile_id: id(PROFILE_NOT_FOUND),
});

/** Erros por campo (para `aria-invalid` no campo da mensagem). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value;
  }
  return out;
}
