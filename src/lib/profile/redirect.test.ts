import { describe, expect, it } from "vitest";
import { safeNextPath, withNext } from "./redirect";

describe("safeNextPath", () => {
  it("aceita caminhos internos com query e hash", () => {
    expect(safeNextPath("/forum")).toBe("/forum");
    expect(safeNextPath("/forum/t/123?x=1#resposta")).toBe("/forum/t/123?x=1#resposta");
    expect(safeNextPath("  /mentoria?mentora=abc  ")).toBe("/mentoria?mentora=abc");
  });

  it("recusa URLs absolutas e protocolos perigosos", () => {
    expect(safeNextPath("https://evil.com", "/x")).toBe("/x");
    expect(safeNextPath("javascript:alert(1)", "/x")).toBe("/x");
    expect(safeNextPath("data:text/html,oi", "/x")).toBe("/x");
  });

  it("recusa URLs relativas ao protocolo e truques com barra invertida", () => {
    expect(safeNextPath("//evil.com", "/x")).toBe("/x");
    expect(safeNextPath("/\\evil.com", "/x")).toBe("/x");
    expect(safeNextPath("/%5Cevil.com", "/x")).toBe("/%5Cevil.com");
    expect(safeNextPath("/\tevil", "/x")).toBe("/x");
    expect(safeNextPath("/ok\nSet-Cookie:x", "/x")).toBe("/x");
  });

  it("recusa rotas de autenticação (evita laços) e valores que não são texto", () => {
    expect(safeNextPath("/entrar?next=/forum", "/x")).toBe("/x");
    expect(safeNextPath("/auth/sair", "/x")).toBe("/x");
    expect(safeNextPath("/cadastro", "/x")).toBe("/x");
    expect(safeNextPath("/api/cron/newsletter", "/x")).toBe("/x");
    expect(safeNextPath(null, "/x")).toBe("/x");
    expect(safeNextPath(undefined)).toBe("/painel");
    expect(safeNextPath(["/forum"], "/x")).toBe("/x");
    expect(safeNextPath("", "/x")).toBe("/x");
  });

  it("não confunde rotas que só começam com o mesmo texto", () => {
    expect(safeNextPath("/entrarx", "/x")).toBe("/entrarx");
    expect(safeNextPath("/autores", "/x")).toBe("/autores");
  });

  it("normaliza segmentos com ponto sem sair do site", () => {
    expect(safeNextPath("/forum/../perfil", "/x")).toBe("/perfil");
  });

  it("recusa segmentos com ponto que normalizam para //outro-dominio (open redirect)", () => {
    // Auditoria de segurança: "/.//evil.com" normalizava para "//evil.com" e o proxy/auth
    // redirecionavam para http://evil.com/ (inclusive a partir de um link mágico legítimo).
    for (const raw of [
      "/.//evil.com",
      "/..//evil.com",
      "/%2e//evil.com",
      "/%2E%2E//evil.com",
      "/forum/..//evil.com",
      "/forum/../..//evil.com/caminho?x=1",
      "/././/evil.com",
    ]) {
      expect(safeNextPath(raw, "/x"), raw).toBe("/x");
    }
    // Nenhum destino aceito pode começar com "//".
    expect(safeNextPath("/./forum", "/x")).toBe("/forum");
    expect(safeNextPath("/forum/./t/1", "/x")).toBe("/forum/t/1");
  });

  it("o destino aceito continua no mesmo site quando resolvido contra a origem", () => {
    const origin = "https://artemis.example";
    for (const raw of ["/.//evil.com", "/..//evil.com", "/%2e//evil.com", "/forum", "/./perfil"]) {
      expect(new URL(safeNextPath(raw, "/forum"), origin).origin, raw).toBe(origin);
    }
  });

  it("usa o /painel como destino padrão (início de quem já é membra)", () => {
    expect(safeNextPath(null)).toBe("/painel");
    expect(safeNextPath("//evil.com")).toBe("/painel");
    expect(safeNextPath("/entrar")).toBe("/painel");
    expect(safeNextPath("/painel")).toBe("/painel");
  });

  it("recusa caminhos muito longos", () => {
    expect(safeNextPath(`/${"a".repeat(600)}`, "/x")).toBe("/x");
  });
});

describe("withNext", () => {
  it("anexa o destino codificado só quando é diferente do padrão", () => {
    expect(withNext("/entrar", "/papers/novo")).toBe("/entrar?next=%2Fpapers%2Fnovo");
    expect(withNext("/entrar", "/forum", "/forum")).toBe("/entrar");
    expect(withNext("/entrar", null)).toBe("/entrar");
    expect(withNext("/entrar?x=1", "/perfil")).toBe("/entrar?x=1&next=%2Fperfil");
    expect(withNext("/entrar", "https://evil.com")).toBe("/entrar");
  });
});
