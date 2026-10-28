import { describe, expect, it } from "vitest";
import { parseAdminTab, parsePage, parseReportStatus, parseRoleFilter, parseSearch } from "./params";

describe("parâmetros do painel", () => {
  it("aba: newsletter só para quem pode ver; padrão denúncias", () => {
    expect(parseAdminTab("membros", { canSeeNewsletter: false })).toBe("membros");
    expect(parseAdminTab("newsletter", { canSeeNewsletter: true })).toBe("newsletter");
    expect(parseAdminTab("newsletter", { canSeeNewsletter: false })).toBe("denuncias");
    expect(parseAdminTab(undefined, { canSeeNewsletter: true })).toBe("denuncias");
    expect(parseAdminTab(["membros"], { canSeeNewsletter: true })).toBe("membros");
    expect(parseAdminTab("registro", { canSeeNewsletter: false })).toBe("registro");
  });

  it("status das denúncias por slug pt-BR", () => {
    expect(parseReportStatus("resolvidas")).toBe("resolved");
    expect(parseReportStatus("arquivadas")).toBe("dismissed");
    expect(parseReportStatus("abertas")).toBe("open");
    expect(parseReportStatus("open")).toBe("open");
    expect(parseReportStatus(undefined)).toBe("open");
  });

  it("papel, página e busca", () => {
    expect(parseRoleFilter("admin")).toBe("admin");
    expect(parseRoleFilter("root")).toBeNull();
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("999999", 50)).toBe(50);
    expect(parseSearch("  Ana,(Maria)%_* ")).toBe("Ana Maria");
    expect(parseSearch("x".repeat(200)).length).toBe(80);
  });
});
