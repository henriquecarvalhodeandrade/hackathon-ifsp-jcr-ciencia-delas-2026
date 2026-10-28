import { z } from "zod";
import { formatNumber } from "@/lib/utils";
import { QUESTION_STAGES, REJECT_REASONS } from "./labels";
import { ANSWER_PII_MESSAGE, detectPersonalData, QUESTION_PII_MESSAGE } from "./pii";

/** Limites espelhados dos CHECKs de supabase/migrations/20261028190100_public_questions.sql. */
export const QUESTION_LIMITS = { min: 30, max: 800 } as const;
export const ANSWER_LIMITS = { min: 20, max: 3000 } as const;
export const HIDE_REASON_MAX = 500;

/** Mensagem do banco (CD042) para o tamanho da pergunta. */
export const QUESTION_LENGTH_MESSAGE = `Sua pergunta precisa ter entre ${QUESTION_LIMITS.min} e ${formatNumber(QUESTION_LIMITS.max)} caracteres.`;
export const ANSWER_LENGTH_MESSAGE = `Sua resposta precisa ter entre ${ANSWER_LIMITS.min} e ${formatNumber(ANSWER_LIMITS.max)} caracteres.`;

/** Tamanho como o Postgres conta (char_length: pontos de código, não unidades UTF-16). */
export function charLength(text: string): number {
  return Array.from(text).length;
}

function within(text: string, { min, max }: { min: number; max: number }): boolean {
  const n = charLength(text);
  return n >= min && n <= max;
}

const idSchema = z.guid({ error: "Não encontramos esta pergunta." });

/** "" (opção vazia do select) vira undefined. */
const emptyToUndefined = (value: unknown) => (value === "" || value == null ? undefined : value);

export const questionSchema = z.object({
  body: z
    .string()
    .trim()
    .refine((value) => within(value, QUESTION_LIMITS), { error: QUESTION_LENGTH_MESSAGE })
    .refine((value) => detectPersonalData(value).length === 0, { error: QUESTION_PII_MESSAGE }),
  stage: z.preprocess(
    emptyToUndefined,
    z.enum(QUESTION_STAGES, { error: "Escolha uma etapa da lista." }).optional(),
  ),
  areaId: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Escolha uma das grandes áreas da lista." })
      .int({ error: "Escolha uma das grandes áreas da lista." })
      .min(1, { error: "Escolha uma das grandes áreas da lista." })
      .max(32767, { error: "Escolha uma das grandes áreas da lista." })
      .optional(),
  ),
});

export type QuestionInput = z.infer<typeof questionSchema>;

/** Valores do formulário de pergunta (devolvidos para o React 19 não perder o texto). */
export type QuestionFormValues = { body: string; stage: string; areaId: string };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readQuestionForm(formData: FormData): QuestionFormValues {
  return {
    body: readString(formData, "body"),
    stage: readString(formData, "stage"),
    areaId: readString(formData, "areaId"),
  };
}

/** Checkbox nativo envia "on" quando marcado. */
export function isChecked(value: FormDataEntryValue | null | undefined): boolean {
  return value === "on" || value === "true" || value === "1";
}

export const answerSchema = z.object({
  questionId: idSchema,
  body: z
    .string()
    .trim()
    .refine((value) => within(value, ANSWER_LIMITS), { error: ANSWER_LENGTH_MESSAGE })
    .refine((value) => detectPersonalData(value, { allowLinks: true }).length === 0, {
      error: ANSWER_PII_MESSAGE,
    }),
  showIdentity: z.boolean(),
});

export type AnswerFormValues = { body: string; showIdentity: boolean };

export function readAnswerForm(formData: FormData): AnswerFormValues & { questionId: string } {
  return {
    questionId: readString(formData, "questionId"),
    body: readString(formData, "body"),
    showIdentity: isChecked(formData.get("showIdentity")),
  };
}

export const deleteAnswerSchema = z.object({
  answerId: z.guid({ error: "Não encontramos esta resposta." }),
  questionId: idSchema,
});

export const reviewSchema = z
  .object({
    questionId: idSchema,
    decision: z.enum(["publish", "reject"], { error: "Escolha publicar ou não publicar." }),
    reason: z.preprocess(
      emptyToUndefined,
      z.enum(REJECT_REASONS, { error: "Escolha um motivo da lista." }).optional(),
    ),
  })
  .refine((value) => value.decision === "publish" || value.reason !== undefined, {
    error: "Escolha o motivo para não publicar a pergunta.",
    path: ["reason"],
  });

/** Limites do motivo de remoção (mesmos de public.remove_public_question). */
export const REMOVE_REASON_LIMITS = { min: 10, max: 500 } as const;
const REMOVE_REASON_MESSAGE = `Explique o motivo da remoção com ${REMOVE_REASON_LIMITS.min} a ${REMOVE_REASON_LIMITS.max} caracteres: ele fica no registro da moderação.`;

export const removeQuestionSchema = z.object({
  questionId: idSchema,
  reason: z
    .string()
    .trim()
    .refine((value) => within(value, REMOVE_REASON_LIMITS), { error: REMOVE_REASON_MESSAGE }),
});

export const hideAnswerSchema = z.object({
  answerId: z.guid({ error: "Não encontramos esta resposta." }),
  hidden: z.boolean(),
  reason: z
    .string()
    .trim()
    .max(HIDE_REASON_MAX, { error: `Use no máximo ${HIDE_REASON_MAX} caracteres no motivo.` })
    .optional(),
});

export { readString as readFormString };
