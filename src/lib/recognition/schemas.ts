/**
 * Validação (zod) das Server Actions do reconhecimento. Mensagens em pt-BR, iguais às da
 * interface. Ids de usuárias NUNCA vêm do formulário: só ids de pedidos/declarações, e o banco
 * confere participante, status e autoria (CD030–CD037).
 */
import { z } from "zod";
import { MAX_OUTCOMES, isKnownOutcome } from "./outcomes";

export const NOTE_MAX = 500;
export const REVOKE_REASON_MAX = 300;

const id = (message: string) => z.guid({ error: message });

const requestId = id("Não encontramos esta mentoria. Recarregue a página e tente de novo.");
const declarationId = id("Não encontramos esta declaração. Recarregue a página e tente de novo.");

/** Texto livre do navegador: CRLF → LF antes de contar, sem espaços nas pontas; vazio → null. */
const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : value),
    z
      .string()
      .max(max, { error: message })
      .optional()
      .transform((text) => (text ? text : null)),
  );

export const WOULD_RECOMMEND_OPTIONS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "prefiro-nao-dizer", label: "Prefiro não dizer" },
] as const;

export const feedbackSchema = z.object({
  request_id: requestId,
  helpfulness: z
    .enum(["1", "2", "3", "4", "5"], { error: "Escolha de 1 a 5 quanto a mentoria ajudou você." })
    .transform(Number),
  outcomes: z
    .array(z.string())
    .max(MAX_OUTCOMES, { error: `Marque no máximo ${MAX_OUTCOMES} opções.` })
    .refine((items) => items.every(isKnownOutcome), {
      error: "Uma das opções escolhidas não existe mais. Recarregue a página.",
    })
    .transform((items) => [...new Set(items)]),
  would_recommend: z
    .enum(["sim", "nao", "prefiro-nao-dizer", ""], { error: "Escolha uma das opções." })
    .optional()
    .transform((value) => (value === "sim" ? true : value === "nao" ? false : null)),
  note: optionalText(NOTE_MAX, `Use no máximo ${NOTE_MAX} caracteres.`),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** Para onde voltar depois da ação (lista de valores conhecidos, nunca uma URL do formulário). */
export const returnToSchema = z.enum(["ativas", "concluida"]).catch("ativas");
export type ReturnTo = z.infer<typeof returnToSchema>;

const consent = z.literal("on", {
  error: "Para continuar, autorize que seu nome apareça na declaração e na página de verificação.",
});

export const declarationRequestSchema = z.object({
  request_id: requestId,
  consent,
});

export const declarationConsentSchema = z.object({
  request_id: requestId,
  declaration_id: declarationId,
  consent,
});

export const declarationRevokeSchema = z.object({
  request_id: requestId,
  declaration_id: declarationId,
  reason: optionalText(REVOKE_REASON_MAX, `Use no máximo ${REVOKE_REASON_MAX} caracteres.`),
});

export const feedbackDeleteSchema = z.object({ request_id: requestId });

/** Primeiro erro de cada campo, no formato aceito pelo <Field error>. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value;
  }
  return out;
}
