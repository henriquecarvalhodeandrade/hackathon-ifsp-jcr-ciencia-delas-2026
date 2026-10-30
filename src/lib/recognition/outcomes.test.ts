import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_OUTCOMES,
  MENTEE_OUTCOMES,
  MENTOR_OUTCOMES,
  isKnownOutcome,
  isOutcomeFor,
  outcomeImpactLabel,
  outcomeLabel,
  outcomesFor,
} from "./outcomes";

const MIGRATION = path.resolve(
  __dirname,
  "../../../supabase/migrations/20261028190000_mentorship_recognition.sql",
);

/** Lê a lista de cada papel em `private.mentorship_outcomes()` na migration. */
function sqlCatalog(): Record<"mentee" | "mentor", string[]> {
  const sql = readFileSync(MIGRATION, "utf8");
  const fn = /create function private\.mentorship_outcomes\(p_role text\)[\s\S]*?\$\$;/.exec(sql);
  if (!fn) throw new Error("private.mentorship_outcomes não encontrada na migration");
  const list = (role: string) => {
    const match = new RegExp(`when '${role}' then array\\[([^\\]]*)\\]`).exec(fn[0]);
    if (!match) throw new Error(`lista de ${role} não encontrada`);
    return [...match[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
  };
  return { mentee: list("mentee"), mentor: list("mentor") };
}

describe("catálogo de resultados", () => {
  it("é idêntico ao do banco (mesmos slugs, mesma ordem)", () => {
    const sql = sqlCatalog();
    expect(MENTEE_OUTCOMES.map((o) => o.slug)).toEqual(sql.mentee);
    expect(MENTOR_OUTCOMES.map((o) => o.slug)).toEqual(sql.mentor);
  });

  it("tem os textos combinados com a equipe", () => {
    expect(outcomeLabel("menos-sozinha")).toBe("Me senti menos sozinha na pesquisa");
    expect(outcomeLabel("candidatura")).toBe(
      "Me candidatei a uma bolsa, edital ou processo seletivo",
    );
    expect(outcomeLabel("aprendi-tambem")).toBe("Também aprendi com a mentoranda");
    expect(outcomeLabel("quero-mentorar-mais")).toBe("Quero acompanhar outras pesquisadoras");
    expect(outcomeLabel("inventada")).toBeNull();
  });

  it("separa as opções por papel", () => {
    expect(outcomesFor("mentee")).toHaveLength(6);
    expect(outcomesFor("mentor")).toHaveLength(2);
    expect(isOutcomeFor("mentee", "plano-definido")).toBe(true);
    expect(isOutcomeFor("mentor", "plano-definido")).toBe(false);
    expect(isOutcomeFor("mentor", "aprendi-tambem")).toBe(true);
    expect(isKnownOutcome("aprendi-tambem")).toBe(true);
    expect(isKnownOutcome("<script>")).toBe(false);
  });

  it("o máximo de opções cabe na maior lista (CHECK do banco: 6)", () => {
    expect(MAX_OUTCOMES).toBe(6);
    expect(MENTEE_OUTCOMES.length).toBeLessThanOrEqual(MAX_OUTCOMES);
  });

  it("o impacto fala no plural e sem exagero", () => {
    for (const outcome of MENTEE_OUTCOMES) {
      expect(outcome.impactLabel).toBeTruthy();
      expect(outcome.impactLabel).not.toMatch(/todas|garant|comprov/i);
    }
    expect(outcomeImpactLabel("menos-sozinha")).toBe("Se sentiram menos sozinhas na pesquisa");
    expect(outcomeImpactLabel("aprendi-tambem")).toBe("Também aprendi com a mentoranda");
  });
});
