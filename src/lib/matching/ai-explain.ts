import "server-only";
import { generateJson, isAiEnabled } from "@/lib/ai";
import { rejectUnaccentedText } from "@/lib/ai/text";
import {
  EXPLAIN_SYSTEM,
  MAX_AI_CANDIDATES,
  buildExplainPrompt,
  buildMenteePayload,
  explainResponseSchema,
  heuristicExplanation,
  mergeAiExplanations,
  pseudonymizeCandidates,
} from "./pseudonymize";
import type {
  AreaLookup,
  ExplainedMatch,
  MenteeForMatching,
  MentorCandidate,
  RankedMentor,
  SuggestionSource,
} from "./types";

export interface ExplainOptions {
  areas?: AreaLookup;
  /** mentor_id → mentora consentiu com IA? Sem consentimento, só taxonomia vai ao modelo. */
  consentByMentorId?: ReadonlyMap<string, boolean>;
  /** Quantas candidatas enviar ao modelo (máx. 8). */
  maxCandidates?: number;
}

export interface ExplainResult<C extends MentorCandidate = MentorCandidate> {
  matches: ExplainedMatch<C>[];
  source: SuggestionSource;
  provider: string | null;
  model: string | null;
  /** Mensagem pt-BR quando a IA falhou e caímos na heurística. */
  warning?: string;
}

/**
 * Re-rank + explicação por IA das melhores candidatas (top N ≤ 8) da heurística.
 * Nunca lança: qualquer falha (sem chave, 429, JSON inválido, timeout...) devolve a
 * explicação heurística, com `source: "heuristic"`.
 */
export async function explainMatchesWithAi<C extends MentorCandidate>(
  mentee: MenteeForMatching,
  ranked: readonly RankedMentor<C>[],
  options: ExplainOptions = {},
): Promise<ExplainResult<C>> {
  const limit = Math.max(
    1,
    Math.min(MAX_AI_CANDIDATES, options.maxCandidates ?? MAX_AI_CANDIDATES),
  );
  const top = ranked.slice(0, limit);
  const heuristic = (): ExplainedMatch<C>[] =>
    top.map((r) => heuristicExplanation(mentee, r, options.areas));

  if (top.length === 0) return { matches: [], source: "heuristic", provider: null, model: null };
  if (!isAiEnabled())
    return { matches: heuristic(), source: "heuristic", provider: null, model: null };

  try {
    const menteePayload = buildMenteePayload(mentee, options.areas);
    const { payload, idMap } = pseudonymizeCandidates(top, {
      areas: options.areas,
      consentByMentorId: options.consentByMentorId,
    });

    const prompt = buildExplainPrompt(menteePayload, payload);
    const { data, provider, model } = await generateJson({
      system: EXPLAIN_SYSTEM,
      prompt,
      schema: explainResponseSchema,
      schemaName: "sugestoes_mentoria",
      temperature: 0.4,
      maxOutputTokens: 3072,
      // O flash-lite às vezes tira os acentos ("voce", "nao"): reprova e tenta de novo.
      validate: (d) =>
        rejectUnaccentedText(
          d.ranking.flatMap((r) => [r.reason, ...r.starters]),
          { allowWordsFrom: prompt },
        ),
    });

    const matches = mergeAiExplanations(mentee, top, data, idMap, options.areas);
    const anyAi = matches.some((m) => m.source === "ai");
    return {
      matches,
      source: anyAi ? "ai" : "heuristic",
      provider: anyAi ? provider : null,
      model: anyAi ? model : null,
      ...(anyAi
        ? {}
        : {
            warning:
              "A IA não trouxe explicações válidas; mostramos as sugestões calculadas por regras.",
          }),
    };
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "erro desconhecido";
    console.warn(`[matching] explicação por IA indisponível — ${detail.slice(0, 300)}`);
    return {
      matches: heuristic(),
      source: "heuristic",
      provider: null,
      model: null,
      warning: "A IA está indisponível no momento; mostramos as sugestões calculadas por regras.",
    };
  }
}
