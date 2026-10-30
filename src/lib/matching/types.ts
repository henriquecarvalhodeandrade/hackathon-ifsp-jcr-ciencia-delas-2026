/**
 * Tipos do matching de mentoria. Estruturais (não dependem de database.types.ts) para que
 * os módulos puros sejam testáveis; são compatíveis com as linhas do Supabase.
 */

export interface AreaInfo {
  name: string;
  big_area?: string | null;
}

/** id da área de pesquisa → nome e grande área (tabela research_areas). */
export type AreaLookup = ReadonlyMap<number, AreaInfo>;

/** Perfil da mentoranda (quem busca mentoria). */
export interface MenteeForMatching {
  id: string;
  /** Usado só para apagar o nome de textos livres antes de enviá-los à IA. */
  full_name?: string | null;
  career_stage: string | null;
  area_ids: number[];
  keywords: string[] | null;
  mentorship_topics: string[] | null;
  mentoring_goals?: string | null;
  headline?: string | null;
  meeting_formats: string[] | null;
  languages: string[] | null;
  state: string | null;
  /**
   * Marcas de trajetória autodeclaradas (src/lib/trajectory/catalog.ts). Opcional: quem não
   * declarou nada fica exatamente com a mesma nota. NUNCA vão para a IA.
   */
  trajectory_tags?: string[] | null;
}

/** Linha devolvida pela RPC `get_mentor_candidates` (CONTRACT §4). */
export interface MentorCandidate {
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
  /** Similaridade de cosseno 0..1 entre os embeddings; null se algum não existir. */
  similarity: number | null;
  open_slots: number | null;
  existing_request_status: string | null;
  /** Marcas de trajetória da mentora (última coluna da RPC). NUNCA vão para a IA. */
  trajectory_tags: string[] | null;
}

export type MatchComponent =
  "areas" | "similarity" | "topics" | "seniority" | "compatibility" | "trajectory";

export interface MatchBreakdown {
  /**
   * Nota de cada componente, 0..1. null = não se aplica (peso redistribuído).
   * `trajectory` só existe (= 1) quando as duas têm marca em comum; o quanto compartilham
   * entra no PESO do componente (ver rank.ts), para ele só poder somar.
   */
  components: Record<MatchComponent, number | null>;
  /** Pesos efetivos usados (somam 1 entre os componentes aplicáveis). */
  weights: Record<MatchComponent, number>;
  /** Pontuação exata antes do arredondamento (0..100). */
  rawScore: number;
  sharedAreaIds: number[];
  sameBigArea: boolean;
  sharedTopics: string[];
  sharedKeywords: string[];
  /** Senioridade da mentora − senioridade da mentoranda. */
  seniorityGap: number | null;
  formatOverlap: string[];
  languageOverlap: string[];
  sameState: boolean;
  similarity: number | null;
  /** Marcas de trajetória em comum (slugs, na ordem do catálogo). Vazio = componente null. */
  sharedTrajectory: string[];
}

export interface RankedMentor<C extends MentorCandidate = MentorCandidate> {
  mentorId: string;
  candidate: C;
  /** 0..100, inteiro. */
  score: number;
  breakdown: MatchBreakdown;
  /** 2 a 3 motivos curtos em pt-BR, do mais forte para o mais fraco. */
  reasons: string[];
}

export type SuggestionSource = "ai" | "heuristic";

export interface ExplainedMatch<C extends MentorCandidate = MentorCandidate> {
  mentorId: string;
  candidate: C;
  /** Pontuação final 0..100 (heurística, ou mistura heurística + IA). */
  score: number;
  heuristicScore: number;
  aiScore: number | null;
  /** Motivo principal (1–2 frases) gravado em mentor_suggestions.reason. */
  reason: string;
  /** Motivos heurísticos detalhados (para a UI mostrar como lista). */
  reasons: string[];
  conversationStarters: string[];
  source: SuggestionSource;
  breakdown: MatchBreakdown;
}
