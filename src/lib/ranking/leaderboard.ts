/**
 * Pontos do ranking da comunidade — IDÊNTICOS à RPC `get_community_leaderboard` (SQL):
 *
 *   points = 10·papers + 2·votos recebidos + 5·soluções + 15·mentorias (aceitas ou concluídas,
 *            como mentora) + 1·(tópicos + respostas no fórum)
 *
 * Conteúdo anônimo nunca conta (não pode vazar autoria); papers ocultos pela moderação também não.
 *
 * Use estas constantes só para EXPLICAR a pontuação na UI; quem calcula é o banco.
 */

export const LEADERBOARD_POINTS = {
  paper: 10,
  voteReceived: 2,
  solution: 5,
  mentorship: 15,
  post: 1,
} as const;

export type LeaderboardPointKey = keyof typeof LEADERBOARD_POINTS;

export interface LeaderboardStats {
  papers: number;
  votes_received: number;
  solutions: number;
  mentorships: number;
  /** Tópicos + respostas no fórum. */
  posts: number;
}

export function computeLeaderboardPoints(stats: LeaderboardStats): number {
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  return (
    LEADERBOARD_POINTS.paper * n(stats.papers) +
    LEADERBOARD_POINTS.voteReceived * n(stats.votes_received) +
    LEADERBOARD_POINTS.solution * n(stats.solutions) +
    LEADERBOARD_POINTS.mentorship * n(stats.mentorships) +
    LEADERBOARD_POINTS.post * n(stats.posts)
  );
}

/** Regras em pt-BR para a legenda "Como funciona a pontuação" na página /ranking. */
export const LEADERBOARD_RULES: ReadonlyArray<{
  key: LeaderboardPointKey;
  points: number;
  label: string;
  description: string;
}> = [
  {
    key: "mentorship",
    points: LEADERBOARD_POINTS.mentorship,
    label: "Mentoria como mentora",
    description: "Cada mentoria que você aceitou ou concluiu como mentora.",
  },
  {
    key: "paper",
    points: LEADERBOARD_POINTS.paper,
    label: "Paper na Vitrine",
    description:
      "Cada paper que você compartilhou na Vitrine (papers ocultos pela moderação não contam).",
  },
  {
    key: "solution",
    points: LEADERBOARD_POINTS.solution,
    label: "Resposta escolhida como solução",
    description:
      "Quando a autora de um tópico marca a sua resposta como solução (não vale no próprio tópico nem em respostas anônimas).",
  },
  {
    key: "voteReceived",
    points: LEADERBOARD_POINTS.voteReceived,
    label: "Voto recebido",
    description: "Cada voto que os papers que você compartilhou receberam.",
  },
  {
    key: "post",
    points: LEADERBOARD_POINTS.post,
    label: "Participação no fórum",
    description:
      "Cada tópico ou resposta que você publicou no fórum (publicações anônimas não contam).",
  },
];

/** "1 ponto" / "15 pontos" */
export function formatPoints(points: number): string {
  return `${new Intl.NumberFormat("pt-BR").format(points)} ${points === 1 ? "ponto" : "pontos"}`;
}
