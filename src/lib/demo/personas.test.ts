import { describe, expect, it } from "vitest";
import { getPersona, isDemoEmail, listPersonas, personaByEmail } from "./personas";

describe("personas do modo demonstração", () => {
  it("tem a Larissa, a Marina e a Débora, com o e-mail e o destino combinados", () => {
    expect(listPersonas().map((p) => [p.slug, p.email, p.name, p.start])).toEqual(
      expect.arrayContaining([
        ["larissa", "larissa@demo.cienciadelas.dev", "Larissa Gomes", "/painel"],
        ["marina", "marina@demo.cienciadelas.dev", "Marina Albuquerque", "/painel"],
        ["debora", "debora@demo.cienciadelas.dev", "Débora Alves", "/mentoria?aba=ativas"],
      ]),
    );
    expect(getPersona("debora")!.id).toBe("d2000000-0000-4000-8000-000000000005");
    expect(getPersona("debora")!.description).toBe(
      "Mentoranda que concluiu uma mentoria e tem declaração",
    );
    expect(getPersona("larissa")!.description).toBe("Graduanda em IC que procura mentora");
    expect(getPersona("marina")!.description).toBe(
      "Professora e mentora com pedidos para responder",
    );
  });

  it("slug desconhecido ou forjado → null", () => {
    for (const slug of [
      "admin",
      "moderacao",
      "helena",
      "priscila",
      "LARISSA",
      " larissa",
      "larissa@demo.cienciadelas.dev",
      "",
      "a".repeat(41),
      null,
      undefined,
      42,
      ["larissa"],
      { slug: "larissa" },
    ]) {
      expect(getPersona(slug), String(slug)).toBeNull();
    }
  });

  it("toda persona é uma conta fictícia, com slug único e destino interno", () => {
    const personas = listPersonas();
    expect(new Set(personas.map((p) => p.slug)).size).toBe(personas.length);
    for (const p of personas) {
      expect(isDemoEmail(p.email), p.email).toBe(true);
      expect(p.slug).toMatch(/^[a-z]+$/);
      expect(p.start.startsWith("/") && !p.start.startsWith("//"), p.start).toBe(true);
      expect(getPersona(p.slug)).toBe(p);
    }
  });

  it("contas de administração e moderação nunca são personas", () => {
    const emails = listPersonas().map((p) => p.email);
    expect(emails).not.toContain("admin@demo.cienciadelas.dev");
    expect(emails).not.toContain("moderacao@demo.cienciadelas.dev");
    expect(personaByEmail("admin@demo.cienciadelas.dev")).toBeNull();
    expect(personaByEmail("moderacao@demo.cienciadelas.dev")).toBeNull();
  });

  it("a lista é imutável (ninguém acrescenta persona em tempo de execução)", () => {
    expect(Object.isFrozen(getPersona("larissa"))).toBe(true);
    expect(() => {
      (getPersona("larissa") as { email: string }).email = "admin@demo.cienciadelas.dev";
    }).toThrow();
    expect(getPersona("larissa")!.email).toBe("larissa@demo.cienciadelas.dev");
  });

  it("isDemoEmail: só o domínio fictício do seed", () => {
    expect(isDemoEmail("larissa@demo.cienciadelas.dev")).toBe(true);
    expect(isDemoEmail("  Gabriela@Demo.CienciaDelas.dev ")).toBe(true);
    expect(isDemoEmail("e2e-painel-x@demo.cienciadelas.dev")).toBe(true);
    expect(isDemoEmail("larissa@cienciadelas.dev")).toBe(false);
    expect(isDemoEmail("larissa@demo.cienciadelas.dev.evil.com")).toBe(false);
    expect(isDemoEmail("larissa@sub.demo.cienciadelas.dev")).toBe(false);
    expect(isDemoEmail("demo.cienciadelas.dev")).toBe(false);
    expect(isDemoEmail("@demo.cienciadelas.dev")).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
  });

  it("personaByEmail acha a persona pelo e-mail (sem diferença de caixa)", () => {
    expect(personaByEmail("MARINA@demo.cienciadelas.dev")?.slug).toBe("marina");
    expect(personaByEmail("gabriela@demo.cienciadelas.dev")).toBeNull();
    expect(personaByEmail("marina@example.com")).toBeNull();
  });
});
