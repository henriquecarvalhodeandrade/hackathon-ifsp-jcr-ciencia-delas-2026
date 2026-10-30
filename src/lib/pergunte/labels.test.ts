import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_SCIENTIST,
  answerCountLabel,
  answerIdentityLine,
  isQuestionStage,
  isRejectReason,
  QUESTION_STAGES,
  questionExcerpt,
  splitQuestion,
  questionHeadline,
  REJECT_REASON_LABELS,
  REJECT_REASON_TEXTS,
  REJECT_REASONS,
  STAGE_LABELS,
  STAGE_OPTIONS,
} from "./labels";

describe("etapas de quem pergunta", () => {
  it("rótulos pt-BR para as três etapas do banco", () => {
    expect(STAGE_LABELS).toEqual({
      ensino_medio_tecnico: "Ensino médio ou técnico",
      graduacao: "Graduação",
      outro: "Outro",
    });
    expect(STAGE_OPTIONS.map((o) => o.value)).toEqual([...QUESTION_STAGES]);
    expect(isQuestionStage("graduacao")).toBe(true);
    expect(isQuestionStage("doutorado")).toBe(false);
  });
});

describe("motivos para não publicar", () => {
  it("texto acolhedor para quem perguntou", () => {
    expect(REJECT_REASON_TEXTS).toEqual({
      fora_do_tema: "Esta pergunta não é sobre ciência ou carreira científica.",
      dados_pessoais:
        "Ela tinha informações que poderiam identificar você. Envie de novo sem elas.",
      conteudo_improprio: "Ela não segue o código de conduta da Artemis.",
      duplicada: "Uma pergunta parecida já foi respondida. Dê uma olhada na lista.",
    });
  });

  it("rótulos da moderação iguais aos que o banco grava no registro", () => {
    expect(REJECT_REASON_LABELS).toEqual({
      fora_do_tema: "Fora do tema",
      dados_pessoais: "Dados pessoais",
      conteudo_improprio: "Conteúdo impróprio",
      duplicada: "Pergunta duplicada",
    });
    for (const reason of REJECT_REASONS) expect(isRejectReason(reason)).toBe(true);
    expect(isRejectReason("chata")).toBe(false);
  });
});

describe("respostas", () => {
  it("contagem", () => {
    expect(answerCountLabel(0)).toBe("Sem respostas ainda");
    expect(answerCountLabel(1)).toBe("1 resposta");
    expect(answerCountLabel(3)).toBe("3 respostas");
  });

  it("identidade só quando a autora escolheu mostrar", () => {
    expect(answerIdentityLine({ name: null, stage: null, isMentor: null })).toBe(
      ANONYMOUS_SCIENTIST,
    );
    expect(answerIdentityLine({ name: "  ", stage: "phd", isMentor: true })).toBe(
      "Uma cientista da rede",
    );
    expect(
      answerIdentityLine({ name: "Marina Albuquerque", stage: "professor", isMentor: true }),
    ).toBe("Marina Albuquerque · Mentora · Docente");
    expect(answerIdentityLine({ name: "Bia", stage: "undergraduate", isMentor: false })).toBe(
      "Bia · Graduação",
    );
    expect(answerIdentityLine({ name: "Bia", stage: null, isMentor: false })).toBe("Bia");
  });
});

describe("títulos e trechos", () => {
  it("título: primeira frase, sem a marca de demonstração", () => {
    expect(
      questionHeadline(
        "Preciso ser muito boa em matemática para fazer pesquisa em biologia? Adoro biologia. (pergunta fictícia de demonstração)",
      ),
    ).toBe("Preciso ser muito boa em matemática para fazer pesquisa em biologia?");
    expect(questionHeadline("Uma pergunta sem pontuação final que segue")).toBe(
      "Uma pergunta sem pontuação final que segue",
    );
    expect(questionHeadline("a ".repeat(100), 20).length).toBeLessThanOrEqual(20);
  });

  it("cartão: primeira frase no título, o resto (com a marca de demonstração) no apoio", () => {
    expect(
      splitQuestion(
        "Dá para começar no técnico?  Ou preciso esperar? (pergunta fictícia de demonstração)",
      ),
    ).toEqual({
      headline: "Dá para começar no técnico?",
      rest: "Ou preciso esperar? (pergunta fictícia de demonstração)",
    });
    expect(splitQuestion("Pergunta sem ponto final nenhum aqui")).toEqual({
      headline: "Pergunta sem ponto final nenhum aqui",
      rest: "",
    });
  });

  it("trecho normaliza espaços e corta", () => {
    expect(questionExcerpt("Linha 1\n\nLinha   2")).toBe("Linha 1 Linha 2");
    expect(questionExcerpt("palavra ".repeat(100), 50).endsWith("…")).toBe(true);
  });
});
