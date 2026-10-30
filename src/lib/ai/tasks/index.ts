import "server-only";
import { generateJson, isAiEnabled } from "../index";
import { rejectUnaccentedText } from "../text";
import {
  EDITION_INTRO_SYSTEM,
  PLAIN_SUMMARY_SYSTEM,
  buildEditionIntroPrompt,
  buildPlainSummaryPrompt,
  editionIntroSchema,
  finalizeEditionIntro,
  finalizePlainSummary,
  plainSummarySchema,
  type EditionContent,
  type PlainSummaryInput,
} from "./prompts";

export type { EditionContent, PlainSummaryInput } from "./prompts";
export { EDITION_INTRO_MAX_CHARS, PLAIN_SUMMARY_MAX_CHARS } from "./prompts";

function warn(task: string, error: unknown) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : "erro desconhecido";
  console.warn(`[ai] ${task} indisponível — ${detail.slice(0, 300)}`);
}

/**
 * Resumo em linguagem simples (pt-BR, ≤ 900 caracteres) para a Vitrine de papers.
 * Retorna null quando a IA está desligada ou falha — a UI então mostra só o abstract.
 */
export async function generatePlainSummary(paper: PlainSummaryInput): Promise<string | null> {
  if (!isAiEnabled()) return null;
  if (!paper.title?.trim() || !paper.abstract?.trim()) return null;
  try {
    const prompt = buildPlainSummaryPrompt(paper);
    const { data } = await generateJson({
      system: PLAIN_SUMMARY_SYSTEM,
      prompt,
      schema: plainSummarySchema,
      schemaName: "resumo_simples",
      temperature: 0.3,
      maxOutputTokens: 1024,
      validate: (d) => rejectUnaccentedText(d.summary, { allowWordsFrom: prompt }),
    });
    return finalizePlainSummary(data.summary);
  } catch (error) {
    warn("resumo em linguagem simples", error);
    return null;
  }
}

/**
 * Abertura editorial curta (pt-BR, ≤ 600 caracteres) da edição semanal da newsletter.
 * Retorna null quando a IA está desligada ou falha — use um texto padrão nesse caso.
 */
export async function generateEditionIntro(content: EditionContent): Promise<string | null> {
  if (!isAiEnabled()) return null;
  try {
    const prompt = buildEditionIntroPrompt(content);
    const { data } = await generateJson({
      system: EDITION_INTRO_SYSTEM,
      prompt,
      schema: editionIntroSchema,
      schemaName: "abertura_newsletter",
      temperature: 0.7,
      maxOutputTokens: 768,
      validate: (d) => rejectUnaccentedText(d.intro, { allowWordsFrom: prompt }),
    });
    return finalizeEditionIntro(data.intro);
  } catch (error) {
    warn("abertura da newsletter", error);
    return null;
  }
}
