import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_TARGET_LABELS,
  AUDIT_TARGET_TYPES,
  appendToResolutionNote,
  auditTargetHref,
  cleanAuditReason,
  isAuditAction,
  isAuditTargetType,
} from "./audit";

describe("ações do registro de auditoria", () => {
  it("tem rótulo pt-BR para todas as ações aceitas pelo banco", () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/\S/);
    expect(AUDIT_ACTIONS).toHaveLength(15);
    for (const type of AUDIT_TARGET_TYPES) expect(AUDIT_TARGET_LABELS[type]).toMatch(/\S/);
  });

  it("inclui as ações e os alvos do Pergunte a uma cientista", () => {
    expect(AUDIT_ACTION_LABELS.publish_question).toBe("publicou a pergunta");
    expect(AUDIT_ACTION_LABELS.reject_question).toBe("não publicou a pergunta");
    expect(AUDIT_ACTION_LABELS.hide_answer).toBe("ocultou a resposta");
    expect(AUDIT_ACTION_LABELS.unhide_answer).toBe("reexibiu a resposta");
    expect(AUDIT_TARGET_LABELS.public_question).toBe("Pergunta pública");
    expect(AUDIT_TARGET_LABELS.public_answer).toBe("Resposta pública");
    expect(isAuditAction("publish_question")).toBe(true);
    expect(isAuditTargetType("public_answer")).toBe(true);
  });

  it("acompanha os CHECKs do banco (a última migration que repete cada lista)", () => {
    const migration = (file: string) =>
      readFileSync(
        fileURLToPath(new URL(`../../../supabase/migrations/${file}`, import.meta.url)),
        "utf8",
      );
    const list = (sql: string, constraint: string) => {
      const match = new RegExp(`add constraint ${constraint} check \\(\\w+ in \\(([^)]*)\\)`).exec(
        sql,
      );
      return [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    };
    expect(
      list(migration("20261028190100_public_questions.sql"), "moderation_audit_log_action_check"),
    ).toEqual([...AUDIT_ACTIONS]);
    expect(
      list(
        migration("20261029000500_moderacao_rede_social.sql"),
        "moderation_audit_log_target_type_check",
      ),
    ).toEqual([...AUDIT_TARGET_TYPES]);
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
    expect(auditTargetHref("public_question", "q1")).toBe("/pergunte/q1");
    expect(auditTargetHref("public_answer", "a1")).toBe("/admin?aba=perguntas");
    expect(auditTargetHref("feed_post", "f1")).toBe("/feed/p/f1");
    expect(auditTargetHref("opportunity", "o1")).toBe("/ics/o1");
  });

  it("sem link para respostas, comentários, denúncias ou alvo ausente", () => {
    expect(auditTargetHref("post", "x")).toBeNull();
    expect(auditTargetHref("paper_comment", "x")).toBeNull();
    expect(auditTargetHref("feed_comment", "x")).toBeNull();
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
