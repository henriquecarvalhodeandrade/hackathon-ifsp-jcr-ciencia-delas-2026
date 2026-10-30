import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TRAJECTORY_EXCLUDED,
  TRAJECTORY_FILTER_OPTIONS,
  TRAJECTORY_HELP,
  TRAJECTORY_MARKS,
  TRAJECTORY_MAX,
  TRAJECTORY_OPTIONS,
  TRAJECTORY_SLUGS,
  isTrajectorySlug,
  normalizeTrajectoryTags,
  refreshTrajectorySentence,
  sharedTrajectory,
  sharedTrajectorySentence,
  trajectoryChipLabels,
  withoutTrajectorySentence,
} from "./catalog";

const MIGRATION = fileURLToPath(
  new URL("../../../supabase/migrations/20261028190200_trajectory_affinity.sql", import.meta.url),
);

/** Listas `array['a', 'b', ...]` de um trecho SQL. */
function sqlArrays(sql: string): string[][] {
  return [...sql.matchAll(/array\[([^\]]*)\]/g)]
    .map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
    .filter((list) => list.length > 0);
}

describe("catálogo de trajetória", () => {
  it("tem 8 marcas com slugs únicos, em kebab-case, e textos preenchidos", () => {
    expect(TRAJECTORY_MARKS).toHaveLength(8);
    expect(TRAJECTORY_MAX).toBe(8);
    expect(new Set(TRAJECTORY_SLUGS).size).toBe(8);
    for (const mark of TRAJECTORY_MARKS) {
      expect(mark.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(mark.label.length).toBeGreaterThan(5);
      expect(mark.chip.length).toBeGreaterThan(5);
      expect(mark.chip.length).toBeLessThanOrEqual(36);
      expect(mark.shared).toMatch(/^as duas /);
    }
    expect(new Set(TRAJECTORY_MARKS.map((m) => m.chip)).size).toBe(8);
    expect(TRAJECTORY_OPTIONS.map((o) => o.value)).toEqual(TRAJECTORY_SLUGS);
    expect(TRAJECTORY_FILTER_OPTIONS.map((o) => o.label)).toEqual(
      TRAJECTORY_MARKS.map((m) => m.chip),
    );
  });

  it("segue a especificação (slugs e frases)", () => {
    expect(TRAJECTORY_SLUGS).toEqual([
      "primeira-geracao",
      "escola-publica",
      "ensino-tecnico",
      "mae-cuidadora",
      "trabalha-e-estuda",
      "retorno-aos-estudos",
      "mudanca-de-area",
      "fora-das-capitais",
    ]);
    expect(TRAJECTORY_MARKS[0]).toEqual({
      slug: "primeira-geracao",
      label: "Fui a primeira da família na universidade",
      chip: "Primeira da família na universidade",
      shared: "as duas foram as primeiras da família na universidade",
    });
  });

  it("é idêntico ao CHECK e à função de normalização da migration", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const checkStart = sql.indexOf("profiles_trajectory_tags_catalog check");
    const fnStart = sql.indexOf("create function private.profiles_normalize_trajectory");
    expect(checkStart).toBeGreaterThan(0);
    expect(fnStart).toBeGreaterThan(checkStart);
    const [checkList] = sqlArrays(sql.slice(checkStart, fnStart));
    const [fnList] = sqlArrays(sql.slice(fnStart));
    expect(checkList).toEqual([...TRAJECTORY_SLUGS]);
    expect(fnList).toEqual([...TRAJECTORY_SLUGS]);
    expect(sql).toMatch(new RegExp(`cardinality\\(trajectory_tags\\) <= ${TRAJECTORY_MAX}`));
    expect(sql).toContain("errcode = 'CD050'");
  });

  it("não pede dados sensíveis (art. 11 da LGPD) nem renda", () => {
    expect(TRAJECTORY_EXCLUDED).toEqual(
      expect.arrayContaining(["raça ou etnia", "religião", "renda", "orientação sexual"]),
    );
    const text = TRAJECTORY_MARKS.flatMap((m) => [m.slug, m.label, m.chip, m.shared])
      .join(" ")
      .toLowerCase();
    for (const word of [
      "raça",
      "etnia",
      "negra",
      "indígena",
      "religi",
      "saúde",
      "deficiên",
      "lgbt",
      "trans",
      "orientação",
      "renda",
      "pobre",
      "baixa renda",
    ]) {
      expect(text).not.toContain(word);
    }
    expect(TRAJECTORY_HELP).toMatch(/^Opcional\./);
    expect(TRAJECTORY_HELP).toContain("Só membras da Artemis veem");
  });
});

describe("utilidades", () => {
  it("isTrajectorySlug só aceita marcas do catálogo", () => {
    expect(isTrajectorySlug("primeira-geracao")).toBe(true);
    expect(isTrajectorySlug("Primeira-Geracao")).toBe(false);
    expect(isTrajectorySlug("raca")).toBe(false);
    expect(isTrajectorySlug(null)).toBe(false);
  });

  it("normaliza: só do catálogo, sem repetição, na ordem do catálogo", () => {
    expect(
      normalizeTrajectoryTags([
        "fora-das-capitais",
        "x",
        null,
        "primeira-geracao",
        "x",
        "fora-das-capitais",
      ]),
    ).toEqual(["primeira-geracao", "fora-das-capitais"]);
    expect(normalizeTrajectoryTags(null)).toEqual([]);
  });

  it("sharedTrajectory devolve a interseção na ordem do catálogo", () => {
    expect(
      sharedTrajectory(["mae-cuidadora", "escola-publica"], ["escola-publica", "mae-cuidadora"]),
    ).toEqual(["escola-publica", "mae-cuidadora"]);
    expect(sharedTrajectory(["escola-publica"], [])).toEqual([]);
    expect(sharedTrajectory(undefined, ["escola-publica"])).toEqual([]);
  });

  it("monta a frase 'Vocês têm em comum' com até 2 marcas", () => {
    expect(sharedTrajectorySentence(["primeira-geracao"])).toBe(
      "Vocês têm em comum: as duas foram as primeiras da família na universidade.",
    );
    expect(
      sharedTrajectorySentence(["retorno-aos-estudos", "mae-cuidadora", "escola-publica"]),
    ).toBe(
      "Vocês têm em comum: as duas estudaram em escola pública e conciliam (ou conciliaram) pesquisa e cuidado.",
    );
    expect(sharedTrajectorySentence(["mae-cuidadora", "retorno-aos-estudos", "x"], 3)).toBe(
      "Vocês têm em comum: as duas conciliam (ou conciliaram) pesquisa e cuidado e voltaram a estudar depois de uma pausa.",
    );
    expect(sharedTrajectorySentence([])).toBeNull();
    expect(sharedTrajectorySentence(["inventada"])).toBeNull();
  });

  it("rótulos curtos dos chips na ordem do catálogo", () => {
    expect(trajectoryChipLabels(["ensino-tecnico", "primeira-geracao"])).toEqual([
      "Primeira da família na universidade",
      "Ensino técnico",
    ]);
  });
});

describe("frase de trajetória em motivos já salvos", () => {
  const saved =
    "Ela atua na mesma grande área que você (Ciências Exatas e da Terra). Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em escola pública.";

  it("withoutTrajectorySentence tira a frase (e só ela)", () => {
    expect(withoutTrajectorySentence(saved)).toBe(
      "Ela atua na mesma grande área que você (Ciências Exatas e da Terra).",
    );
    expect(
      withoutTrajectorySentence(
        "Vocês têm em comum: as duas conciliam (ou conciliaram) pesquisa e cuidado. Tem 1 vaga aberta.",
      ),
    ).toBe("Tem 1 vaga aberta.");
    expect(withoutTrajectorySentence("Vocês compartilham a área de Ecologia.")).toBe(
      "Vocês compartilham a área de Ecologia.",
    );
  });

  it("refreshTrajectorySentence troca pelas marcas de agora ou tira", () => {
    expect(refreshTrajectorySentence(saved, ["escola-publica"])).toBe(
      "Ela atua na mesma grande área que você (Ciências Exatas e da Terra). Vocês têm em comum: as duas estudaram em escola pública.",
    );
    expect(refreshTrajectorySentence(saved, [])).toBe(
      "Ela atua na mesma grande área que você (Ciências Exatas e da Terra).",
    );
    expect(refreshTrajectorySentence(saved, ["primeira-geracao", "escola-publica"])).toBe(saved);
    // Sem frase de trajetória no texto (ex.: motivo escrito pela IA): nada muda.
    expect(refreshTrajectorySentence("Ela orienta em editais.", ["escola-publica"])).toBe(
      "Ela orienta em editais.",
    );
  });
});
