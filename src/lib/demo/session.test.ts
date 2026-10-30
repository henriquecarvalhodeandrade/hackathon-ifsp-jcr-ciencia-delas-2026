import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * openDemoSession: link mágico pela API admin (sem e-mail), com conferência da conta do seed e
 * do papel (só "member") ANTES de sair da sessão atual, saída SÓ deste navegador e plano B por
 * senha. Também a trava de exclusão de conta fictícia.
 */

const mocks = vi.hoisted(() => {
  const session = {
    signOut: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithPassword: vi.fn(),
  };
  const admin = {
    getUserById: vi.fn(),
    generateLink: vi.fn(),
    deleteUser: vi.fn(),
  };
  /** Leitura de profiles.role (`from("profiles").select("role").eq("id", …).maybeSingle()`). */
  const profileRole = vi.fn();
  const profiles = (client: "admin" | "session") => (table: string) => ({
    select: () => ({
      eq: (_column: string, id: string) => ({
        maybeSingle: () => profileRole(client, table, id),
      }),
    }),
  });
  return {
    session,
    admin,
    profileRole,
    createClient: vi.fn(async () => ({ auth: session, from: profiles("session") })),
    createAdminClient: vi.fn(() => ({
      auth: { admin },
      from: profiles("admin"),
      storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({}) }) },
    })),
    getCurrentUser: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));

const {
  openDemoSession,
  DEMO_ACCOUNT_MISSING,
  DEMO_ACCOUNT_PRIVILEGED,
  DEMO_LOGIN_FAILED,
  DEMO_NOT_CONFIGURED,
} = await import("./session");
const { getPersona } = await import("./personas");
const { DEMO_DELETE_REFUSED } = await import("./guard");
const { deleteCurrentUserAccount } = await import("@/lib/profile/account");

const marina = getPersona("marina")!;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_teste");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("DEMO_PASSWORD", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const fn of [...Object.values(mocks.session), ...Object.values(mocks.admin)]) fn.mockReset();
  mocks.profileRole.mockReset().mockResolvedValue({ data: { role: "member" }, error: null });
  mocks.createAdminClient.mockClear();
  mocks.session.signOut.mockResolvedValue({ error: null });
  mocks.admin.getUserById.mockResolvedValue({
    data: { user: { id: marina.id, email: marina.email } },
    error: null,
  });
  mocks.admin.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "hash-1" } },
    error: null,
  });
  mocks.session.verifyOtp.mockResolvedValue({ error: null });
});

describe("openDemoSession — com a chave secreta (link mágico sem e-mail)", () => {
  it("sai só deste navegador, gera o link e valida o token no cliente com cookies", async () => {
    await expect(openDemoSession(marina)).resolves.toEqual({ ok: true });
    expect(mocks.session.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.admin.getUserById).toHaveBeenCalledWith(marina.id);
    expect(mocks.admin.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "marina@demo.cienciadelas.dev",
    });
    expect(mocks.session.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "email" });
    expect(mocks.session.signInWithPassword).not.toHaveBeenCalled();
    // O papel é conferido pela chave secreta, no perfil do seed, antes de abrir a sessão.
    expect(mocks.profileRole).toHaveBeenCalledWith("admin", "profiles", marina.id);
  });

  it("confere a conta ANTES de sair da sessão atual: uma recusa não desloga ninguém", async () => {
    mocks.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: "user_not_found" },
    });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_MISSING,
    });
    expect(mocks.session.signOut).not.toHaveBeenCalled();
  });

  it("recusa a persona se a conta do seed virou moderadora ou administradora", async () => {
    for (const role of ["moderator", "admin"]) {
      mocks.profileRole.mockResolvedValue({ data: { role }, error: null });
      await expect(openDemoSession(marina), role).resolves.toEqual({
        ok: false,
        error: DEMO_ACCOUNT_PRIVILEGED,
      });
    }
    // Sem perfil (seed incompleto) também não entra.
    mocks.profileRole.mockResolvedValue({ data: null, error: null });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_MISSING,
    });
    expect(mocks.session.signOut).not.toHaveBeenCalled();
    expect(mocks.admin.generateLink).not.toHaveBeenCalled();
    expect(mocks.session.verifyOtp).not.toHaveBeenCalled();
  });

  it("não cria conta: se o id do seed não existir (ou o e-mail não bater), recusa", async () => {
    mocks.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: "user_not_found" },
    });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_MISSING,
    });
    mocks.admin.getUserById.mockResolvedValue({
      data: { user: { id: marina.id, email: "outra@example.com" } },
      error: null,
    });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_MISSING,
    });
    expect(mocks.admin.generateLink).not.toHaveBeenCalled();
  });

  it("tenta de novo quando outro clique invalidou o token (corrida)", async () => {
    mocks.session.verifyOtp
      .mockResolvedValueOnce({ error: { status: 403, code: "otp_expired" } })
      .mockResolvedValueOnce({ error: null });
    await expect(openDemoSession(marina)).resolves.toEqual({ ok: true });
    expect(mocks.admin.generateLink).toHaveBeenCalledTimes(2);

    // Vários cliques juntos: até 3 tentativas no total.
    mocks.admin.generateLink.mockClear();
    mocks.session.verifyOtp
      .mockResolvedValueOnce({ error: { status: 403, code: "otp_expired" } })
      .mockResolvedValueOnce({ error: { status: 500 } })
      .mockResolvedValueOnce({ error: null });
    await expect(openDemoSession(marina)).resolves.toEqual({ ok: true });
    expect(mocks.admin.generateLink).toHaveBeenCalledTimes(3);
  });

  it("falhas persistentes viram mensagem amigável (sem passar de 3 tentativas)", async () => {
    mocks.session.verifyOtp.mockResolvedValue({ error: { status: 403, code: "otp_expired" } });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_LOGIN_FAILED,
    });
    expect(mocks.admin.generateLink).toHaveBeenCalledTimes(3);
    mocks.admin.generateLink.mockResolvedValue({ data: null, error: { status: 500 } });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_LOGIN_FAILED,
    });
  });
});

describe("openDemoSession — sem a chave secreta", () => {
  beforeEach(() => vi.stubEnv("SUPABASE_SECRET_KEY", ""));

  it("com DEMO_PASSWORD usa login por senha (plano B)", async () => {
    vi.stubEnv("DEMO_PASSWORD", "senha-da-demo");
    mocks.session.signInWithPassword.mockResolvedValue({
      data: { user: { id: marina.id } },
      error: null,
    });
    await expect(openDemoSession(marina)).resolves.toEqual({ ok: true });
    expect(mocks.session.signInWithPassword).toHaveBeenCalledWith({
      email: "marina@demo.cienciadelas.dev",
      password: "senha-da-demo",
    });
    expect(mocks.profileRole).toHaveBeenCalledWith("session", "profiles", marina.id);
    expect(mocks.session.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("plano B: conta com poderes (ou outra conta) é encerrada na hora e recusada", async () => {
    vi.stubEnv("DEMO_PASSWORD", "senha-da-demo");
    mocks.session.signInWithPassword.mockResolvedValue({
      data: { user: { id: marina.id } },
      error: null,
    });
    mocks.profileRole.mockResolvedValue({ data: { role: "admin" }, error: null });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_PRIVILEGED,
    });
    // Uma saída antes do login e outra para encerrar a sessão recusada.
    expect(mocks.session.signOut).toHaveBeenCalledTimes(2);
    expect(mocks.session.signOut).toHaveBeenLastCalledWith({ scope: "local" });

    mocks.session.signOut.mockClear();
    mocks.profileRole.mockResolvedValue({ data: { role: "member" }, error: null });
    mocks.session.signInWithPassword.mockResolvedValue({
      data: { user: { id: "outra-conta" } },
      error: null,
    });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_ACCOUNT_MISSING,
    });
    expect(mocks.session.signOut).toHaveBeenCalledTimes(2);
  });

  it("plano B: senha errada vira mensagem amigável", async () => {
    vi.stubEnv("DEMO_PASSWORD", "senha-errada");
    mocks.session.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials" },
    });
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_LOGIN_FAILED,
    });
    expect(mocks.profileRole).not.toHaveBeenCalled();
  });

  it("sem nada configurado explica o que falta e NÃO desloga ninguém", async () => {
    await expect(openDemoSession(marina)).resolves.toEqual({
      ok: false,
      error: DEMO_NOT_CONFIGURED,
    });
    expect(DEMO_NOT_CONFIGURED).toBe(
      "O modo demonstração precisa da chave secreta do Supabase no servidor.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.session.signOut).not.toHaveBeenCalled();
  });
});

describe("exclusão de conta no modo demonstração", () => {
  it("recusa excluir conta fictícia com DEMO_MODE ligado (antes de qualquer chamada admin)", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    mocks.getCurrentUser.mockResolvedValue({ id: marina.id, email: marina.email });
    await expect(deleteCurrentUserAccount("EXCLUIR")).resolves.toEqual({
      ok: false,
      error: DEMO_DELETE_REFUSED,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("contas reais continuam podendo se excluir no modo demonstração", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    mocks.getCurrentUser.mockResolvedValue({ id: "u-1", email: "ana@usp.br" });
    mocks.admin.deleteUser.mockResolvedValue({ error: null });
    await expect(deleteCurrentUserAccount("EXCLUIR")).resolves.toEqual({ ok: true });
    expect(mocks.admin.deleteUser).toHaveBeenCalledWith("u-1");
  });

  it("com DEMO_MODE desligado a trava não se aplica", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    mocks.getCurrentUser.mockResolvedValue({ id: marina.id, email: marina.email });
    mocks.admin.deleteUser.mockResolvedValue({ error: null });
    await expect(deleteCurrentUserAccount("EXCLUIR")).resolves.toEqual({ ok: true });
  });
});
