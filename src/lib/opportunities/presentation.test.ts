import { describe, expect, it } from "vitest";
import {
  canPublishOpportunities,
  canWithdraw,
  feedPostBody,
  opportunityKindLabel,
  ownerDecisionsFor,
} from "./labels";
import {
  addDays,
  addYears,
  applicationCountLabel,
  deadlineLabel,
  formatDeadlineDate,
  isDateOnly,
  isOpportunityOpen,
  locationLabel,
  missingCharsLabel,
  modalityLabel,
  opportunityState,
  parseNotice,
  todayInSaoPaulo,
  vacanciesLabel,
  weeklyHoursLabel,
} from "./presentation";

// 28/10/2026, 12h em São Paulo.
const NOW = new Date("2026-10-28T15:00:00Z");

describe("hoje em São Paulo", () => {
  it("usa o fuso de São Paulo, não o UTC", () => {
    // 02h30 UTC do dia 15 ainda é 23h30 do dia 14 em São Paulo.
    expect(todayInSaoPaulo(new Date("2026-11-15T02:30:00Z"))).toBe("2026-11-14");
    expect(todayInSaoPaulo(new Date("2026-11-15T03:30:00Z"))).toBe("2026-11-15");
    expect(todayInSaoPaulo(NOW)).toBe("2026-10-28");
  });

  it("datas AAAA-MM-DD", () => {
    expect(isDateOnly("2026-11-15")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("15/11/2026")).toBe(false);
    expect(isDateOnly("")).toBe(false);
    expect(isDateOnly(null)).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addYears("2026-10-28", 2)).toBe("2028-10-28");
  });
});

describe("prazo", () => {
  it("formata a data do prazo sem voltar um dia (coluna date)", () => {
    expect(formatDeadlineDate("2026-11-15", { now: NOW })).toBe("15 de nov.");
    expect(formatDeadlineDate("2027-01-05", { now: NOW })).toBe("5 de jan. de 2027");
    expect(formatDeadlineDate("2026-11-15", { now: NOW, long: true })).toBe(
      "15 de novembro de 2026",
    );
    expect(formatDeadlineDate("inválida", { now: NOW })).toBe("");
  });

  it("aberta até o fim do último dia em São Paulo", () => {
    const vaga = { status: "open", deadline: "2026-11-14" };
    // 23h30 do dia 14 em São Paulo: ainda aberta.
    expect(isOpportunityOpen(vaga, new Date("2026-11-15T02:30:00Z"))).toBe(true);
    // 00h30 do dia 15 em São Paulo: prazo vencido.
    expect(isOpportunityOpen(vaga, new Date("2026-11-15T03:30:00Z"))).toBe(false);
    expect(opportunityState(vaga, new Date("2026-11-15T03:30:00Z"))).toBe("expired");
  });

  it("encerrada pela dona ou sem prazo", () => {
    expect(opportunityState({ status: "closed", deadline: "2027-01-01" }, NOW)).toBe("closed");
    expect(opportunityState({ status: "open", deadline: null }, NOW)).toBe("open");
    expect(isOpportunityOpen({ status: "closed", deadline: null }, NOW)).toBe(false);
  });

  it("texto do prazo nos cartões", () => {
    expect(deadlineLabel({ status: "open", deadline: "2026-11-15" }, NOW)).toBe(
      "Inscrições até 15 de nov.",
    );
    expect(deadlineLabel({ status: "open", deadline: "2026-10-28" }, NOW)).toBe(
      "Inscrições até hoje",
    );
    expect(deadlineLabel({ status: "open", deadline: "2026-10-29" }, NOW)).toBe(
      "Inscrições até amanhã",
    );
    expect(deadlineLabel({ status: "open", deadline: null }, NOW)).toBe("Inscrições abertas");
    expect(deadlineLabel({ status: "open", deadline: "2026-10-27" }, NOW)).toBe("Encerrada");
    expect(deadlineLabel({ status: "closed", deadline: "2026-11-15" }, NOW)).toBe("Encerrada");
  });
});

describe("textos dos cartões", () => {
  it("modalidade, local, horas, vagas e candidaturas", () => {
    expect(modalityLabel("hybrid")).toBe("Híbrido");
    expect(modalityLabel("outra")).toBeNull();
    expect(locationLabel("São José dos Campos", "SP")).toBe("São José dos Campos · SP");
    expect(locationLabel("", "SP")).toBe("SP");
    expect(locationLabel(null, "XX")).toBe("");
    expect(weeklyHoursLabel(1)).toBe("1 hora por semana");
    expect(weeklyHoursLabel(12)).toBe("12 horas por semana");
    expect(weeklyHoursLabel(null)).toBeNull();
    expect(vacanciesLabel(1)).toBe("1 vaga");
    expect(vacanciesLabel(3)).toBe("3 vagas");
    expect(applicationCountLabel(0)).toBe("0 candidaturas");
    expect(applicationCountLabel(1)).toBe("1 candidatura");
  });
});

describe("rótulos e regras", () => {
  it("só do mestrado em diante publica vagas", () => {
    expect(canPublishOpportunities("masters")).toBe(true);
    expect(canPublishOpportunities("professor")).toBe(true);
    expect(canPublishOpportunities("industry")).toBe(true);
    expect(canPublishOpportunities("undergraduate")).toBe(false);
    expect(canPublishOpportunities("high_school")).toBe(false);
    expect(canPublishOpportunities(null)).toBe(false);
  });

  it("tipo da vaga e texto do feed", () => {
    expect(opportunityKindLabel("ic_junior")).toBe("IC Júnior (ensino médio)");
    expect(opportunityKindLabel("outro")).toBe("Oportunidade");
    expect(feedPostBody("ic", " Abelhas nativas do Vale ")).toBe(
      "Abri uma vaga de iniciação científica: Abelhas nativas do Vale. As candidaturas são pela Artemis!",
    );
    expect(feedPostBody("tcc", "Grafeno")).toContain("vaga de TCC: Grafeno.");
  });

  it("desistir e decisões da dona", () => {
    expect(canWithdraw("submitted")).toBe(true);
    expect(canWithdraw("in_review")).toBe(true);
    expect(canWithdraw("accepted")).toBe(false);
    expect(canWithdraw("withdrawn")).toBe(false);
    expect(ownerDecisionsFor("submitted")).toEqual(["in_review", "accepted", "declined"]);
    expect(ownerDecisionsFor("in_review")).toEqual(["accepted", "declined"]);
    expect(ownerDecisionsFor("accepted")).toEqual(["in_review", "declined"]);
    expect(ownerDecisionsFor("withdrawn")).toEqual([]);
  });
});

describe("avisos (?aviso=)", () => {
  it("só chaves conhecidas", () => {
    expect(parseNotice("publicada")?.variant).toBe("success");
    expect(parseNotice(["publicada-sem-feed"])?.variant).toBe("info");
    expect(parseNotice("removida")?.message).toBe("Vaga excluída.");
    expect(parseNotice("<script>")).toBeNull();
    expect(parseNotice("toString")).toBeNull();
    expect(parseNotice(undefined)).toBeNull();
  });
});

describe("ajuda do mínimo de caracteres", () => {
  it("conta o que falta e some no mínimo (ou com o campo vazio)", () => {
    expect(missingCharsLabel(0, 30)).toBeNull();
    expect(missingCharsLabel(20, 30)).toBe("Faltam 10 caracteres");
    expect(missingCharsLabel(29, 30)).toBe("Falta 1 caractere");
    expect(missingCharsLabel(30, 30)).toBeNull();
    expect(missingCharsLabel(400, 30)).toBeNull();
  });
});
