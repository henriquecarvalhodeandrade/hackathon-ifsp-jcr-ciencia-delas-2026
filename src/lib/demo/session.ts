import "server-only";
import { env, isAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DemoPersona } from "./personas";

/**
 * Abre a sessão de uma persona do modo demonstração SEM senha digitada e SEM e-mail
 * (docs/14-painel-e-modo-demo.md):
 *
 *   1. com a chave secreta (service role): ANTES de mexer na sessão atual, confere que a conta do
 *      seed existe com o e-mail esperado e que é uma conta comum (papel "member"); depois gera um
 *      link mágico pela API admin (nada é enviado) e valida o token na hora, no cliente com
 *      cookies — a sessão é gravada no navegador de quem clicou;
 *   2. sem a chave, com DEMO_PASSWORD: login por senha (plano B), com a mesma conferência de
 *      conta e de papel logo depois do login (se falhar, a sessão recém-aberta é encerrada);
 *   3. sem nenhum dos dois: explica o que falta.
 *
 * Nenhum segredo chega ao navegador: tudo roda no servidor e só os cookies de sessão voltam.
 * A conferência de papel é uma segunda trava além da lista fixa de personas: mesmo que alguém
 * promova a conta fictícia a moderadora ou administradora, o modo demonstração não entra nela.
 */

export type DemoSessionResult = { ok: true } | { ok: false; error: string };

export const DEMO_NOT_CONFIGURED =
  "O modo demonstração precisa da chave secreta do Supabase no servidor.";
export const DEMO_ACCOUNT_MISSING =
  "Essa conta de demonstração não existe neste banco. A equipe precisa carregar os dados de demonstração (seed).";
export const DEMO_ACCOUNT_PRIVILEGED =
  "Por segurança, o modo demonstração só entra em contas comuns da rede, sem poderes de moderação ou administração.";
export const DEMO_LOGIN_FAILED =
  "Não conseguimos entrar com essa pessoa agora. Tente de novo em alguns segundos.";

/** O único papel que uma persona pode ter (profiles.role). */
const PERSONA_ROLE = "member";

/** Tentativas do link mágico quando cliques simultâneos na mesma persona disputam o token. */
const MAGIC_LINK_ATTEMPTS = 3;
const RETRY_BASE_MS = 60;

function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type Method = "admin" | "password";

function availableMethod(): Method | null {
  if (isAdminConfigured()) return "admin";
  if (env.demoPassword) return "password";
  return null;
}

function warn(what: string, error: { status?: number; code?: string } | null | undefined) {
  console.warn(`[demo] ${what} (${error?.status ?? ""} ${error?.code ?? ""})`);
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

/** Papel da conta no perfil: só "member" serve. Perfil ausente = seed não carregado. */
async function checkPersonaRole(
  client: ServerClient | AdminClient,
  persona: DemoPersona,
): Promise<DemoSessionResult> {
  const { data, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", persona.id)
    .maybeSingle();
  if (error) {
    warn("papel da persona", error);
    return { ok: false, error: DEMO_LOGIN_FAILED };
  }
  if (!data) return { ok: false, error: DEMO_ACCOUNT_MISSING };
  if (data.role !== PERSONA_ROLE) {
    console.warn(`[demo] persona ${persona.slug} recusada: papel ${data.role}`);
    return { ok: false, error: DEMO_ACCOUNT_PRIVILEGED };
  }
  return { ok: true };
}

/** Conta do seed: existe com o id e o e-mail esperados e é uma conta comum. */
async function checkSeedAccount(
  admin: AdminClient,
  persona: DemoPersona,
): Promise<DemoSessionResult> {
  // generateLink("magiclink") CRIA a conta se ela não existir: conferimos antes, pelo id do seed.
  const { data: found, error: findError } = await admin.auth.admin.getUserById(persona.id);
  const foundEmail = found?.user?.email?.trim().toLowerCase();
  if (findError || foundEmail !== persona.email) {
    if (findError && findError.status !== 404) warn("conta da persona", findError);
    return { ok: false, error: DEMO_ACCOUNT_MISSING };
  }
  return checkPersonaRole(admin, persona);
}

/** Sai da sessão atual SÓ neste navegador ("local"). */
async function signOutHere(supabase: ServerClient) {
  // O padrão ("global") derrubaria todas as pessoas da banca que estão usando a mesma conta.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) warn("signOut", error);
}

async function signInWithMagicLink(
  supabase: ServerClient,
  admin: AdminClient,
  persona: DemoPersona,
): Promise<DemoSessionResult> {
  // Várias pessoas da banca clicando juntas na mesma persona: o token mais novo invalida o
  // anterior. Novas tentativas, com uma pausa curta e aleatória, desfazem a corrida (cada uma
  // gasta uma validação do limite do Supabase Auth, por isso são poucas).
  for (let attempt = 1; attempt <= MAGIC_LINK_ATTEMPTS; attempt++) {
    if (attempt > 1) await pause(RETRY_BASE_MS + Math.random() * RETRY_BASE_MS * 2);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: persona.email,
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      warn("generateLink", error);
      return { ok: false, error: DEMO_LOGIN_FAILED };
    }
    // "email" é o tipo atual do OTP por e-mail ("magiclink" ainda é aceito, mas está obsoleto).
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (!verifyError) return { ok: true };
    warn(`verifyOtp (tentativa ${attempt})`, verifyError);
  }
  return { ok: false, error: DEMO_LOGIN_FAILED };
}

async function signInWithPassword(
  supabase: ServerClient,
  persona: DemoPersona,
  password: string,
): Promise<DemoSessionResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password,
  });
  if (error) {
    warn("signInWithPassword", error);
    return { ok: false, error: DEMO_LOGIN_FAILED };
  }
  // Sem a chave secreta não dá para conferir antes: conferimos com a sessão recém-aberta e, se
  // não for a conta comum do seed, ela é encerrada na hora.
  const check: DemoSessionResult =
    data?.user?.id === persona.id
      ? await checkPersonaRole(supabase, persona)
      : { ok: false, error: DEMO_ACCOUNT_MISSING };
  if (!check.ok) await signOutHere(supabase);
  return check;
}

export async function openDemoSession(persona: DemoPersona): Promise<DemoSessionResult> {
  const method = availableMethod();
  if (!method) return { ok: false, error: DEMO_NOT_CONFIGURED };

  const supabase = await createClient();

  if (method === "admin") {
    const admin = createAdminClient();
    // Tudo conferido ANTES de sair da conta atual: uma recusa não desloga ninguém.
    const account = await checkSeedAccount(admin, persona);
    if (!account.ok) return account;
    await signOutHere(supabase);
    return signInWithMagicLink(supabase, admin, persona);
  }

  await signOutHere(supabase);
  return signInWithPassword(supabase, persona, env.demoPassword!);
}
