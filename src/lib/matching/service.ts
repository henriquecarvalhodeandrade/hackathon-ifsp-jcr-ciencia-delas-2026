import "server-only";
import { embedTexts, isAiEnabled } from "@/lib/ai";
import { getEmbeddingConfig, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { explainMatchesWithAi } from "./ai-explain";
import { buildProfileText, embeddingKindFor, profileEmbeddingHash } from "./profile-text";
import { heuristicExplanation } from "./pseudonymize";
import { rankMentorCandidates } from "./rank";
import type {
  AreaInfo,
  AreaLookup,
  ExplainedMatch,
  MatchBreakdown,
  MenteeForMatching,
  MentorCandidate,
  SuggestionSource,
} from "./types";

/**
 * Orquestração do matching de mentoria (somente servidor, sessão da usuária + RLS).
 *
 *   refreshMyEmbedding()        → (re)gera o embedding do perfil, se mudou e houver consentimento
 *   findMentorsForCurrentUser() → candidatas (RPC) → ranking heurístico → explicação por IA
 *                                 → grava em mentor_suggestions → devolve para a UI
 *   getMySavedSuggestions()     → lê as sugestões já gravadas (sem chamar IA)
 *
 * Falta de IA nunca é erro: tudo cai para a heurística. Erros de sessão/perfil/banco lançam
 * `MatchingError` com mensagem em pt-BR pronta para a interface.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type MatchingErrorCode =
  "not_configured" | "not_authenticated" | "not_onboarded" | "db_error";

export class MatchingError extends Error {
  override readonly name = "MatchingError";
  constructor(
    readonly code: MatchingErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Intervalo mínimo entre duas gerações (protege a cota gratuita das APIs). */
export const SUGGESTION_COOLDOWN_SECONDS = 60;

/** Aviso quando a cota de IA do banco (claim_ai_matching_slot) nega esta geração. */
export const AI_QUOTA_WARNING =
  "Você pediu sugestões com IA várias vezes em pouco tempo. Desta vez usamos só as regras da plataforma; a análise com IA volta em instantes (até 20 por dia).";

/**
 * Reserva uma geração com IA na cota guardada no banco (60 s entre gerações e 20 por dia,
 * por pessoa). Erro na RPC (ex.: migration ausente) conta como "sem cota": falha fechada,
 * para nunca chamar a IA sem limite.
 */
async function claimAiMatchingSlot(supabase: ServerClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_ai_matching_slot");
  if (error) {
    console.warn(
      `[matching] cota de IA indisponível — ${error.code ?? ""} ${error.message.slice(0, 160)}`,
    );
    return false;
  }
  return data === true;
}
export const CANDIDATE_POOL_SIZE = 30;
export const MAX_SUGGESTIONS = 10;

const PROFILE_COLUMNS =
  "id, full_name, headline, career_stage, keywords, mentorship_topics, mentoring_goals, mentoring_offer, is_mentor, meeting_formats, languages, state, ai_consent, onboarded_at";

interface MatchingProfileRow {
  id: string;
  full_name: string;
  headline: string | null;
  career_stage: string | null;
  keywords: string[];
  mentorship_topics: string[];
  mentoring_goals: string | null;
  mentoring_offer: string | null;
  is_mentor: boolean;
  meeting_formats: string[];
  languages: string[];
  state: string | null;
  ai_consent: boolean;
  onboarded_at: string | null;
}

// ---------------------------------------------------------------------------
// Utilidades de leitura
// ---------------------------------------------------------------------------

async function loadAreas(supabase: ServerClient): Promise<Map<number, AreaInfo>> {
  const { data, error } = await supabase.from("research_areas").select("id, name, big_area");
  if (error) throw new MatchingError("db_error", "Não foi possível carregar as áreas de pesquisa.");
  return new Map((data ?? []).map((a) => [Number(a.id), { name: a.name, big_area: a.big_area }]));
}

async function loadProfileAreaIds(supabase: ServerClient, profileId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("profile_research_areas")
    .select("area_id")
    .eq("profile_id", profileId);
  if (error)
    throw new MatchingError("db_error", "Não foi possível carregar as suas áreas de pesquisa.");
  return (data ?? []).map((r) => Number(r.area_id));
}

async function loadMyProfile(
  supabase: ServerClient,
  userId: string,
): Promise<MatchingProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new MatchingError("db_error", "Não foi possível carregar o seu perfil.");
  return (data as MatchingProfileRow | null) ?? null;
}

async function requireSession(supabase: ServerClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new MatchingError(
      "not_authenticated",
      "Entre na sua conta para ver sugestões de mentoras.",
    );
  }
  return data.user.id;
}

function toMentee(profile: MatchingProfileRow, areaIds: number[]): MenteeForMatching {
  return {
    id: profile.id,
    full_name: profile.full_name,
    career_stage: profile.career_stage,
    area_ids: areaIds,
    keywords: profile.keywords,
    mentorship_topics: profile.mentorship_topics,
    mentoring_goals: profile.mentoring_goals,
    headline: profile.headline,
    meeting_formats: profile.meeting_formats,
    languages: profile.languages,
    state: profile.state,
  };
}

// ---------------------------------------------------------------------------
// Embedding do próprio perfil
// ---------------------------------------------------------------------------

export type RefreshEmbeddingResult =
  | { status: "updated"; model: string }
  | { status: "unchanged"; model: string }
  | {
      status: "skipped";
      reason:
        | "not_configured"
        | "not_authenticated"
        | "not_onboarded"
        | "no_consent"
        | "no_embedding_config"
        | "empty_profile"
        | "error";
    };

async function refreshEmbeddingFor(
  supabase: ServerClient,
  profile: MatchingProfileRow,
  areas: AreaLookup,
  areaIds: number[],
): Promise<RefreshEmbeddingResult> {
  if (!profile.onboarded_at) return { status: "skipped", reason: "not_onboarded" };
  if (!profile.ai_consent) return { status: "skipped", reason: "no_consent" };
  const config = getEmbeddingConfig();
  if (!config) return { status: "skipped", reason: "no_embedding_config" };

  const areaNames = areaIds.map((id) => areas.get(id)?.name).filter((n): n is string => Boolean(n));
  const text = buildProfileText(profile, areaNames);
  if (!text.trim()) return { status: "skipped", reason: "empty_profile" };

  const kind = embeddingKindFor(profile);
  const hash = await profileEmbeddingHash(text, kind, config.model);

  const { data: existing } = await supabase
    .from("profile_embeddings")
    .select("content_hash, model")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (existing?.content_hash === hash && existing.model === config.model) {
    return { status: "unchanged", model: config.model };
  }

  const result = await embedTexts([text], kind);
  const vector = result?.vectors[0];
  if (!result || !vector) return { status: "skipped", reason: "no_embedding_config" };

  const { error } = await supabase.from("profile_embeddings").upsert(
    {
      profile_id: profile.id,
      // pgvector aceita o formato texto "[0.1,0.2,...]".
      embedding: JSON.stringify(vector),
      content_hash: hash,
      model: result.model.slice(0, 100),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw new Error(`profile_embeddings upsert: ${error.code ?? ""} ${error.message}`);
  return { status: "updated", model: result.model };
}

/**
 * (Re)gera o embedding do perfil da usuária logada. Chame depois de salvar o perfil
 * (onboarding/edição). Não lança: falhas viram `{ status: "skipped", reason: "error" }`.
 * Só roda com consentimento de IA, perfil completo e GEMINI_API_KEY configurada; se o
 * texto de pesquisa não mudou (content_hash igual), não chama a API.
 */
export async function refreshMyEmbedding(): Promise<RefreshEmbeddingResult> {
  if (!isSupabaseConfigured()) return { status: "skipped", reason: "not_configured" };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { status: "skipped", reason: "not_authenticated" };
    const profile = await loadMyProfile(supabase, data.user.id);
    if (!profile) return { status: "skipped", reason: "not_onboarded" };
    if (!profile.ai_consent) return { status: "skipped", reason: "no_consent" };
    if (!getEmbeddingConfig()) return { status: "skipped", reason: "no_embedding_config" };
    const [areas, areaIds] = await Promise.all([
      loadAreas(supabase),
      loadProfileAreaIds(supabase, profile.id),
    ]);
    return await refreshEmbeddingFor(supabase, profile, areas, areaIds);
  } catch (error) {
    console.warn(
      `[matching] não foi possível atualizar o embedding — ${error instanceof Error ? error.message.slice(0, 200) : "erro"}`,
    );
    return { status: "skipped", reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Sugestões de mentoras
// ---------------------------------------------------------------------------

export interface SuggestedMentor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
  area_ids: number[];
  area_names: string[];
  keywords: string[];
  mentorship_topics: string[];
  meeting_formats: string[];
  languages: string[];
  open_slots: number | null;
  existing_request_status: string | null;
}

export interface MentorSuggestion {
  mentorId: string;
  rank: number;
  score: number;
  /** Motivo principal (IA ou heurística), 1–2 frases. */
  reason: string;
  /** Motivos heurísticos detalhados (lista curta para a UI). */
  reasons: string[];
  conversationStarters: string[];
  source: SuggestionSource;
  mentor: SuggestedMentor;
  /** Detalhamento da nota (pesos e componentes). Ausente em sugestões lidas do banco. */
  breakdown?: MatchBreakdown;
}

export interface FindMentorsResult {
  suggestions: MentorSuggestion[];
  /** "ai" se ao menos uma sugestão tem explicação gerada por IA. */
  source: SuggestionSource;
  provider: string | null;
  model: string | null;
  /** Avisos em pt-BR para mostrar à usuária (IA indisponível, sem consentimento...). */
  warnings: string[];
}

interface CandidateRow {
  mentor_id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
  keywords: string[] | null;
  mentorship_topics: string[] | null;
  meeting_formats: string[] | null;
  languages: string[] | null;
  mentoring_offer: string | null;
  area_ids: number[] | null;
  similarity: number | null;
  open_slots: number | null;
  existing_request_status: string | null;
}

export function normalizeCandidateRow(row: CandidateRow): MentorCandidate {
  const similarity =
    row.similarity === null || row.similarity === undefined ? null : Number(row.similarity);
  return {
    mentor_id: row.mentor_id,
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
    headline: row.headline ?? null,
    institution: row.institution ?? null,
    state: row.state ?? null,
    career_stage: row.career_stage ?? null,
    keywords: row.keywords ?? [],
    mentorship_topics: row.mentorship_topics ?? [],
    meeting_formats: row.meeting_formats ?? [],
    languages: row.languages ?? [],
    mentoring_offer: row.mentoring_offer ?? null,
    area_ids: (row.area_ids ?? []).map(Number),
    similarity: similarity !== null && Number.isFinite(similarity) ? similarity : null,
    open_slots:
      row.open_slots === null || row.open_slots === undefined ? null : Number(row.open_slots),
    existing_request_status: row.existing_request_status ?? null,
  };
}

/** Exclui mentoras com quem ela já está em mentoria (existing_request_status = 'accepted'). */
export function isNewMentorCandidate(candidate: Pick<MentorCandidate, "existing_request_status">) {
  return candidate.existing_request_status !== "accepted";
}

function toSuggestedMentor(c: MentorCandidate, areas: AreaLookup): SuggestedMentor {
  const areaIds = c.area_ids ?? [];
  return {
    id: c.mentor_id,
    full_name: c.full_name ?? "",
    avatar_url: c.avatar_url,
    headline: c.headline,
    institution: c.institution,
    state: c.state,
    career_stage: c.career_stage,
    area_ids: areaIds,
    area_names: areaIds.map((id) => areas.get(id)?.name).filter((n): n is string => Boolean(n)),
    keywords: c.keywords ?? [],
    mentorship_topics: c.mentorship_topics ?? [],
    meeting_formats: c.meeting_formats ?? [],
    languages: c.languages ?? [],
    open_slots: c.open_slots,
    existing_request_status: c.existing_request_status,
  };
}

async function loadConsentMap(
  supabase: ServerClient,
  mentorIds: string[],
): Promise<Map<string, boolean>> {
  if (mentorIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, ai_consent")
    .in("id", mentorIds);
  // Em caso de erro, assume "sem consentimento": só dados de taxonomia vão para a IA.
  if (error || !data) return new Map();
  return new Map(data.map((p) => [p.id, Boolean(p.ai_consent)]));
}

async function persistSuggestions(
  supabase: ServerClient,
  menteeId: string,
  suggestions: MentorSuggestion[],
  model: string | null,
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("mentor_suggestions")
    .delete()
    .eq("mentee_id", menteeId);
  if (deleteError) return false;
  if (suggestions.length === 0) return true;
  const rows = suggestions.map((s) => ({
    mentee_id: menteeId,
    mentor_id: s.mentorId,
    rank: s.rank,
    score: s.score,
    reason: s.reason.slice(0, 1500),
    conversation_starters: s.conversationStarters.slice(0, 10).map((t) => t.slice(0, 500)),
    source: s.source,
    model: s.source === "ai" && model ? model.slice(0, 100) : null,
  }));
  const { error } = await supabase.from("mentor_suggestions").insert(rows);
  return !error;
}

/**
 * Sugestões de mentoras para a usuária logada.
 *  1. exige perfil com onboarding concluído (o "Quero ser mentorada" é conferido na action);
 *  2. com consentimento de IA: atualiza o embedding (se mudou);
 *  3. RPC get_mentor_candidates(30), sem as mentoras com quem ela já está em mentoria
 *     → ranking heurístico;
 *  4. com consentimento + IA configurada: re-rank e explicação por IA do top 8 (pseudonimizado);
 *  5. substitui as linhas em mentor_suggestions e devolve as `limit` melhores.
 * As sugestões NÃO dependem do consentimento: sem ele (ou sem IA), tudo funciona só com a
 * heurística e nada sai do servidor. O consentimento só liga os embeddings (Gemini) e a
 * explicação/reordenação por IA.
 */
export async function findMentorsForCurrentUser(
  options: { limit?: number } = {},
): Promise<FindMentorsResult> {
  const limit = Math.max(1, Math.min(MAX_SUGGESTIONS, Math.floor(options.limit ?? 5)));
  if (!isSupabaseConfigured()) {
    throw new MatchingError(
      "not_configured",
      "O Supabase ainda não foi configurado neste ambiente.",
    );
  }
  const supabase = await createClient();
  const userId = await requireSession(supabase);

  const profile = await loadMyProfile(supabase, userId);
  if (!profile || !profile.onboarded_at) {
    throw new MatchingError(
      "not_onboarded",
      "Complete o seu perfil (áreas, etapa da carreira e objetivos) para receber sugestões de mentoras.",
    );
  }

  const warnings: string[] = [];

  // Proteção da cota gratuita: gerações seguidas em menos de 60 s devolvem o que já está salvo.
  // Exceção: sugestões só por regras logo depois de ela autorizar a IA — aí vale gerar de novo.
  const recent = await getMySavedSuggestions({
    supabase,
    userId,
    maxAgeSeconds: SUGGESTION_COOLDOWN_SECONDS,
  });
  const upgradingToAi = recent?.source === "heuristic" && profile.ai_consent && isAiEnabled();
  if (recent && recent.suggestions.length > 0 && !upgradingToAi) {
    return {
      ...recent,
      suggestions: recent.suggestions.slice(0, limit),
      warnings: [
        "Você acabou de gerar sugestões; mostramos as mais recentes. Tente de novo em um minuto.",
      ],
    };
  }

  const [areas, areaIds] = await Promise.all([
    loadAreas(supabase),
    loadProfileAreaIds(supabase, userId),
  ]);

  // Cota de IA guardada no banco (60 s entre gerações, 20 por dia): a espera acima depende das
  // sugestões salvas, que a própria usuária pode apagar pela API; esta reserva ela não zera, e é
  // atômica (pedidos em paralelo não passam juntos). Sem reserva, esta geração usa só as regras.
  const wantsAi = profile.ai_consent && (isAiEnabled() || getEmbeddingConfig() !== null);
  const aiAllowed = wantsAi && (await claimAiMatchingSlot(supabase));
  if (wantsAi && !aiAllowed) warnings.push(AI_QUOTA_WARNING);

  if (aiAllowed) {
    try {
      const refreshed = await refreshEmbeddingFor(supabase, profile, areas, areaIds);
      if (
        refreshed.status === "skipped" &&
        refreshed.reason === "no_embedding_config" &&
        isAiEnabled()
      ) {
        warnings.push(
          "A análise semântica de perfis está desligada; usamos áreas, temas e etapa da carreira.",
        );
      }
    } catch (error) {
      console.warn(
        `[matching] embedding não atualizado — ${error instanceof Error ? error.message.slice(0, 200) : "erro"}`,
      );
      warnings.push(
        "Não conseguimos atualizar a análise do seu perfil agora; usamos os dados disponíveis.",
      );
    }
  } else if (!profile.ai_consent) {
    warnings.push(
      "Estas sugestões foram calculadas só com as regras da plataforma: nenhum dado seu foi enviado a serviços de IA. Se quiser a análise semântica e as explicações por IA, ative as sugestões com IA.",
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_mentor_candidates", {
    p_limit: CANDIDATE_POOL_SIZE,
  });
  if (rpcError) {
    console.warn(
      `[matching] get_mentor_candidates falhou — ${rpcError.code ?? ""} ${rpcError.message.slice(0, 200)}`,
    );
    throw new MatchingError(
      "db_error",
      "Não foi possível buscar mentoras agora. Tente novamente em instantes.",
    );
  }

  // Quem já é mentora dela (mentoria aceita) não volta como sugestão; pedidos pendentes ficam,
  // e a interface mostra "Pedido enviado".
  const candidates = ((rpcData ?? []) as unknown as CandidateRow[])
    .map(normalizeCandidateRow)
    .filter(isNewMentorCandidate);
  const mentee = toMentee(profile, areaIds);
  const ranked = rankMentorCandidates(mentee, candidates, { areas });

  let explained: ExplainedMatch[];
  let provider: string | null = null;
  let model: string | null = null;

  if (aiAllowed && isAiEnabled() && ranked.length > 0) {
    const consentByMentorId = await loadConsentMap(
      supabase,
      ranked.slice(0, 8).map((r) => r.mentorId),
    );
    const result = await explainMatchesWithAi(mentee, ranked, { areas, consentByMentorId });
    const explainedIds = new Set(result.matches.map((m) => m.mentorId));
    const rest = ranked
      .filter((r) => !explainedIds.has(r.mentorId))
      .map((r) => heuristicExplanation(mentee, r, areas));
    explained = [...result.matches, ...rest];
    provider = result.provider;
    model = result.model;
    if (result.warning) warnings.push(result.warning);
  } else {
    explained = ranked.map((r) => heuristicExplanation(mentee, r, areas));
  }

  const suggestions: MentorSuggestion[] = explained.slice(0, limit).map((m, index) => ({
    mentorId: m.mentorId,
    rank: index + 1,
    score: m.score,
    reason: m.reason,
    reasons: m.reasons,
    conversationStarters: m.conversationStarters,
    source: m.source,
    mentor: toSuggestedMentor(m.candidate, areas),
    breakdown: m.breakdown,
  }));

  const saved = await persistSuggestions(supabase, userId, suggestions, model);
  if (!saved) warnings.push("Não foi possível salvar as sugestões; elas aparecem só nesta visita.");

  const anyAi = suggestions.some((s) => s.source === "ai");
  return {
    suggestions,
    source: anyAi ? "ai" : "heuristic",
    provider: anyAi ? provider : null,
    model: anyAi ? model : null,
    warnings,
  };
}

interface SavedSuggestionRow {
  mentor_id: string;
  rank: number;
  score: number;
  reason: string;
  conversation_starters: string[];
  source: string;
  model: string | null;
  created_at: string;
}

/**
 * Lê as sugestões já gravadas da usuária logada (sem IA, sem RPC). Ideal para o carregamento
 * da página /mentoria; use `findMentorsForCurrentUser` só quando ela pedir novas sugestões.
 * Retorna null se não houver sugestões (ou se forem mais antigas que `maxAgeSeconds`).
 * Como numa busca nova (`isNewMentorCandidate`), deixa de fora as mentoras com quem ela já está
 * em mentoria (pedido aceito) — a sugestão pode ter sido gravada antes do aceite.
 */
export async function getMySavedSuggestions(
  options: { supabase?: ServerClient; userId?: string; maxAgeSeconds?: number } = {},
): Promise<(Omit<FindMentorsResult, "warnings"> & { generatedAt: string }) | null> {
  if (!options.supabase && !isSupabaseConfigured()) return null;
  const supabase = options.supabase ?? (await createClient());
  const userId = options.userId ?? (await requireSession(supabase));

  const { data, error } = await supabase
    .from("mentor_suggestions")
    .select("mentor_id, rank, score, reason, conversation_starters, source, model, created_at")
    .eq("mentee_id", userId)
    .order("rank", { ascending: true });
  if (error || !data || data.length === 0) return null;

  const rows = data as SavedSuggestionRow[];
  const generatedAt = rows.reduce(
    (max, r) => (r.created_at > max ? r.created_at : max),
    rows[0].created_at,
  );
  if (options.maxAgeSeconds !== undefined) {
    const ageMs = Date.now() - new Date(generatedAt).getTime();
    if (!(ageMs >= 0 && ageMs <= options.maxAgeSeconds * 1000)) return null;
  }

  const mentorIds = rows.map((r) => r.mentor_id);
  const [{ data: mentors }, { data: links }, { data: accepted }, areas] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, headline, institution, state, career_stage, keywords, mentorship_topics, meeting_formats, languages",
      )
      .in("id", mentorIds),
    supabase
      .from("profile_research_areas")
      .select("profile_id, area_id")
      .in("profile_id", mentorIds),
    supabase
      .from("mentorship_requests")
      .select("mentor_id")
      .eq("mentee_id", userId)
      .eq("status", "accepted")
      .in("mentor_id", mentorIds),
    loadAreas(supabase),
  ]);
  const byId = new Map((mentors ?? []).map((m) => [m.id, m]));
  const inMentorship = new Set((accepted ?? []).map((r) => r.mentor_id));
  const areaIdsByProfile = new Map<string, number[]>();
  for (const link of links ?? []) {
    const list = areaIdsByProfile.get(link.profile_id) ?? [];
    list.push(Number(link.area_id));
    areaIdsByProfile.set(link.profile_id, list);
  }

  const suggestions: MentorSuggestion[] = [];
  for (const row of rows) {
    const m = byId.get(row.mentor_id);
    if (!m) continue; // mentora removida ou indisponível
    if (inMentorship.has(row.mentor_id)) continue; // já é mentora dela (pedido aceito)
    const areaIds = areaIdsByProfile.get(row.mentor_id) ?? [];
    suggestions.push({
      mentorId: row.mentor_id,
      rank: row.rank,
      score: row.score,
      reason: row.reason,
      reasons: [],
      conversationStarters: row.conversation_starters ?? [],
      source: row.source === "ai" ? "ai" : "heuristic",
      mentor: {
        id: m.id,
        full_name: m.full_name ?? "",
        avatar_url: m.avatar_url ?? null,
        headline: m.headline ?? null,
        institution: m.institution ?? null,
        state: m.state ?? null,
        career_stage: m.career_stage ?? null,
        area_ids: areaIds,
        area_names: areaIds.map((id) => areas.get(id)?.name).filter((n): n is string => Boolean(n)),
        keywords: m.keywords ?? [],
        mentorship_topics: m.mentorship_topics ?? [],
        meeting_formats: m.meeting_formats ?? [],
        languages: m.languages ?? [],
        open_slots: null,
        existing_request_status: null,
      },
    });
  }

  const aiRow = rows.find((r) => r.source === "ai" && r.model);
  return {
    suggestions,
    source: suggestions.some((s) => s.source === "ai") ? "ai" : "heuristic",
    provider: null,
    model: aiRow?.model ?? null,
    generatedAt,
  };
}
