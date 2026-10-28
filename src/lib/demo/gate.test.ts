import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Portão do modo demonstração: com DEMO_MODE desligado, /demo é 404 e a action recusa tudo
 * SEM tocar no Supabase; ligado, só personas da lista abrem sessão.
 */

const mocks = vi.hoisted(() => ({
  openDemoSession: vi.fn(),
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/demo/session", () => ({ openDemoSession: mocks.openDemoSession }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));

const { enterDemoPersona } = await import("@/app/demo/actions");
const { default: DemoPage } = await import("@/app/demo/page");
const { DemoBanner } = await import("@/components/demo/demo-banner");
const { requireDemoMode, isProtectedDemoAccount, DEMO_OFF, DEMO_UNKNOWN_PERSONA } =
  await import("./guard");

function form(persona: unknown): FormData {
  const data = new FormData();
  if (persona !== undefined) data.set("persona", String(persona));
  return data;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  mocks.openDemoSession.mockReset().mockResolvedValue({ ok: true });
  mocks.revalidatePath.mockReset();
  mocks.getCurrentUser.mockReset();
});

describe("DEMO_MODE desligado", () => {
  beforeEach(() => vi.stubEnv("DEMO_MODE", ""));

  it("/demo responde 404 (notFound)", () => {
    expect(() => requireDemoMode()).toThrow("NEXT_NOT_FOUND");
    expect(() => DemoPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("só 'true' exato liga o modo", () => {
    for (const value of ["1", "TRUE", "yes", "false", "on"]) {
      vi.stubEnv("DEMO_MODE", value);
      expect(() => requireDemoMode(), value).toThrow("NEXT_NOT_FOUND");
    }
  });

  it("a action recusa até uma persona válida, sem abrir sessão", async () => {
    await expect(enterDemoPersona({ ok: false }, form("larissa"))).resolves.toEqual({
      ok: false,
      error: DEMO_OFF,
    });
    expect(mocks.openDemoSession).not.toHaveBeenCalled();
  });

  it("o aviso não aparece e não lê a sessão", async () => {
    expect(await DemoBanner()).toBeNull();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("contas fictícias só ficam protegidas com o modo ligado", () => {
    expect(isProtectedDemoAccount("larissa@demo.cienciadelas.dev")).toBe(false);
  });
});

describe("DEMO_MODE=true", () => {
  beforeEach(() => vi.stubEnv("DEMO_MODE", "true"));

  it("/demo renderiza as personas, o aviso honesto e o roteiro", () => {
    const html = renderToString(DemoPage()).replace(/<!-- -->/g, "");
    expect(html).toContain("Entrar como Larissa");
    expect(html).toContain("Entrar como Marina");
    expect(html).toContain(
      "Modo demonstração: todas as pessoas, papers e conversas daqui são fictícios.",
    );
    expect(html).toContain("Roteiro de 3 minutos");
    expect(html).not.toMatch(/Entrar como (Helena|Priscila|Admin)/);
  });

  it("slug desconhecido, forjado ou ausente é recusado sem abrir sessão", async () => {
    for (const persona of [
      "admin",
      "moderacao",
      "admin@demo.cienciadelas.dev",
      "LARISSA",
      "helena",
      "x".repeat(200),
      undefined,
    ]) {
      await expect(
        enterDemoPersona({ ok: false }, form(persona)),
        String(persona),
      ).resolves.toEqual({ ok: false, error: DEMO_UNKNOWN_PERSONA });
    }
    expect(mocks.openDemoSession).not.toHaveBeenCalled();
  });

  it("persona válida: abre a sessão, atualiza o layout e vai para o início dela", async () => {
    await expect(enterDemoPersona({ ok: false }, form("marina"))).rejects.toThrow(
      "NEXT_REDIRECT:/painel",
    );
    expect(mocks.openDemoSession).toHaveBeenCalledTimes(1);
    expect(mocks.openDemoSession.mock.calls[0]![0]).toMatchObject({
      slug: "marina",
      email: "marina@demo.cienciadelas.dev",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("falha ao abrir a sessão volta como mensagem, sem redirecionar", async () => {
    mocks.openDemoSession.mockResolvedValue({ ok: false, error: "Sem chave." });
    await expect(enterDemoPersona({ ok: false }, form("larissa"))).resolves.toEqual({
      ok: false,
      error: "Sem chave.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("o aviso mostra a persona logada e os atalhos; some para contas reais", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      email: "marina@demo.cienciadelas.dev",
      user_metadata: {},
    });
    const html = renderToString((await DemoBanner())!);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Modo demonstração"');
    expect(html).toMatch(/você está como <strong[^>]*>Marina<\/strong> \(perfil fictício\)/);
    expect(html).toContain('href="/demo"');
    expect(html).toContain('action="/auth/sair"');
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);

    mocks.getCurrentUser.mockResolvedValue({ email: "ana@usp.br", user_metadata: {} });
    expect(await DemoBanner()).toBeNull();
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await DemoBanner()).toBeNull();
  });

  it("conta fictícia que não é persona aparece pelo primeiro nome do cadastro", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      email: "gabriela@demo.cienciadelas.dev",
      user_metadata: { full_name: "Gabriela Lima" },
    });
    expect(renderToString((await DemoBanner())!)).toMatch(/<strong[^>]*>Gabriela<\/strong>/);
  });

  it("contas fictícias ficam protegidas; contas reais não", () => {
    expect(isProtectedDemoAccount("larissa@demo.cienciadelas.dev")).toBe(true);
    expect(isProtectedDemoAccount("ana@usp.br")).toBe(false);
    expect(isProtectedDemoAccount(null)).toBe(false);
  });
});
