import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_POINTS,
  LEADERBOARD_RULES,
  computeLeaderboardPoints,
  formatPoints,
} from "./leaderboard";

describe("pontos do ranking da comunidade (= SQL 10/2/5/15/1)", () => {
  it("usa os mesmos pesos da RPC get_community_leaderboard", () => {
    expect(LEADERBOARD_POINTS).toEqual({
      paper: 10,
      voteReceived: 2,
      solution: 5,
      mentorship: 15,
      post: 1,
    });
  });

  it("soma os pontos", () => {
    expect(
      computeLeaderboardPoints({
        papers: 1,
        votes_received: 3,
        solutions: 2,
        mentorships: 1,
        posts: 4,
      }),
    ).toBe(10 + 6 + 10 + 15 + 4);
    expect(
      computeLeaderboardPoints({
        papers: 0,
        votes_received: 0,
        solutions: 0,
        mentorships: 0,
        posts: 0,
      }),
    ).toBe(0);
  });

  it("tem uma regra explicada para cada tipo de ponto", () => {
    expect(LEADERBOARD_RULES.map((r) => r.key).sort()).toEqual(
      Object.keys(LEADERBOARD_POINTS).sort(),
    );
    for (const rule of LEADERBOARD_RULES) expect(rule.points).toBe(LEADERBOARD_POINTS[rule.key]);
  });

  it("formata em pt-BR", () => {
    expect(formatPoints(1)).toBe("1 ponto");
    expect(formatPoints(1500)).toBe("1.500 pontos");
  });
});
