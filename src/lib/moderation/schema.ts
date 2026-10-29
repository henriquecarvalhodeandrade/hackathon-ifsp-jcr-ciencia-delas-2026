import { z } from "zod";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { Constants } from "@/lib/database.types";

/** Tipos de conteúdo que podem ser denunciados (enum `report_target`). */
export const REPORT_TARGETS = Constants.public.Enums.report_target;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_DETAILS_MAX = 1000;
/** Com o motivo "Outro", pedimos um mínimo de contexto para a moderação conseguir agir. */
export const REPORT_OTHER_DETAILS_MIN = 10;

const reasons = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

/** Como cada alvo é chamado nas mensagens ("Denunciar este tópico"). */
export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  thread: "este tópico",
  post: "esta resposta",
  paper: "este paper",
  paper_comment: "este comentário",
  profile: "este perfil",
  feed_post: "esta publicação",
  feed_comment: "este comentário",
  opportunity: "esta vaga",
};

export type ReportValues = {
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
};

export const reportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGETS, { error: "Não reconhecemos o conteúdo denunciado." }),
    targetId: z.guid({ error: "Não reconhecemos o conteúdo denunciado." }),
    reason: z.enum(reasons, { error: "Escolha o motivo da denúncia." }),
    details: z
      .string()
      .trim()
      .max(REPORT_DETAILS_MAX, {
        error: `Use no máximo ${REPORT_DETAILS_MAX} caracteres nos detalhes.`,
      }),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "other" && value.details.length < REPORT_OTHER_DETAILS_MIN) {
      ctx.addIssue({
        code: "custom",
        path: ["details"],
        message: "Conte em poucas palavras o que aconteceu (pelo menos 10 caracteres).",
      });
    }
  });

export type ReportInput = z.infer<typeof reportSchema>;

/** Lê os campos do formulário de denúncia (sempre strings, nunca null). */
export function readReportForm(formData: FormData): ReportValues {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    targetType: read("targetType"),
    targetId: read("targetId"),
    reason: read("reason"),
    details: read("details"),
  };
}
