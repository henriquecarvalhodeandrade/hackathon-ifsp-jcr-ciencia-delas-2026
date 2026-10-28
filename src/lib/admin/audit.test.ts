import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  appendToResolutionNote,
  auditTargetHref,
  cleanAuditReason,
  isAuditAction,
  isAuditTargetType,
} from "./audit";

describe("ações do registro de auditoria", () => {
  it("tem rótulo pt-BR para todas as ações aceitas pelo banco", () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/\S/);
    expect(AUDIT_ACTIONS).toHaveLength(11);
  });

  it("reconhece só ações e alvos conhecidos", () => {
    expect(isAuditAction("reveal_author")).toBe(true);
    expect(isAuditAction("apagar_tudo")).toBe(false);
    expect(isAuditAction(null)).toBe(false);
    expect(isAuditTargetType("paper_comment")).toBe(true);
    expect(isAuditTargetType("user")).toBe(false);
  });
});

describe("auditTargetHref", () => {
  it("leva às páginas que existem", () => {
    expect(auditTargetHref("thread", "t1")).toBe("/forum/t/t1");
    expect(auditTargetHref("paper", "p1")).toBe("/papers/p1");
    expect(auditTargetHref("profile", "u1")).toBe("/pesquisadoras/u1");
  });

  it("sem link para respostas, comentários, denúncias ou alvo ausente", () => {
    expect(auditTargetHref("post", "x")).toBeNull();
    expect(auditTargetHref("paper_comment", "x")).toBeNull();
    expect(auditTargetHref("report", "x")).toBeNull();
    expect(auditTargetHref(null, "x")).toBeNull();
    expect(auditTargetHref("thread", null)).toBeNull();
  });
});

describe("cleanAuditReason", () => {
  it("normaliza espaços e trata vazio como ausente", () => {
    expect(cleanAuditReason("  ameaça\nexplícita  ")).toBe("ameaça explícita");
    expect(cleanAuditReason("   ")).toBeNull();
    expect(cleanAuditReason(undefined)).toBeNull();
  });

  it("corta no limite da coluna", () => {
    const cut = cleanAuditReason("a".repeat(600))!;
    expect(cut).toHaveLength(500);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("appendToResolutionNote", () => {
  it("acrescenta numa linha nova, sem repetir a mesma frase", () => {
    expect(appendToResolutionNote(null, "Conteúdo excluído.")).toBe("Conteúdo excluído.");
    expect(appendToResolutionNote("Em análise.", "Conteúdo excluído.")).toBe(
      "Em análise.\nConteúdo excluído.",
    );
    expect(appendToResolutionNote("Conteúdo excluído.", "Conteúdo excluído.")).toBe(
      "Conteúdo excluído.",
    );
    expect(appendToResolutionNote("  ", "  ")).toBeNull();
  });

  it("respeita o limite de caracteres", () => {
    const merged = appendToResolutionNote("a".repeat(990), "Conteúdo excluído pela moderação.")!;
    expect(merged.length).toBeLessThanOrEqual(1000);
    expect(merged.endsWith("…")).toBe(true);
  });
});
