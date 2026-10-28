import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ANSWER_PII_MESSAGE, QUESTION_PII_MESSAGE } from "./pii";
import {
  answerSchema,
  charLength,
  hideAnswerSchema,
  QUESTION_LENGTH_MESSAGE,
  questionSchema,
  readAnswerForm,
  readQuestionForm,
  reviewSchema,
} from "./schemas";

const QUESTION = "Como é o dia a dia de uma pesquisadora de computação?";
const ID = "e3000000-0000-4000-8000-000000000001";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("questionSchema", () => {
  it("aceita pergunta válida, sem etapa e sem área", () => {
    const parsed = questionSchema.parse({ body: `  ${QUESTION}  `, stage: "", areaId: "" });
    expect(parsed).toEqual({ body: QUESTION, stage: undefined, areaId: undefined });
  });

  it("converte etapa e área", () => {
    const parsed = questionSchema.parse({ body: QUESTION, stage: "graduacao", areaId: "3" });
    expect(parsed.stage).toBe("graduacao");
    expect(parsed.areaId).toBe(3);
  });

  it("recusa tamanho fora de 30–800 com a mesma mensagem do banco (CD042)", () => {
    for (const body of ["Curta?", "a".repeat(801), " ".repeat(50)]) {
      const result = questionSchema.safeParse({ body, stage: "", areaId: "" });
      expect(result.success).toBe(false);
      expect(z.flattenError(result.error!).fieldErrors.body).toEqual([QUESTION_LENGTH_MESSAGE]);
    }
    expect(QUESTION_LENGTH_MESSAGE).toBe("Sua pergunta precisa ter entre 30 e 800 caracteres.");
  });

  it("conta caracteres como o Postgres (emoji conta 1)", () => {
    expect(charLength("ciência")).toBe(7);
    expect(charLength("\u{1F52C}")).toBe(1);
    const body = "\u{1F52C}".repeat(800);
    expect(questionSchema.safeParse({ body, stage: "", areaId: "" }).success).toBe(true);
  });

  it("recusa dados pessoais com a mesma mensagem do banco (CD041)", () => {
    const result = questionSchema.safeParse({
      body: `${QUESTION} Meu zap é (12) 99876-5432.`,
      stage: "",
      areaId: "",
    });
    expect(result.success).toBe(false);
    expect(z.flattenError(result.error!).fieldErrors.body).toContain(QUESTION_PII_MESSAGE);
  });

  it("recusa etapa e área fora da lista", () => {
    const result = questionSchema.safeParse({ body: QUESTION, stage: "doutorado", areaId: "-1" });
    expect(result.success).toBe(false);
    const errors = z.flattenError(result.error!).fieldErrors;
    expect(errors.stage?.[0]).toMatch(/etapa/);
    expect(errors.areaId?.[0]).toMatch(/áreas/);
  });

  it("lê o formulário sem perder o texto", () => {
    expect(readQuestionForm(form({ body: QUESTION, stage: "outro", areaId: "2" }))).toEqual({
      body: QUESTION,
      stage: "outro",
      areaId: "2",
    });
    expect(readQuestionForm(new FormData())).toEqual({ body: "", stage: "", areaId: "" });
  });
});

describe("answerSchema", () => {
  const BODY = "Comece pelos clubes de ciências da sua escola e converse com as professoras.";

  it("aceita resposta com link de site oficial", () => {
    const parsed = answerSchema.parse({
      questionId: ID,
      body: `${BODY} Veja https://www.gov.br`,
      showIdentity: false,
    });
    expect(parsed.body).toContain("https://www.gov.br");
  });

  it("recusa contato (CD047) e tamanho", () => {
    const pii = answerSchema.safeParse({
      questionId: ID,
      body: `${BODY} Me chama no @ana_sci`,
      showIdentity: true,
    });
    expect(z.flattenError(pii.error!).fieldErrors.body).toContain(ANSWER_PII_MESSAGE);
    const short = answerSchema.safeParse({ questionId: ID, body: "Oi!", showIdentity: true });
    expect(z.flattenError(short.error!).fieldErrors.body?.[0]).toMatch(/entre 20 e 3\.000/);
  });

  it("checkbox de identidade desmarcado por padrão", () => {
    expect(readAnswerForm(form({ questionId: ID, body: BODY }))).toEqual({
      questionId: ID,
      body: BODY,
      showIdentity: false,
    });
    expect(
      readAnswerForm(form({ questionId: ID, body: BODY, showIdentity: "on" })).showIdentity,
    ).toBe(true);
  });
});

describe("moderação", () => {
  it("publicar não pede motivo; não publicar exige um da lista", () => {
    expect(
      reviewSchema.safeParse({ questionId: ID, decision: "publish", reason: "" }).success,
    ).toBe(true);
    const missing = reviewSchema.safeParse({ questionId: ID, decision: "reject", reason: "" });
    expect(z.flattenError(missing.error!).fieldErrors.reason?.[0]).toBe(
      "Escolha o motivo para não publicar a pergunta.",
    );
    expect(
      reviewSchema.safeParse({ questionId: ID, decision: "reject", reason: "chata" }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ questionId: ID, decision: "reject", reason: "duplicada" }).success,
    ).toBe(true);
    expect(reviewSchema.safeParse({ questionId: "x", decision: "publish" }).success).toBe(false);
  });

  it("ocultar resposta: motivo opcional até 500 caracteres", () => {
    expect(hideAnswerSchema.safeParse({ answerId: ID, hidden: true, reason: "" }).success).toBe(
      true,
    );
    expect(
      hideAnswerSchema.safeParse({ answerId: ID, hidden: true, reason: "a".repeat(501) }).success,
    ).toBe(false);
  });
});
