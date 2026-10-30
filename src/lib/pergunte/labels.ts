import { CAREER_STAGES, type CareerStage } from "@/lib/constants";
import { pluralize, truncate } from "@/lib/utils";

/** Etapas de quem pergunta (CHECK de public_questions.stage). */
export const QUESTION_STAGES = ["ensino_medio_tecnico", "graduacao", "outro"] as const;
export type QuestionStage = (typeof QUESTION_STAGES)[number];

export const STAGE_LABELS: Record<QuestionStage, string> = {
  ensino_medio_tecnico: "Ensino médio ou técnico",
  graduacao: "Graduação",
  outro: "Outro",
};

export const STAGE_OPTIONS = QUESTION_STAGES.map((value) => ({
  value,
  label: STAGE_LABELS[value],
}));

export function isQuestionStage(value: unknown): value is QuestionStage {
  return typeof value === "string" && (QUESTION_STAGES as readonly string[]).includes(value);
}

/** Motivos para não publicar (CHECK de public_questions.reject_reason). */
export const REJECT_REASONS = [
  "fora_do_tema",
  "dados_pessoais",
  "conteudo_improprio",
  "duplicada",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export function isRejectReason(value: unknown): value is RejectReason {
  return typeof value === "string" && (REJECT_REASONS as readonly string[]).includes(value);
}

/** Texto acolhedor para quem perguntou (página de acompanhamento). */
export const REJECT_REASON_TEXTS: Record<RejectReason, string> = {
  fora_do_tema: "Esta pergunta não é sobre ciência ou carreira científica.",
  dados_pessoais: "Ela tinha informações que poderiam identificar você. Envie de novo sem elas.",
  conteudo_improprio: "Ela não segue o código de conduta da Artemis.",
  duplicada: "Uma pergunta parecida já foi respondida. Dê uma olhada na lista.",
};

/** Rótulo curto para a moderação (o banco registra o mesmo texto no moderation_audit_log). */
export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  fora_do_tema: "Fora do tema",
  dados_pessoais: "Dados pessoais",
  conteudo_improprio: "Conteúdo impróprio",
  duplicada: "Pergunta duplicada",
};

export const REJECT_REASON_OPTIONS = REJECT_REASONS.map((value) => ({
  value,
  label: REJECT_REASON_LABELS[value],
}));

/** "Sem respostas ainda" · "1 resposta" · "3 respostas". */
export function answerCountLabel(count: number): string {
  if (count <= 0) return "Sem respostas ainda";
  return pluralize(count, "resposta");
}

export interface AnswerIdentity {
  name: string | null;
  stage: CareerStage | null;
  isMentor: boolean | null;
}

/** Quem não quis se identificar aparece assim. */
export const ANONYMOUS_SCIENTIST = "Uma cientista da rede";

/**
 * Linha de identidade da resposta: "<Nome> · Mentora · <etapa>" quando a autora escolheu se
 * identificar; "Uma cientista da rede" quando não.
 */
export function answerIdentityLine({ name, stage, isMentor }: AnswerIdentity): string {
  const clean = name?.trim();
  if (!clean) return ANONYMOUS_SCIENTIST;
  const parts = [clean];
  if (isMentor) parts.push("Mentora");
  if (stage && stage in CAREER_STAGES) parts.push(CAREER_STAGES[stage].label);
  return parts.join(" · ");
}

/** Marca dos dados fictícios do seed (aparece no fim das perguntas de demonstração). */
const DEMO_SUFFIX = /\s*\(pergunta fictícia de demonstração\)\s*$/i;

/** Primeira frase da pergunta (até "?" ou "."), para títulos e metadados. */
export function questionHeadline(body: string, max = 90): string {
  const text = body.replace(DEMO_SUFFIX, "").replace(/\s+/g, " ").trim();
  const match = /^(.{12,}?[?.!])(\s|$)/.exec(text);
  return truncate(match ? match[1]! : text, max);
}

/**
 * Pergunta dividida para cartões: a primeira frase vira o título e o resto, o apoio (a marca de
 * demonstração continua no apoio, para os dados fictícios seguirem identificados).
 */
export function splitQuestion(body: string, max = 160): { headline: string; rest: string } {
  const text = body.replace(/\s+/g, " ").trim();
  const match = /^(.{12,}?[?.!])(\s|$)/.exec(text);
  if (!match) return { headline: truncate(text, max), rest: "" };
  return { headline: truncate(match[1]!, max), rest: text.slice(match[0].length).trim() };
}

/** Trecho da pergunta para listas. */
export function questionExcerpt(body: string, max = 220): string {
  return truncate(body.replace(/\s+/g, " ").trim(), max);
}
