import { describe, expect, it } from "vitest";
import {
  EMPTY_OPPORTUNITY_VALUES,
  applySchema,
  newOpportunityValues,
  opportunityToFormValues,
  readOpportunityForm,
  respondSchema,
  statusSchema,
  validateOpportunityForm,
  withdrawSchema,
  type OpportunityFormValues,
} from "./schema";

// 28/10/2026, 12h em São Paulo.
const NOW = new Date("2026-10-28T15:00:00Z");
const ID = "b1000000-0000-4000-8000-000000000001";
const OTHER_ID = "b1000000-0000-4000-8000-000000000002";

const VALID: OpportunityFormValues = {
  ...EMPTY_OPPORTUNITY_VALUES,
  title: "Abelhas nativas e polinização no Vale do Paraíba",
  kind: "ic",
  description:
    "Projeto de iniciação científica sobre abelhas sem ferrão: coleta em campo, identificação e análise de dados.",
  requirements: "",
  area_id: "12",
  keywords: ["Abelhas", "polinização", "abelhas"],
  institution: "  IFSP Jacareí ",
  city: "Jacareí",
  state: "sp",
  modality: "hybrid",
  has_scholarship: true,
  scholarship_info: "PIBIC/CNPq, R$ 700 por mês",
  weekly_hours: "12",
  vacancies: "2",
  target_stages: ["undergraduate", "high_school", "undergraduate"],
  deadline: "2026-11-15",
};

describe("vaga", () => {
  it("normaliza e converte os campos", () => {
    const result = validateOpportunityForm(VALID, { now: NOW });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      title: VALID.title,
      kind: "ic",
      description: VALID.description,
      requirements: null,
      area_id: 12,
      keywords: ["abelhas", "polinização"],
      institution: "IFSP Jacareí",
      city: "Jacareí",
      state: "SP",
      modality: "hybrid",
      has_scholarship: true,
      scholarship_info: "PIBIC/CNPq, R$ 700 por mês",
      weekly_hours: 12,
      vacancies: 2,
      target_stages: ["undergraduate", "high_school"],
      deadline: "2026-11-15",
    });
    // "Compartilhar no feed" não vai para a tabela.
    expect(result.data).not.toHaveProperty("share_to_feed");
  });

  it("campos opcionais vazios viram null; sem bolsa, os detalhes da bolsa somem", () => {
    const result = validateOpportunityForm(
      {
        ...VALID,
        area_id: "",
        institution: "",
        city: " ",
        state: "",
        weekly_hours: "",
        deadline: "",
        has_scholarship: false,
        scholarship_info: "texto esquecido",
      },
      { now: NOW },
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      area_id: null,
      institution: null,
      city: null,
      state: null,
      weekly_hours: null,
      deadline: null,
      has_scholarship: false,
      scholarship_info: null,
    });
  });

  it("aponta cada campo inválido", () => {
    const result = validateOpportunityForm(
      {
        ...VALID,
        title: "IC",
        kind: "estagio",
        description: "curta",
        area_id: "abc",
        keywords: Array.from({ length: 11 }, (_, i) => `palavra ${i}`),
        state: "XX",
        modality: "remoto",
        weekly_hours: "41",
        vacancies: "0",
        target_stages: [],
        deadline: "15/11/2026",
      },
      { now: NOW },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      [
        "area_id",
        "deadline",
        "description",
        "keywords",
        "kind",
        "modality",
        "state",
        "target_stages",
        "title",
        "vacancies",
        "weekly_hours",
      ].sort(),
    );
    expect(result.fieldErrors.target_stages?.[0]).toMatch(/pelo menos uma etapa/);
  });

  it("conta quebras de linha CRLF como um caractere", () => {
    // 4.000 caracteres com LF (o contador do campo), 4.001 com CRLF.
    const description = `${"a".repeat(1999)}\r\n${"b".repeat(2000)}`;
    const result = validateOpportunityForm({ ...VALID, description }, { now: NOW });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toHaveLength(4000);
  });

  it("prazo: hoje ou no futuro, até 2 anos", () => {
    const at = (deadline: string, currentDeadline?: string | null) =>
      validateOpportunityForm({ ...VALID, deadline }, { now: NOW, currentDeadline });
    expect(at("2026-10-28").success).toBe(true);
    expect(at("2028-10-28").success).toBe(true);
    const past = at("2026-10-27");
    expect(past.success).toBe(false);
    if (!past.success) expect(past.fieldErrors.deadline?.[0]).toMatch(/passado/);
    const far = at("2028-10-29");
    expect(far.success).toBe(false);
    if (!far.success)
      expect(far.fieldErrors.deadline?.[0]).toBe("Escolha um prazo até 28 de outubro de 2028.");
    expect(at("2026-02-30").success).toBe(false);
  });

  it("na edição, manter um prazo já vencido é permitido; trocar por outro vencido, não", () => {
    const keep = validateOpportunityForm(
      { ...VALID, deadline: "2026-09-01" },
      { now: NOW, currentDeadline: "2026-09-01" },
    );
    expect(keep.success).toBe(true);
    const change = validateOpportunityForm(
      { ...VALID, deadline: "2026-09-02" },
      { now: NOW, currentDeadline: "2026-09-01" },
    );
    expect(change.success).toBe(false);
  });

  it("lê o formulário (palavras-chave, etapas e caixas de seleção)", () => {
    const formData = new FormData();
    formData.set("title", "Título");
    formData.append("keywords", "a");
    formData.append("keywords", "b");
    formData.append("target_stages", "undergraduate");
    formData.append("target_stages", "masters");
    formData.set("has_scholarship", "on");
    const values = readOpportunityForm(formData);
    expect(values.title).toBe("Título");
    expect(values.keywords).toEqual(["a", "b"]);
    expect(values.target_stages).toEqual(["undergraduate", "masters"]);
    expect(values.has_scholarship).toBe(true);
    expect(values.share_to_feed).toBe(false);
    expect(values.deadline).toBe("");
  });

  it("valores iniciais vêm do perfil e da linha do banco", () => {
    expect(
      newOpportunityValues({ institution: "INPE", city: "São José dos Campos", state: "SP" }),
    ).toMatchObject({
      institution: "INPE",
      city: "São José dos Campos",
      state: "SP",
      target_stages: ["undergraduate"],
      share_to_feed: true,
    });
    expect(newOpportunityValues({ institution: null, city: null, state: "XX" }).state).toBe("");

    const values = opportunityToFormValues({
      title: "T",
      kind: "tcc",
      description: "D",
      requirements: null,
      area_id: null,
      keywords: ["k"],
      institution: null,
      city: null,
      state: "RJ",
      modality: "online",
      has_scholarship: false,
      scholarship_info: null,
      weekly_hours: 8,
      vacancies: 3,
      target_stages: ["undergraduate"],
      deadline: null,
    });
    expect(values).toMatchObject({
      requirements: "",
      area_id: "",
      weekly_hours: "8",
      vacancies: "3",
      deadline: "",
      share_to_feed: false,
    });
  });
});

describe("candidaturas", () => {
  it("carta de apresentação: 30 a 2.000 caracteres", () => {
    expect(applySchema.safeParse({ opportunity_id: ID, message: "Quero muito!" }).success).toBe(
      false,
    );
    expect(applySchema.safeParse({ opportunity_id: ID, message: "x".repeat(2001) }).success).toBe(
      false,
    );
    const ok = applySchema.safeParse({
      opportunity_id: ID,
      message: "  Olá! Curso Biologia no 3º semestre\r\ne adoro abelhas.  ",
    });
    expect(ok.success).toBe(true);
    if (ok.success)
      expect(ok.data.message).toBe("Olá! Curso Biologia no 3º semestre\ne adoro abelhas.");
    expect(applySchema.safeParse({ opportunity_id: "x", message: "y".repeat(40) }).success).toBe(
      false,
    );
  });

  it("resposta da dona: decisão conhecida e recado opcional", () => {
    const ok = respondSchema.safeParse({
      application_id: ID,
      opportunity_id: OTHER_ID,
      decision: "accepted",
      owner_note: "  ",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.owner_note).toBeNull();
    expect(
      respondSchema.safeParse({
        application_id: ID,
        opportunity_id: OTHER_ID,
        decision: "withdrawn",
        owner_note: "",
      }).success,
    ).toBe(false);
    expect(
      respondSchema.safeParse({
        application_id: ID,
        opportunity_id: OTHER_ID,
        decision: "declined",
        owner_note: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("desistir e encerrar/reabrir", () => {
    expect(withdrawSchema.safeParse({ application_id: ID, opportunity_id: OTHER_ID }).success).toBe(
      true,
    );
    expect(statusSchema.safeParse({ opportunity_id: ID, status: "closed" }).success).toBe(true);
    expect(statusSchema.safeParse({ opportunity_id: ID, status: "deleted" }).success).toBe(false);
  });
});
