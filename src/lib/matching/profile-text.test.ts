import { describe, expect, it } from "vitest";
import {
  DOCUMENT_PREFIX,
  QUERY_PREFIX,
  buildProfileText,
  contentHash,
  embeddingInputFor,
  embeddingKindFor,
  profileEmbeddingHash,
} from "./profile-text";

const profile = {
  full_name: "Joana Exemplo Prado",
  headline: "Doutoranda em ecologia — veja https://joana.example.com ou @joanaprado",
  career_stage: "phd",
  keywords: ["Ecologia de florestas", "sensoriamento remoto", "ecologia de florestas"],
  mentorship_topics: ["bolsas-editais", "internacionalizacao"],
  mentoring_goals:
    "Sou a Joana e quero fazer doutorado sanduíche. Escreva para joana.prado@example.com ou (12) 99876-5432. Lattes: lattes.cnpq.br/123456",
  mentoring_offer: "Posso ajudar com estatística em R. ORCID 0000-0002-1825-0097",
  is_mentor: false,
};

describe("buildProfileText", () => {
  it("inclui apenas dados de pesquisa (etapa, áreas, palavras-chave, temas, objetivos)", () => {
    const text = buildProfileText(profile, ["Ecologia", "Geografia"]);
    expect(text).toContain("Etapa da carreira: Doutorado.");
    expect(text).toContain("Áreas de pesquisa: Ecologia; Geografia.");
    expect(text).toContain("Palavras-chave: Ecologia de florestas, sensoriamento remoto.");
    expect(text).toContain(
      "Temas de mentoria: Bolsas e editais; Intercâmbio e carreira internacional.",
    );
    expect(text).toContain("O que busca na mentoria:");
    expect(text).toContain("doutorado sanduíche");
  });

  it("não vaza nome, e-mail, telefone, links, @perfis nem ORCID", () => {
    const mentee = buildProfileText(profile, ["Ecologia"]);
    const mentor = buildProfileText({ ...profile, is_mentor: true }, ["Ecologia"]);
    for (const text of [mentee, mentor]) {
      expect(text).not.toMatch(/Joana/i);
      expect(text).not.toMatch(/Prado/i);
      expect(text).not.toContain("@");
      expect(text).not.toMatch(/https?:|www\.|example\.com|lattes\.cnpq/i);
      expect(text).not.toContain("99876");
      expect(text).not.toContain("0000-0002-1825-0097");
    }
  });

  it("mentoranda usa os objetivos; mentora usa a oferta", () => {
    const asMentee = buildProfileText(profile, []);
    const asMentor = buildProfileText({ ...profile, is_mentor: true }, []);
    expect(asMentee).toContain("O que busca na mentoria");
    expect(asMentee).not.toContain("Como pode ajudar");
    expect(asMentor).toContain("Como pode ajudar como mentora: Posso ajudar com estatística em R.");
    expect(asMentor).not.toContain("O que busca");
    expect(buildProfileText(profile, [], { role: "mentor" })).toContain("Como pode ajudar");
  });

  it("lida com perfil quase vazio", () => {
    expect(buildProfileText({ career_stage: null, keywords: null }, [])).toBe("");
  });
});

describe("prefixos de embedding", () => {
  it("mentora = documento, mentoranda = consulta", () => {
    expect(embeddingKindFor({ is_mentor: true })).toBe("document");
    expect(embeddingKindFor({ is_mentor: false })).toBe("query");
    expect(embeddingKindFor({})).toBe("query");
  });

  it("gemini-embedding-2 recebe os prefixos de tarefa no texto", () => {
    expect(DOCUMENT_PREFIX).toBe("title: none | text: ");
    expect(QUERY_PREFIX).toBe("task: search result | query: ");
    expect(embeddingInputFor("Ecologia  de\nflorestas", "document", "gemini-embedding-2")).toBe(
      "title: none | text: Ecologia de florestas",
    );
    expect(embeddingInputFor("Ecologia", "query", "gemini-embedding-2")).toBe(
      "task: search result | query: Ecologia",
    );
  });

  it("modelos antigos (taskType) recebem o texto sem prefixo", () => {
    expect(embeddingInputFor("Ecologia", "query", "gemini-embedding-001")).toBe("Ecologia");
  });
});

describe("hashes", () => {
  it("contentHash é SHA-256 em hexadecimal", async () => {
    expect(await contentHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("muda quando texto, tipo ou modelo mudam", async () => {
    const base = await profileEmbeddingHash("texto", "query", "gemini-embedding-2");
    expect(await profileEmbeddingHash("texto", "query", "gemini-embedding-2")).toBe(base);
    expect(await profileEmbeddingHash("texto!", "query", "gemini-embedding-2")).not.toBe(base);
    expect(await profileEmbeddingHash("texto", "document", "gemini-embedding-2")).not.toBe(base);
    expect(await profileEmbeddingHash("texto", "query", "gemini-embedding-3")).not.toBe(base);
  });
});
