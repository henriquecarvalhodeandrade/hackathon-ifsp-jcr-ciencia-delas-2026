import { CAREER_STAGES, MENTORSHIP_TOPICS, type CareerStage } from "@/lib/constants";
import { DOCUMENT_PREFIX, QUERY_PREFIX, formatEmbeddingInput } from "@/lib/ai/embedding-input";
import { usesTaskType } from "@/lib/ai/providers/gemini";
import type { EmbeddingKind } from "@/lib/ai/providers/types";
import { redactPersonalData } from "@/lib/ai/text";

/**
 * Texto de PESQUISA de um perfil, usado para gerar o embedding do matching.
 * Contém só informação acadêmica (etapa, áreas, palavras-chave, temas, objetivos/oferta,
 * frase de apresentação) — NUNCA nome, e-mail, instituição, cidade ou links.
 * Textos livres passam por `redactPersonalData` (remove e-mails, links, telefones e o
 * próprio nome, caso a pessoa o tenha escrito). Módulo puro.
 */

export { DOCUMENT_PREFIX, QUERY_PREFIX };

export interface ProfileTextInput {
  /** Usado apenas para apagar o nome caso apareça nos textos livres. Nunca entra no texto. */
  full_name?: string | null;
  headline?: string | null;
  career_stage?: CareerStage | string | null;
  keywords?: string[] | null;
  mentorship_topics?: string[] | null;
  mentoring_goals?: string | null;
  mentoring_offer?: string | null;
  is_mentor?: boolean | null;
}

export type MatchingRole = "mentor" | "mentee";

/** Mentoras são "documentos" (o que é buscado); mentorandas são "consultas" (quem busca). */
export function embeddingKindFor(profile: Pick<ProfileTextInput, "is_mentor">): EmbeddingKind {
  return profile.is_mentor ? "document" : "query";
}

export function careerStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return CAREER_STAGES[stage as CareerStage]?.label ?? null;
}

export function topicLabel(slug: string): string {
  return (MENTORSHIP_TOPICS as Record<string, string>)[slug] ?? slug.replace(/-/g, " ");
}

function cleanList(values: string[] | null | undefined, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const v = raw.replace(/\s+/g, " ").trim();
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function buildProfileText(
  profile: ProfileTextInput,
  areaNames: string[],
  options: { role?: MatchingRole } = {},
): string {
  const role: MatchingRole = options.role ?? (profile.is_mentor ? "mentor" : "mentee");
  const names = profile.full_name ? [profile.full_name] : [];
  const redact = (text: string) => redactPersonalData(text, { names });

  const lines: string[] = [];
  const stage = careerStageLabel(profile.career_stage);
  if (stage) lines.push(`Etapa da carreira: ${stage}.`);

  const areas = cleanList(areaNames, 10);
  if (areas.length) lines.push(`Áreas de pesquisa: ${areas.join("; ")}.`);

  const keywords = cleanList(profile.keywords, 15).map(redact).filter(Boolean);
  if (keywords.length) lines.push(`Palavras-chave: ${keywords.join(", ")}.`);

  const topics = cleanList(profile.mentorship_topics, 15).map(topicLabel);
  if (topics.length) lines.push(`Temas de mentoria: ${topics.join("; ")}.`);

  const headline = profile.headline?.trim();
  if (headline) lines.push(`Apresentação: ${redact(headline)}`);

  if (role === "mentee") {
    const goals = profile.mentoring_goals?.trim();
    if (goals) lines.push(`O que busca na mentoria: ${redact(goals)}`);
  } else {
    const offer = profile.mentoring_offer?.trim();
    if (offer) lines.push(`Como pode ajudar como mentora: ${redact(offer)}`);
  }

  return lines.join("\n");
}

/** Texto exatamente como será enviado ao modelo de embeddings (com o prefixo da tarefa). */
export function embeddingInputFor(text: string, kind: EmbeddingKind, model: string): string {
  return formatEmbeddingInput(text, kind, { usePrefix: !usesTaskType(model) });
}

/** SHA-256 em hexadecimal (Web Crypto — funciona no Node 20+ e no navegador). */
export async function contentHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash usado em `profile_embeddings.content_hash`: muda quando o texto, o tipo
 * (documento/consulta) ou o modelo mudam — e só então o embedding é recalculado.
 */
export async function profileEmbeddingHash(
  text: string,
  kind: EmbeddingKind,
  model: string,
): Promise<string> {
  return contentHash(`${model}\n${embeddingInputFor(text, kind, model)}`);
}
