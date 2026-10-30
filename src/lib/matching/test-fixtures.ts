import { SIMILARITY_CEIL, SIMILARITY_FLOOR } from "./rank";
import type { AreaInfo, MenteeForMatching, MentorCandidate } from "./types";

/** Dados fictícios usados pelos testes do matching (não é usado em produção). */

/**
 * Cosseno que vira exatamente `component` (0..1) no componente semântico, qualquer que seja a
 * calibração de SIMILARITY_FLOOR/CEIL — os cenários de nota exata não dependem dela.
 */
export function similarityFor(component: number): number {
  return SIMILARITY_FLOOR + component * (SIMILARITY_CEIL - SIMILARITY_FLOOR);
}

export const AREAS = new Map<number, AreaInfo>([
  [1, { name: "Ecologia", big_area: "Ciências Biológicas" }],
  [2, { name: "Genética", big_area: "Ciências Biológicas" }],
  [3, { name: "Botânica", big_area: "Ciências Biológicas" }],
  [4, { name: "Ciência da Computação", big_area: "Ciências Exatas e da Terra" }],
  [5, { name: "Química", big_area: "Ciências Exatas e da Terra" }],
]);

export function makeMentee(overrides: Partial<MenteeForMatching> = {}): MenteeForMatching {
  return {
    id: "00000000-0000-4000-8000-00000000000a",
    full_name: "Marina Teste Silva",
    career_stage: "masters",
    area_ids: [1, 2],
    keywords: ["genômica", "bioinformática"],
    mentorship_topics: ["bolsas-editais", "escrita-cientifica"],
    mentoring_goals:
      "Quero aprender a escrever meu primeiro artigo. Meu e-mail é marina@example.com.",
    headline: "Mestranda em genética de populações",
    meeting_formats: ["online"],
    languages: ["pt"],
    state: "SP",
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<MentorCandidate> = {}): MentorCandidate {
  return {
    mentor_id: "00000000-0000-4000-8000-000000000001",
    full_name: "Helena Demo Souza",
    avatar_url: "https://example.com/avatar.png",
    headline: "Professora de genética e divulgadora",
    institution: "Universidade Fictícia",
    state: "SP",
    career_stage: "professor",
    keywords: ["genômica", "evolução"],
    mentorship_topics: ["bolsas-editais", "escrita-cientifica"],
    meeting_formats: ["online"],
    languages: ["pt", "en"],
    mentoring_offer:
      "Ajudo com escrita de artigos e editais da FAPESP. Fale comigo: helena@example.com",
    area_ids: [1, 2],
    similarity: 0.85,
    open_slots: 2,
    existing_request_status: null,
    // Sem marcas de trajetória por padrão: os testes antigos valem como estavam.
    trajectory_tags: null,
    ...overrides,
  };
}
