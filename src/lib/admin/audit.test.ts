import { describe, expect, it } from "vitest";
import { AUDIT_PREFIX, appendAuditLine, buildAuditLine, mergeResolutionNote, splitResolutionNote } from "./audit";

const AT = new Date("2026-10-27T17:05:00Z"); // 14:05 em São Paulo

describe("buildAuditLine", () => {
  it("monta a linha com data local, autora, ação e motivo", () => {
    const line = buildAuditLine({
      actorName: "  Helena   Duarte ",
      action: "revelou a autoria do tópico",
      reason: "ameaça\nexplícita a outra membra",
      at: AT,
    });
    expect(line.startsWith(AUDIT_PREFIX)).toBe(true);
    expect(line).toContain("27/10/2026");
    expect(line).toContain("14:05");
    expect(line).toContain("Helena Duarte: revelou a autoria do tópico.");
    expect(line).toContain("Motivo: ameaça explícita a outra membra");
    expect(line).not.toContain("\n");
  });
});

describe("splitResolutionNote / mergeResolutionNote", () => {
  const audit = `${AUDIT_PREFIX} 27/10/2026, 14:05 — Helena: revelou a autoria. Motivo: x`;

  it("separa texto livre das linhas de auditoria", () => {
    expect(splitResolutionNote(`Spam confirmado.\n\n${audit}`)).toEqual({ audit: [audit], text: "Spam confirmado." });
    expect(splitResolutionNote(null)).toEqual({ audit: [], text: "" });
  });

  it("substitui o texto livre e preserva a auditoria no fim", () => {
    expect(mergeResolutionNote(`Nota antiga\n\n${audit}`, "Resolvido: conteúdo removido.")).toBe(
      `Resolvido: conteúdo removido.\n\n${audit}`,
    );
    expect(mergeResolutionNote(null, "  ")).toBeNull();
    expect(mergeResolutionNote(audit, "")).toBe(audit);
  });

  it("respeita o limite de caracteres cortando o texto livre", () => {
    const merged = mergeResolutionNote(audit, "a".repeat(2000), 200)!;
    expect(merged.length).toBeLessThanOrEqual(200);
    expect(merged.endsWith(audit)).toBe(true);
    expect(merged).toContain("…");
  });
});

describe("appendAuditLine", () => {
  it("acrescenta mantendo o texto e as linhas anteriores", () => {
    const first = appendAuditLine("Em análise.", `${AUDIT_PREFIX} um`);
    const second = appendAuditLine(first, `${AUDIT_PREFIX} dois`);
    expect(second).toBe(`Em análise.\n\n${AUDIT_PREFIX} um\n${AUDIT_PREFIX} dois`);
  });

  it("descarta as linhas mais antigas quando estoura o limite", () => {
    const long = `${AUDIT_PREFIX} ${"x".repeat(60)}`;
    let note: string | null = null;
    for (let i = 0; i < 5; i++) note = appendAuditLine(note, `${long}${i}`, 150);
    expect(note!.length).toBeLessThanOrEqual(150);
    expect(note).toContain(`${long}4`);
    expect(note).not.toContain(`${long}0`);
  });
});
