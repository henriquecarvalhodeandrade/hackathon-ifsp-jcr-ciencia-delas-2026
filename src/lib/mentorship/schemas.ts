/**
 * Validação (zod) das Server Actions da mentoria. Mensagens em pt-BR, iguais às da interface.
 * Ids de usuárias NUNCA vêm do formulário: só ids de pedidos/mentoras, conferidos no servidor.
 */
import { z } from "zod";
import { REQUEST_MESSAGE_MAX, REQUEST_MESSAGE_MIN, RESPONSE_MESSAGE_MAX } from "./presentation";

const id = (message: string) => z.guid({ error: message });

/** Trechos do rascunho padrão que precisam ser trocados pelo contexto da mentoranda. */
const PLACEHOLDER = /\[(conte rapidamente|o que você busca)[^\]]*\]/i;

export const requestSchema = z.object({
  mentor_id: id("Não encontramos essa mentora. Recarregue a página e tente de novo."),
  message: z
    .string({ error: "Escreva uma mensagem para a mentora." })
    .trim()
    .min(REQUEST_MESSAGE_MIN, {
      error: `Escreva pelo menos ${REQUEST_MESSAGE_MIN} caracteres: conte quem você é e como ela pode ajudar.`,
    })
    .max(REQUEST_MESSAGE_MAX, { error: "Use no máximo 1.500 caracteres." })
    .refine((text) => !PLACEHOLDER.test(text), {
      error: "Troque os trechos entre colchetes pelo seu contexto antes de enviar.",
    }),
});
export type RequestInput = z.infer<typeof requestSchema>;

export const requestIdSchema = z.object({
  request_id: id("Não encontramos esse pedido. Recarregue a página e tente de novo."),
});

export const respondSchema = z.object({
  request_id: id("Não encontramos esse pedido. Recarregue a página e tente de novo."),
  decision: z.enum(["accepted", "declined"], { error: "Escolha aceitar ou recusar o pedido." }),
  response_message: z
    .string()
    .trim()
    .max(RESPONSE_MESSAGE_MAX, { error: "Use no máximo 1.000 caracteres." })
    .transform((text) => (text ? text : null)),
});
export type RespondInput = z.infer<typeof respondSchema>;

export const availabilitySchema = z.object({
  available: z
    .enum(["true", "false"], { error: "Escolha se quer receber novos pedidos." })
    .transform((v) => v === "true"),
});

export const consentSchema = z.object({
  ai_consent: z.literal("on", {
    error: "Para ativar as sugestões com IA, marque a caixa confirmando que você leu e concorda.",
  }),
});

/** Primeiro erro de cada campo, no formato aceito pelo <Field error>. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value;
  }
  return out;
}
