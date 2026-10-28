import {
  BR_STATES,
  CAREER_STAGES,
  LANGUAGES,
  MEETING_FORMATS,
  type CareerStage,
} from "@/lib/constants";
import {
  normalizeTrajectoryTags,
  sharedTrajectory,
  sharedTrajectorySentence,
} from "@/lib/trajectory/catalog";
import { careerStageLabel, topicLabel } from "./profile-text";
import type {
  AreaLookup,
  MatchBreakdown,
  MatchComponent,
  MenteeForMatching,
  MentorCandidate,
  RankedMentor,
} from "./types";

/**
 * Ranking HEURÍSTICO de mentoras (puro e determinístico). Pontuação 0..100 = média ponderada
 * dos componentes que se aplicam, com estes PESOS RELATIVOS:
 *
 *   0,35  áreas de pesquisa em comum
 *   0,30  similaridade semântica dos perfis (embeddings; se ausente, o peso é redistribuído)
 *   0,15  temas de mentoria + palavras-chave em comum
 *   0,10  diferença de senioridade adequada (mentora mais sênior; ideal de 1 a 3 etapas)
 *   0,10  compatibilidade prática (formato, idioma, mesmo estado, vagas abertas)
 *   0,10  afinidade de trajetória — SÓ quando as duas declararam marcas e têm alguma em comum
 *
 * Componentes que não se aplicam (ex.: sem embedding, mentoranda sem temas, nenhuma marca de
 * trajetória em comum) valem `null` e seus pesos são redistribuídos proporcionalmente entre os
 * demais — sem marcas, a conta é exatamente a de antes (os cinco primeiros pesos somam 1).
 *
 * Trajetória (docs/17): o componente vale 1 e o peso é 0,10 × cobertura, com
 * cobertura = min(1, marcas em comum ÷ min(marcas da mentoranda, 2)). Somar um componente
 * que vale 1 a uma média nunca a diminui: a afinidade só pode SUBIR a nota, e quem não
 * declarou nada (ou declarou outras marcas) fica exatamente com a nota que teria sem ela.
 * Empates: pontuação exata desc e depois `mentor_id` asc.
 */

export const MATCH_WEIGHTS: Readonly<Record<MatchComponent, number>> = {
  areas: 0.35,
  similarity: 0.3,
  topics: 0.15,
  seniority: 0.1,
  compatibility: 0.1,
  trajectory: 0.1,
};

/** Marcas em comum que já valem o peso inteiro da afinidade de trajetória. */
export const TRAJECTORY_SATURATION = 2;

/** Faixa típica de cosseno entre perfis no gemini-embedding-2 (ajuste com dados reais). */
export const SIMILARITY_FLOOR = 0.5;
export const SIMILARITY_CEIL = 0.9;

/** A cobertura de áreas/temas/palavras satura em 3 itens em comum. */
const SATURATION = 3;

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

export function normalizeTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(values: Iterable<T>): T[] {
  return Array.from(new Set(values));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function seniorityOf(stage: string | null | undefined): number | null {
  if (!stage) return null;
  return CAREER_STAGES[stage as CareerStage]?.seniority ?? null;
}

/** Termos que, citados no texto livre, indicam um tema de mentoria (texto já normalizado). */
const TOPIC_HINTS: Record<string, string[]> = {
  "carreira-academica": ["carreira academica", "concurso", "docencia"],
  "bolsas-editais": [
    "bolsa",
    "bolsas",
    "edital",
    "editais",
    "fapesp",
    "capes",
    "cnpq",
    "financiamento",
  ],
  "escrita-cientifica": [
    "escrita",
    "artigo",
    "artigos",
    "publicacao",
    "publicar",
    "revisao por pares",
  ],
  "pos-graduacao": ["pos-graduacao", "pos graduacao", "processo seletivo"],
  internacionalizacao: ["intercambio", "exterior", "internacional", "sanduiche"],
  "maternidade-ciencia": ["maternidade", "filhos", "gestacao"],
  lideranca: ["lideranca", "gestao de equipe", "gestao de equipes", "liderar"],
  "industria-inovacao": ["industria", "inovacao", "mercado de trabalho", "empresa"],
  empreendedorismo: ["empreendedorismo", "startup", "startups", "spin-off"],
  "saude-mental": ["saude mental", "ansiedade", "burnout", "equilibrio"],
  "divulgacao-cientifica": ["divulgacao", "comunicacao cientifica"],
  "programacao-dados": [
    "programacao",
    "python",
    "estatistica",
    "ciencia de dados",
    "analise de dados",
  ],
  metodologia: ["metodologia", "desenho experimental", "metodos de pesquisa"],
  oratoria: ["oratoria", "apresentacoes", "falar em publico", "palestra"],
  networking: ["networking", "congresso", "congressos", "conferencia", "eventos"],
};

function containsTerm(haystack: string, term: string): boolean {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(haystack);
}

/** Temas de mentoria inferidos de um texto livre (objetivos da mentoranda ou oferta da mentora). */
export function inferTopicsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const normalized = normalizeTerm(text);
  return Object.entries(TOPIC_HINTS)
    .filter(([, hints]) => hints.some((h) => containsTerm(normalized, h)))
    .map(([slug]) => slug);
}

function keywordMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a));
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

function scoreAreas(
  menteeAreas: number[],
  mentorAreas: number[],
  areas: AreaLookup | undefined,
): { score: number | null; shared: number[]; sameBigArea: boolean } {
  const mentee = uniq(menteeAreas);
  if (mentee.length === 0) return { score: null, shared: [], sameBigArea: false };
  const mentorSet = new Set(mentorAreas);
  const shared = mentee.filter((id) => mentorSet.has(id)).sort((a, b) => a - b);

  let sameBigArea = false;
  if (areas) {
    const menteeBig = new Set(mentee.map((id) => areas.get(id)?.big_area).filter(Boolean));
    sameBigArea = mentorAreas.some((id) => {
      const big = areas.get(id)?.big_area;
      return Boolean(big && menteeBig.has(big));
    });
  }

  if (shared.length > 0) {
    // Raiz quadrada: a 1ª área em comum já pesa bastante; as seguintes somam menos.
    return {
      score: clamp01(Math.sqrt(shared.length / Math.min(mentee.length, SATURATION))),
      shared,
      sameBigArea,
    };
  }
  return { score: sameBigArea ? 0.3 : 0, shared, sameBigArea };
}

export function scoreSimilarity(similarity: number | null | undefined): number | null {
  if (similarity === null || similarity === undefined || !Number.isFinite(similarity)) return null;
  return clamp01((similarity - SIMILARITY_FLOOR) / (SIMILARITY_CEIL - SIMILARITY_FLOOR));
}

function scoreTopicsAndKeywords(
  mentee: MenteeForMatching,
  candidate: MentorCandidate,
): { score: number | null; sharedTopics: string[]; sharedKeywords: string[] } {
  const explicitMenteeTopics = uniq(mentee.mentorship_topics ?? []);
  const menteeTopics = uniq([
    ...explicitMenteeTopics,
    ...inferTopicsFromText(mentee.mentoring_goals),
  ]);
  const mentorTopics = new Set([
    ...(candidate.mentorship_topics ?? []),
    ...inferTopicsFromText(candidate.mentoring_offer),
  ]);
  // Temas explícitos primeiro (são os que aparecem nos motivos).
  const sharedTopics = uniq([
    ...explicitMenteeTopics.filter((t) => mentorTopics.has(t)),
    ...menteeTopics.filter((t) => mentorTopics.has(t)),
  ]);
  const topicScore =
    menteeTopics.length === 0
      ? null
      : clamp01(sharedTopics.length / Math.min(menteeTopics.length, SATURATION));

  const menteeKeywords = uniq((mentee.keywords ?? []).map(normalizeTerm).filter(Boolean));
  const mentorKeywords = uniq((candidate.keywords ?? []).map(normalizeTerm).filter(Boolean));
  const mentorText = normalizeTerm(
    `${candidate.mentoring_offer ?? ""} ${candidate.headline ?? ""}`,
  );
  const sharedKeywords: string[] = [];
  for (const original of mentee.keywords ?? []) {
    const k = normalizeTerm(original);
    if (!k || sharedKeywords.some((s) => normalizeTerm(s) === k)) continue;
    const inKeywords = mentorKeywords.some((m) => keywordMatches(k, m));
    const inText = k.length >= 4 && containsTerm(mentorText, k);
    if (inKeywords || inText) sharedKeywords.push(original.trim());
  }
  const keywordScore =
    menteeKeywords.length === 0
      ? null
      : clamp01(sharedKeywords.length / Math.min(menteeKeywords.length, SATURATION));

  let score: number | null;
  if (topicScore !== null && keywordScore !== null) score = 0.6 * topicScore + 0.4 * keywordScore;
  else score = topicScore ?? keywordScore;

  return { score, sharedTopics, sharedKeywords };
}

/** Mentora precisa estar à frente; diferença ideal de 1 a 3 etapas. */
export function scoreSeniorityGap(gap: number | null): number | null {
  if (gap === null) return null;
  if (gap <= 0) return 0;
  if (gap <= 3) return 1;
  if (gap === 4) return 0.6;
  return 0.4;
}

function formatsOverlap(a: string[], b: string[]): string[] {
  const direct = a.filter((f) => b.includes(f));
  if (direct.length) return uniq(direct);
  // Híbrido é compatível com qualquer formato.
  if (a.includes("hybrid") || b.includes("hybrid")) return ["hybrid"];
  return [];
}

function scoreCompatibility(
  mentee: MenteeForMatching,
  candidate: MentorCandidate,
): { score: number; formatOverlap: string[]; languageOverlap: string[]; sameState: boolean } {
  const menteeFormats = mentee.meeting_formats?.length ? mentee.meeting_formats : ["online"];
  const mentorFormats = candidate.meeting_formats?.length ? candidate.meeting_formats : ["online"];
  const formatOverlap = formatsOverlap(menteeFormats, mentorFormats);

  const menteeLangs = (mentee.languages?.length ? mentee.languages : ["pt"]).map((l) =>
    l.toLowerCase(),
  );
  const mentorLangs = (candidate.languages?.length ? candidate.languages : ["pt"]).map((l) =>
    l.toLowerCase(),
  );
  const languageOverlap = uniq(menteeLangs.filter((l) => mentorLangs.includes(l)));

  const sameState = Boolean(
    mentee.state &&
    candidate.state &&
    mentee.state.trim().toUpperCase() === candidate.state.trim().toUpperCase(),
  );

  const slots =
    candidate.open_slots === null || candidate.open_slots === undefined
      ? 0.5
      : clamp01(Math.max(0, candidate.open_slots) / SATURATION);

  const score =
    0.35 * (formatOverlap.length ? 1 : 0) +
    0.35 * (languageOverlap.length ? 1 : 0) +
    0.15 * (sameState ? 1 : 0) +
    0.15 * slots;

  return { score: clamp01(score), formatOverlap, languageOverlap, sameState };
}

/**
 * Afinidade de trajetória: marcas que as DUAS declararam. Sem marca em comum (inclusive quando
 * uma delas não declarou nada) → `coverage` 0 e o componente fica null: ninguém é penalizada
 * por não declarar, nem por ter um caminho diferente.
 */
export function scoreTrajectory(
  menteeTags: readonly string[] | null | undefined,
  mentorTags: readonly string[] | null | undefined,
): { shared: string[]; coverage: number } {
  const shared = sharedTrajectory(menteeTags, mentorTags);
  if (shared.length === 0) return { shared, coverage: 0 };
  const declared = normalizeTrajectoryTags(menteeTags).length;
  return {
    shared,
    coverage: clamp01(shared.length / Math.min(declared, TRAJECTORY_SATURATION)),
  };
}

function isApplicable(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

/**
 * Redistribui proporcionalmente os pesos dos componentes `null` (ou ausentes) entre os
 * aplicáveis. O resultado soma 1 entre os componentes aplicáveis.
 */
export function effectiveWeights(
  components: Readonly<Partial<Record<MatchComponent, number | null>>>,
  base: Readonly<Record<MatchComponent, number>> = MATCH_WEIGHTS,
): Record<MatchComponent, number> {
  const keys = Object.keys(base) as MatchComponent[];
  const applicable = keys.filter((k) => isApplicable(components[k]));
  const total = applicable.reduce((sum, k) => sum + base[k], 0);
  const out = {} as Record<MatchComponent, number>;
  for (const k of keys) out[k] = total > 0 && isApplicable(components[k]) ? base[k] / total : 0;
  return out;
}

function weightedScore(
  components: Readonly<Record<MatchComponent, number | null>>,
  weights: Readonly<Record<MatchComponent, number>>,
): number {
  const raw = (Object.keys(weights) as MatchComponent[]).reduce(
    (sum, k) => sum + weights[k] * (components[k] ?? 0),
    0,
  );
  return Math.min(100, Math.max(0, raw * 100));
}

/**
 * Nota exata (0..100) SEM a afinidade de trajetória — é a que vai para a IA
 * (pseudonymize.ts), para que nada derivado das marcas saia do servidor.
 */
export function scoreWithoutTrajectory(breakdown: Pick<MatchBreakdown, "components">): number {
  const components = { ...breakdown.components, trajectory: null };
  return weightedScore(components, effectiveWeights(components));
}

// ---------------------------------------------------------------------------
// Motivos em pt-BR
// ---------------------------------------------------------------------------

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function areaReason(
  breakdown: MatchBreakdown,
  areas: AreaLookup | undefined,
  mentee: MenteeForMatching,
): string | null {
  const names = breakdown.sharedAreaIds
    .map((id) => areas?.get(id)?.name)
    .filter((n): n is string => Boolean(n));
  const n = breakdown.sharedAreaIds.length;
  if (n > 0) {
    if (names.length === 0) {
      return n === 1
        ? "Vocês têm uma área de pesquisa em comum."
        : `Vocês têm ${n} áreas de pesquisa em comum.`;
    }
    if (n === 1) return `Vocês compartilham a área de ${names[0]}.`;
    if (n === 2 && names.length === 2) return `Vocês compartilham as áreas de ${joinPt(names)}.`;
    return `Vocês compartilham ${n} áreas de pesquisa, como ${joinPt(names.slice(0, 2))}.`;
  }
  if (breakdown.sameBigArea && areas) {
    const big = mentee.area_ids.map((id) => areas.get(id)?.big_area).find(Boolean);
    return big
      ? `Ela atua na mesma grande área que você (${big}).`
      : "Ela atua na mesma grande área que você.";
  }
  return null;
}

function similarityReason(component: number | null): string | null {
  if (component === null) return null;
  if (component >= 0.75)
    return "Os interesses de pesquisa descritos nos perfis de vocês são muito próximos.";
  if (component >= 0.45)
    return "Os interesses de pesquisa descritos nos perfis de vocês se aproximam.";
  return null;
}

function topicsReason(breakdown: MatchBreakdown): string | null {
  if (breakdown.sharedTopics.length > 0) {
    // Rótulos entre aspas: vários já têm "e" no nome ("Bolsas e editais").
    const labels = breakdown.sharedTopics.slice(0, 2).map((t) => `“${topicLabel(t)}”`);
    return breakdown.sharedTopics.length === 1
      ? `Ela pode ajudar com ${labels[0]}, um tema que você quer desenvolver.`
      : `Ela pode ajudar com ${joinPt(labels)}, temas que você quer desenvolver.`;
  }
  if (breakdown.sharedKeywords.length > 0) {
    return `Palavras-chave em comum: ${joinPt(breakdown.sharedKeywords.slice(0, 3))}.`;
  }
  return null;
}

function trajectoryReason(breakdown: MatchBreakdown): string | null {
  return sharedTrajectorySentence(breakdown.sharedTrajectory, 2);
}

function seniorityReason(
  gap: number | null,
  mentee: MenteeForMatching,
  candidate: MentorCandidate,
): string | null {
  if (gap === null || gap <= 0) return null;
  const mentorStage = careerStageLabel(candidate.career_stage);
  const menteeStage = careerStageLabel(mentee.career_stage);
  if (!mentorStage) return null;
  if (gap <= 3) {
    const steps = gap === 1 ? "um passo" : "alguns passos";
    return menteeStage
      ? `Está ${steps} à frente na carreira (${mentorStage}) e conhece de perto os desafios da sua etapa (${menteeStage}).`
      : `Está ${steps} à frente na carreira (${mentorStage}).`;
  }
  return `Tem uma trajetória longa (${mentorStage}) para inspirar seus próximos passos.`;
}

function compatibilityReasons(breakdown: MatchBreakdown, candidate: MentorCandidate): string[] {
  const out: string[] = [];
  if (breakdown.sameState && candidate.state) {
    const name =
      (BR_STATES as Record<string, string>)[candidate.state.toUpperCase()] ?? candidate.state;
    out.push(`Vocês são do mesmo estado (${name}).`);
  }
  if (candidate.open_slots !== null && candidate.open_slots > 0) {
    out.push(
      candidate.open_slots === 1
        ? "Tem 1 vaga aberta para mentoria agora."
        : `Tem ${candidate.open_slots} vagas abertas para mentoria agora.`,
    );
  }
  if (breakdown.formatOverlap.length) {
    const labels = breakdown.formatOverlap.map(
      (f) => (MEETING_FORMATS as Record<string, string>)[f]?.toLowerCase() ?? f,
    );
    out.push(`Atende no formato que você prefere (${joinPt(labels)}).`);
  }
  const otherLangs = breakdown.languageOverlap.filter((l) => l !== "pt");
  if (otherLangs.length) {
    const labels = otherLangs.map((l) => (LANGUAGES as Record<string, string>)[l] ?? l);
    out.push(`Também conversa em ${joinPt(labels.map((l) => l.toLowerCase()))}.`);
  }
  return out;
}

const GENERIC_REASONS = [
  "Está disponível para novas mentorias na comunidade.",
  "Faz parte da rede de mentoras da Artemis.",
];

function buildReasons(
  mentee: MenteeForMatching,
  candidate: MentorCandidate,
  breakdown: MatchBreakdown,
  areas: AreaLookup | undefined,
): string[] {
  const { components, weights } = breakdown;
  const contribution = (k: MatchComponent) => (components[k] ?? 0) * weights[k];

  const scored: Array<{ text: string | null; weight: number }> = [
    { text: areaReason(breakdown, areas, mentee), weight: contribution("areas") },
    { text: similarityReason(components.similarity), weight: contribution("similarity") },
    { text: topicsReason(breakdown), weight: contribution("topics") },
    // Antes da senioridade: em empate de contribuição, a trajetória em comum vem primeiro.
    { text: trajectoryReason(breakdown), weight: contribution("trajectory") },
    {
      text: seniorityReason(breakdown.seniorityGap, mentee, candidate),
      weight: contribution("seniority"),
    },
  ];
  const primary = scored
    .filter((r): r is { text: string; weight: number } => Boolean(r.text) && r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((r) => r.text);

  const reasons = primary.slice(0, 3);
  for (const extra of compatibilityReasons(breakdown, candidate)) {
    if (reasons.length >= 3) break;
    if (reasons.length >= 2 && primary.length >= 2) break;
    reasons.push(extra);
  }
  for (const generic of GENERIC_REASONS) {
    if (reasons.length >= 2) break;
    if (!reasons.includes(generic)) reasons.push(generic);
  }
  return uniq(reasons).slice(0, 3);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface RankContext {
  /** Nomes e grandes áreas (para motivos e para crédito parcial por grande área). */
  areas?: AreaLookup;
}

export function scoreMentorCandidate<C extends MentorCandidate>(
  mentee: MenteeForMatching,
  candidate: C,
  context: RankContext = {},
): RankedMentor<C> {
  const area = scoreAreas(mentee.area_ids ?? [], candidate.area_ids ?? [], context.areas);
  const similarity = scoreSimilarity(candidate.similarity);
  const topics = scoreTopicsAndKeywords(mentee, candidate);
  const menteeSeniority = seniorityOf(mentee.career_stage);
  const mentorSeniority = seniorityOf(candidate.career_stage);
  const gap =
    menteeSeniority === null || mentorSeniority === null ? null : mentorSeniority - menteeSeniority;
  const compat = scoreCompatibility(mentee, candidate);
  const trajectory = scoreTrajectory(mentee.trajectory_tags, candidate.trajectory_tags);

  const components: Record<MatchComponent, number | null> = {
    areas: area.score,
    similarity,
    topics: topics.score,
    seniority: scoreSeniorityGap(gap),
    compatibility: compat.score,
    trajectory: trajectory.shared.length > 0 ? 1 : null,
  };
  // A cobertura da trajetória entra no peso (componente = 1): assim ela só pode somar.
  const base =
    trajectory.coverage > 0 && trajectory.coverage < 1
      ? { ...MATCH_WEIGHTS, trajectory: MATCH_WEIGHTS.trajectory * trajectory.coverage }
      : MATCH_WEIGHTS;
  const weights = effectiveWeights(components, base);
  const rawScore = weightedScore(components, weights);

  const breakdown: MatchBreakdown = {
    components,
    weights,
    rawScore,
    sharedAreaIds: area.shared,
    sameBigArea: area.sameBigArea,
    sharedTopics: topics.sharedTopics,
    sharedKeywords: topics.sharedKeywords,
    seniorityGap: gap,
    formatOverlap: compat.formatOverlap,
    languageOverlap: compat.languageOverlap,
    sameState: compat.sameState,
    similarity: candidate.similarity ?? null,
    sharedTrajectory: trajectory.shared,
  };

  return {
    mentorId: candidate.mentor_id,
    candidate,
    score: Math.round(rawScore),
    breakdown,
    reasons: buildReasons(mentee, candidate, breakdown, context.areas),
  };
}

/** Comparador determinístico: pontuação exata desc, depois id asc. */
export function compareRanked(
  a: { mentorId: string; breakdown: { rawScore: number } },
  b: { mentorId: string; breakdown: { rawScore: number } },
): number {
  const diff = b.breakdown.rawScore - a.breakdown.rawScore;
  if (Math.abs(diff) > 1e-9) return diff;
  return a.mentorId < b.mentorId ? -1 : a.mentorId > b.mentorId ? 1 : 0;
}

/**
 * Ordena as candidatas da RPC pela pontuação heurística. Remove a própria mentoranda e
 * duplicatas (defensivo).
 */
export function rankMentorCandidates<C extends MentorCandidate>(
  mentee: MenteeForMatching,
  candidates: readonly C[],
  context: RankContext = {},
): RankedMentor<C>[] {
  const seen = new Set<string>();
  const ranked: RankedMentor<C>[] = [];
  for (const candidate of candidates) {
    if (!candidate.mentor_id || candidate.mentor_id === mentee.id || seen.has(candidate.mentor_id))
      continue;
    seen.add(candidate.mentor_id);
    ranked.push(scoreMentorCandidate(mentee, candidate, context));
  }
  return ranked.sort(compareRanked);
}
