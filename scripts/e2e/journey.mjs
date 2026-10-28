#!/usr/bin/env node
/**
 * Jornada completa (E2E) da Artemis com Playwright, contra o app rodando de verdade e o
 * Supabase local (com o Mailpit fazendo o papel da caixa de e-mail).
 *
 * O que o script faz, em ordem:
 *   1. Visitante: landing → Vitrine → ranking → assina o Boletim → confirma pelo e-mail (Mailpit).
 *   2. Cadastro novo → link de confirmação (Mailpit) → onboarding em 4 etapas → /mentoria
 *      (sugestões pelas regras da plataforma, sem IA) → pede mentoria à Marina.
 *   3. Marina (marina@) aceita → a mentoranda vê o e-mail de contato e o aviso.
 *   4. Fórum: tópico, resposta, reação, tópico anônimo em "Rede de apoio" e denúncia (gabriela@).
 *   5. Moderação: moderacao@ tranca o tópico (e não vê "Revelar autoria"); admin@ revela a
 *      autoria com motivo (linha no registro); moderacao@ resolve a denúncia e quem denunciou
 *      recebe o aviso.
 *   6. admin@ gera e envia o Boletim da semana → chega no Mailpit, sem nomes nem relatos anônimos.
 *   7. Vitrine: divulga um paper pelo DOI (Crossref; se a busca falhar, preenche à mão),
 *      larissa@ destaca e o paper aparece no ranking.
 *   8. Varredura: capturas claro/escuro × 1440/390 px das páginas principais (visitante, membra,
 *      mentora, admin), erros de console, avisos de hidratação, respostas ≥ 400, rolagem
 *      horizontal, contraste de texto (AA, telas de 1440 px), links internos quebrados (cada
 *      papel confere os links que vê, com a própria sessão), foco visível pelo teclado e o menu
 *      do celular (abre, prende o foco, fecha com Esc e devolve o foco).
 * Tudo o que o script cria é apagado no fim (e sobras de execuções anteriores, no começo).
 *
 * Pré-requisitos
 *   - Supabase local com o seed (`npx supabase start`) e .env.local apontando para ele
 *     (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY —
 *     a chave secreta só é usada aqui para conferir e apagar os dados do teste).
 *   - O app rodando em BASE_URL. `next dev` já manda os e-mails do app para o Mailpit; um build
 *     de produção local precisa de MAILPIT_URL explícita no servidor:
 *       MAILPIT_URL=http://127.0.0.1:54324 npx next build && \
 *       MAILPIT_URL=http://127.0.0.1:54324 npx next start -p 3400
 *     Os links dos e-mails (Supabase Auth usa o site_url do config.toml) são reescritos para
 *     BASE_URL, então a porta do app não precisa ser a 3000.
 *   - Playwright: devDependency com versão fixa no package.json (vem com `npm install`/`npm ci`); o
 *     Chromium dela: `npx playwright install chromium` (no Linux sem as bibliotecas do sistema, use
 *     `npx playwright install --with-deps chromium`, como no CI).
 *   - Uma execução por vez: o Boletim da semana é gerado e enviado de verdade (para o Mailpit).
 *
 * Uso (na raiz do repositório)
 *   BASE_URL=http://localhost:3400 node scripts/e2e/journey.mjs
 * Variáveis opcionais
 *   OUT_DIR=<pasta>        capturas, falhas, galeria (index.html) e report.json
 *                          (padrão: <tmp>/artemis-e2e/<execução>)
 *   MAILPIT_URL=<url>      API do Mailpit (padrão http://127.0.0.1:54324)
 *   DEMO_PASSWORD=<senha>  senha das contas demo (padrão ciencia-delas-demo)
 *   SKIP_SWEEP=1           só a jornada (sem capturas, links e foco)
 *   ONLY_SWEEP=1           só a varredura (sem a jornada)
 *   KEEP_DATA=1            não apaga os dados criados (para investigar; rode de novo para limpar)
 *   HEADED=1               mostra o navegador
 * Sai com código 1 se alguma etapa ou verificação falhar (o resumo lista cada problema) e com 2 se
 * faltar pré-requisito (variáveis, app, Mailpit ou Playwright).
 *
 * No CI (GitHub Actions, job "e2e" de .github/workflows/ci.yml) roda contra `next start -p 3000` com
 * o Supabase local do runner; lá cada etapa ou problema que falhar vira uma anotação de erro, o resumo
 * vai para a aba Summary do job e, em caso de falha, a pasta OUT_DIR é enviada como artefato.
 * Detalhes em docs/07-setup-e-deploy.md §7.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // sem .env.local: usa só o ambiente atual
}

function loadPlaywright() {
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      return require(name);
    } catch {
      // tenta o próximo
    }
  }
  console.error(
    "Playwright não encontrado. Rode `npm install` (ele é devDependency) e `npx playwright install chromium`.",
  );
  process.exit(2);
}
const { chromium } = loadPlaywright();

// ---------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3400").replace(/\/+$/, "");
const MAILPIT = (process.env.MAILPIT_URL ?? "http://127.0.0.1:54324").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "ciencia-delas-demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const KEEP_DATA = process.env.KEEP_DATA === "1";
const SKIP_SWEEP = process.env.SKIP_SWEEP === "1";
const ONLY_SWEEP = process.env.ONLY_SWEEP === "1";

/** Tudo o que o teste cria carrega esta marca (e-mails, textos), para achar e apagar depois. */
const TAG_PREFIX = "e2e-jornada";
const RUN = Date.now().toString(36);
const TAG = `${TAG_PREFIX}-${RUN}`;
/** Nome da conta nova (aparece em avisos de outras pessoas: também serve para limpar). */
const NAME_PREFIX = "Jornada E2E";
const NEW_NAME = `${NAME_PREFIX} ${RUN}`;
const NEW_EMAIL = `${TAG}@example.com`;
const NEWS_EMAIL = `${TAG}-boletim@example.com`;
const NEW_PASSWORD = `senha-${RUN}-teste`;
const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), "artemis-e2e", TAG);
const NOT_FOUND_PATH = "/e2e-pagina-inexistente";

const demo = (user) => `${user}@demo.cienciadelas.dev`;
const SEED = {
  marinaId: "d1000000-0000-4000-8000-000000000001",
  pinnedThread: "a1000000-0000-4000-8000-000000000008",
  paper: "b1000000-0000-4000-8000-000000000002",
  edition: "2026-s43",
};
/** DOI real (Jinek, Chylinski, Fonfara, Hauer, Doudna, Charpentier — Science, 2012). */
const LOOKUP_DOI = "10.1126/science.1225829";

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: SECRET_KEY,
})) {
  if (!value) {
    console.error(`Falta ${name} (no .env.local ou no ambiente).`);
    process.exit(2);
  }
}

const db = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------------------------
// Registro de etapas e problemas
// ---------------------------------------------------------------------------------------------

const steps = [];
const issues = [];
const created = {
  userIds: [],
  threadIds: [],
  paperIds: [],
  reportIds: [],
  editionIds: [],
};
const ctx = {}; // estado compartilhado entre as etapas (ids, títulos…)
const contexts = [];
let browser;
let activePage = null;
let stepIndex = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (value) =>
  value
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "inicio";

function issue(kind, where, detail) {
  const key = `${kind}|${where}|${detail}`;
  if (issues.some((item) => item.key === key)) return;
  issues.push({ key, kind, where, detail });
}

async function dumpFailure(name) {
  if (!activePage || activePage.isClosed()) return;
  const base = path.join(OUT, "falhas", `${String(stepIndex).padStart(2, "0")}-${slug(name)}`);
  try {
    await activePage.screenshot({ path: `${base}.png`, fullPage: true });
    const snapshot = await activePage.locator("body").ariaSnapshot({ timeout: 5000 });
    fs.writeFileSync(`${base}.txt`, `${activePage.url()}\n\n${snapshot}`);
  } catch {
    // a página pode ter fechado
  }
}

/** Executa uma etapa; falhas não interrompem o script (as dependentes são puladas). */
async function step(name, fn, { needs = [] } = {}) {
  stepIndex += 1;
  const missing = needs.filter((key) => !ctx[key]);
  if (missing.length > 0) {
    steps.push({ name, status: "skip", detail: `depende de: ${missing.join(", ")}` });
    console.log(`- ${name} (pulada: depende de ${missing.join(", ")})`);
    return;
  }
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    steps.push({ name, status: "ok", detail: detail ?? "", ms });
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""} (${(ms / 1000).toFixed(1)}s)`);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    steps.push({ name, status: "fail", detail: message, ms: Date.now() - started });
    console.log(`✗ ${name} — ${message}`);
    await dumpFailure(name);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function poll(fn, what, { timeout = 15_000, interval = 400 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(interval);
  }
  throw new Error(`Tempo esgotado esperando: ${what}`);
}

// ---------------------------------------------------------------------------------------------
// Navegador, sessões e observadores
// ---------------------------------------------------------------------------------------------

const HYDRATION = /hydrat|did not match|server rendered html|Minified React error #(418|423|425)/i;

function isExpected404(url) {
  return url.includes(NOT_FOUND_PATH);
}

/** Observa console, exceções e respostas ≥ 400 de uma página. */
function watch(page) {
  page.on("console", (message) => {
    const text = message.text();
    const where = page.url().replace(BASE_URL, "") || "/";
    if (HYDRATION.test(text)) return issue("hydration", where, text.slice(0, 400));
    if (message.type() !== "error") return;
    if (isExpected404(page.url()) && /status of 404/.test(text)) return;
    issue("console", where, text.slice(0, 400));
  });
  page.on("pageerror", (error) =>
    issue("pageerror", page.url().replace(BASE_URL, "") || "/", error.message.slice(0, 400)),
  );
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(BASE_URL) || response.status() < 400 || isExpected404(url)) return;
    issue("http", page.url().replace(BASE_URL, "") || "/", `${response.status()} ${url}`);
  });
}

const cookieCache = new Map();

/** Cookies de sessão (formato @supabase/ssr) de uma conta demo, sem passar pela tela de login. */
async function sessionCookies(email, password = PASSWORD) {
  if (cookieCache.has(email)) return cookieCache.get(email);
  const jar = new Map();
  const supabase = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login de ${email} falhou: ${error.message}`);
  const { hostname } = new URL(BASE_URL);
  const cookies = [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    domain: hostname,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }));
  cookieCache.set(email, cookies);
  return cookies;
}

async function newContext({ cookies, colorScheme = "light", width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    colorScheme,
    viewport: { width, height },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    reducedMotion: "reduce",
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(45_000);
  if (cookies) await context.addCookies(cookies);
  contexts.push(context);
  return context;
}

async function newPage(context) {
  const page = await context.newPage();
  watch(page);
  activePage = page;
  return page;
}

async function open(page, url) {
  activePage = page;
  const response = await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return response;
}

/**
 * Marca um checkbox/radio/switch. Nos chips e switches do design system o input é `sr-only`
 * e o rótulo recebe o clique (como faz uma pessoa): nesse caso clicamos no <label>.
 */
async function check(locator) {
  if (await locator.isChecked()) return;
  try {
    await locator.check({ timeout: 3_000 });
  } catch {
    const label = locator.locator("xpath=ancestor::label[1]");
    if ((await label.count()) > 0) await label.click();
    else await locator.check({ force: true });
  }
  await poll(() => locator.isChecked(), "opção marcada", { timeout: 5_000 });
}

async function visible(locator, what, timeout = 20_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`Não apareceu: ${what}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Mailpit
// ---------------------------------------------------------------------------------------------

const seenMail = new Set();

async function mailpit(pathname, init) {
  const response = await fetch(`${MAILPIT}${pathname}`, init);
  if (!response.ok) throw new Error(`Mailpit ${pathname}: HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  return type.includes("json") ? response.json() : response.text();
}

async function waitForEmail(to, { subject, timeout = 45_000 } = {}) {
  const query = encodeURIComponent(`to:"${to}"`);
  const message = await poll(
    async () => {
      const data = await mailpit(`/api/v1/search?query=${query}&limit=50`);
      return (data.messages ?? []).find(
        (item) =>
          !seenMail.has(item.ID) &&
          item.To?.some((rcpt) => rcpt.Address.toLowerCase() === to.toLowerCase()) &&
          (!subject || subject.test(item.Subject)),
      );
    },
    `e-mail para ${to}${subject ? ` (${subject})` : ""}`,
    { timeout, interval: 1000 },
  );
  seenMail.add(message.ID);
  return mailpit(`/api/v1/message/${message.ID}`);
}

function linksIn(message) {
  return [...String(message.HTML ?? "").matchAll(/href="([^"]+)"/g)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );
}

/** Troca a origem de um link de e-mail pela do app em teste (o Auth usa o site_url local). */
function toBase(url) {
  const parsed = new URL(url);
  return `${BASE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

async function deleteTestMail() {
  const query = encodeURIComponent(TAG_PREFIX);
  const ids = new Set();
  for (let start = 0; start < 2000; start += 200) {
    const data = await mailpit(`/api/v1/search?query=${query}&limit=200&start=${start}`);
    for (const item of data.messages ?? []) {
      if (item.To?.some((rcpt) => rcpt.Address.startsWith(TAG_PREFIX))) ids.add(item.ID);
    }
    if ((data.messages ?? []).length < 200) break;
  }
  if (ids.size === 0) return 0;
  await mailpit("/api/v1/messages", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: [...ids] }),
  });
  return ids.size;
}

// ---------------------------------------------------------------------------------------------
// Banco (service role: só para conferir e limpar)
// ---------------------------------------------------------------------------------------------

async function q(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function findUserIdByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function testUserIds() {
  const ids = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const user of data.users) if (user.email?.startsWith(`${TAG_PREFIX}-`)) ids.push(user.id);
    if (data.users.length < 200) break;
  }
  return ids;
}

/** Apaga tudo o que esta execução (ou uma anterior que falhou) criou. */
async function cleanup() {
  const summary = {};
  const userIds = [...new Set([...created.userIds, ...(await testUserIds())])];

  const threadIds = new Set(created.threadIds);
  const postIds = new Set();
  const paperIds = new Set(created.paperIds);
  if (userIds.length > 0) {
    const anon = await q(
      db.from("forum_anonymous_authorship").select("thread_id, post_id").in("user_id", userIds),
      "autoria anônima",
    );
    for (const row of anon) {
      if (row.thread_id) threadIds.add(row.thread_id);
      if (row.post_id) postIds.add(row.post_id);
    }
    const threads = await q(
      db.from("forum_threads").select("id").in("author_id", userIds),
      "tópicos",
    );
    threads.forEach((row) => threadIds.add(row.id));
    const posts = await q(
      db.from("forum_posts").select("id").in("author_id", userIds),
      "respostas",
    );
    posts.forEach((row) => postIds.add(row.id));
    const papers = await q(db.from("papers").select("id").in("submitted_by", userIds), "papers");
    papers.forEach((row) => paperIds.add(row.id));
  }

  const targets = [...threadIds, ...postIds, ...paperIds, ...userIds];
  const reportIds = new Set(created.reportIds);
  if (targets.length > 0) {
    const reports = await q(db.from("reports").select("id").in("target_id", targets), "denúncias");
    reports.forEach((row) => reportIds.add(row.id));
  }
  const taggedReports = await q(
    db.from("reports").select("id").ilike("details", `%${TAG_PREFIX}-%`),
    "denúncias marcadas",
  );
  taggedReports.forEach((row) => reportIds.add(row.id));

  if (targets.length > 0) {
    const audit = await q(
      db.from("moderation_audit_log").delete().in("target_id", targets).select("id"),
      "registro (alvos)",
    );
    summary.audit = audit.length;
  }
  if (reportIds.size > 0) {
    const audit = await q(
      db
        .from("moderation_audit_log")
        .delete()
        .in("report_id", [...reportIds])
        .select("id"),
      "registro (denúncias)",
    );
    summary.audit = (summary.audit ?? 0) + audit.length;
    await q(
      db
        .from("reports")
        .delete()
        .in("id", [...reportIds]),
      "apagar denúncias",
    );
  }
  summary.reports = reportIds.size;

  const notifications = await q(
    db
      .from("notifications")
      .delete()
      .or(`body.ilike.%${TAG_PREFIX}-%,body.ilike.%${NAME_PREFIX}%,title.ilike.%${TAG_PREFIX}-%`)
      .select("id"),
    "avisos",
  );
  summary.notifications = notifications.length;

  if (threadIds.size > 0) {
    await q(
      db
        .from("forum_threads")
        .delete()
        .in("id", [...threadIds]),
      "apagar tópicos",
    );
  }
  summary.threads = threadIds.size;
  if (paperIds.size > 0) {
    await q(
      db
        .from("papers")
        .delete()
        .in("id", [...paperIds]),
      "apagar papers",
    );
  }
  summary.papers = paperIds.size;

  if (created.editionIds.length > 0) {
    await q(db.from("newsletter_editions").delete().in("id", created.editionIds), "apagar edições");
  }
  summary.editions = created.editionIds.length;

  const subscribers = await q(
    db.from("newsletter_subscribers").delete().ilike("email", `${TAG_PREFIX}-%`).select("id"),
    "apagar inscrições",
  );
  summary.subscribers = subscribers.length;

  for (const id of userIds) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) {
      throw new Error(`apagar conta ${id}: ${error.message}`);
    }
  }
  summary.users = userIds.length;
  summary.emails = await deleteTestMail().catch(() => "falhou");
  return summary;
}

// ---------------------------------------------------------------------------------------------
// Jornada
// ---------------------------------------------------------------------------------------------

async function journey() {
  const visitor = await newContext();
  const vp = await newPage(visitor);

  await step("Visitante: landing, Vitrine e ranking", async () => {
    const response = await open(vp, "/");
    assert(response?.status() === 200, `landing respondeu ${response?.status()}`);
    await visible(vp.getByRole("heading", { level: 1 }), "título da landing");
    await vp.getByRole("link", { name: "Explorar a Vitrine" }).first().click();
    await vp.waitForURL(/\/papers(\?|$)/);
    await visible(vp.locator("main a[href^='/papers/']"), "cartões de paper na Vitrine");
    await vp.locator(`main a[href='/papers/${SEED.paper}']`).first().click();
    await vp.waitForURL(new RegExp(`/papers/${SEED.paper}`));
    await visible(vp.getByRole("heading", { level: 1 }), "título do paper");
    await open(vp, "/ranking");
    await visible(
      vp.getByRole("heading", { name: "Destaques da comunidade" }),
      "título do ranking",
    );
    return "landing → /papers → paper → /ranking";
  });

  await step("Visitante: assina o Boletim", async () => {
    await open(vp, "/newsletter");
    await vp.getByLabel("Seu e-mail").fill(NEWS_EMAIL);
    await check(vp.getByRole("checkbox", { name: /Quero receber o Boletim Delas/ }));
    await check(vp.getByRole("checkbox", { name: /Tenho 18 anos ou mais/ }));
    await vp.getByRole("button", { name: "Assinar o boletim" }).click();
    await visible(vp.getByText(/confirma/i), "mensagem pedindo a confirmação");
    const row = await poll(async () => {
      const { data } = await db
        .from("newsletter_subscribers")
        .select("status")
        .eq("email", NEWS_EMAIL)
        .maybeSingle();
      return data;
    }, "inscrição gravada");
    assert(row.status === "pending", `status ${row.status} (esperado pending)`);
    ctx.subscribed = true;
    return "inscrição pendente (double opt-in)";
  });

  await step(
    "Visitante: confirma a inscrição pelo e-mail (Mailpit)",
    async () => {
      const mail = await waitForEmail(NEWS_EMAIL, { subject: /confirm/i });
      const link = linksIn(mail).find((href) => href.includes("/newsletter/confirmar"));
      assert(link, "e-mail sem link de confirmação");
      await open(vp, toBase(link));
      await vp.getByRole("button", { name: "Confirmar inscrição" }).click();
      await visible(vp.getByText("Inscrição confirmada"), "“Inscrição confirmada”");
      const row = await poll(async () => {
        const { data } = await db
          .from("newsletter_subscribers")
          .select("status")
          .eq("email", NEWS_EMAIL)
          .maybeSingle();
        return data?.status === "active" ? data : null;
      }, "inscrição ativa");
      ctx.newsletterActive = Boolean(row);
      return `assunto: “${mail.Subject}”`;
    },
    { needs: ["subscribed"] },
  );

  // --- Cadastro e onboarding -----------------------------------------------------------------

  const novaContext = await newContext();
  const np = await newPage(novaContext);

  await step("Nova conta: cadastro", async () => {
    await open(np, "/cadastro");
    await np.getByLabel("Nome completo").fill(NEW_NAME);
    await np.getByLabel("E-mail").fill(NEW_EMAIL);
    await np.getByRole("textbox", { name: "Senha", exact: true }).fill(NEW_PASSWORD);
    await check(np.getByRole("checkbox", { name: /Li e aceito/ }));
    await np.getByRole("button", { name: "Criar conta" }).click();
    await visible(np.getByRole("heading", { name: "Confira seu e-mail" }), "“Confira seu e-mail”");
    const id = await poll(() => findUserIdByEmail(NEW_EMAIL), "conta criada no Auth");
    created.userIds.push(id);
    ctx.newUserId = id;
    return id;
  });

  await step(
    "Nova conta: confirma pelo link do e-mail (Mailpit)",
    async () => {
      const mail = await waitForEmail(NEW_EMAIL, { subject: /confirme/i });
      const link = linksIn(mail).find((href) => href.includes("/auth/confirm"));
      assert(link, "e-mail sem link /auth/confirm");
      await open(np, toBase(link));
      await np.waitForURL(/\/onboarding/);
      await visible(np.getByRole("heading", { name: "Sobre você" }), "etapa 1 do onboarding");
      ctx.confirmed = true;
      ctx.novaCookies = await novaContext.cookies();
      return `assunto: “${mail.Subject}” → /onboarding`;
    },
    { needs: ["newUserId"] },
  );

  if (ctx.confirmed && !SKIP_SWEEP) {
    // A tela de onboarding só existe antes de concluir: capturamos agora.
    await sweepRole("nova", ["/onboarding"], ctx.novaCookies, { collectLinks: false });
  }

  await step(
    "Onboarding: 4 etapas",
    async () => {
      // 1. Sobre você
      await np.getByLabel("Fase da carreira").selectOption({ label: "Mestrado" });
      await np.getByLabel("Instituição").fill("IFSP Jacareí (teste automatizado)");
      await np.getByLabel("Cidade").fill("Jacareí");
      await np.getByLabel("Estado").selectOption("SP");
      await np.getByRole("button", { name: "Salvar e continuar" }).click();
      await visible(np.getByRole("heading", { name: "Sua pesquisa" }), "etapa 2");

      // 2. Pesquisa
      await np.locator("summary", { hasText: "Ciências Exatas e da Terra" }).click();
      await check(np.getByRole("checkbox", { name: "Ciência da Computação", exact: true }));
      const keywords = np.getByRole("textbox", { name: /^Palavras-chave/ });
      for (const word of ["visão computacional", "ensino de programação"]) {
        await keywords.fill(word);
        await keywords.press("Enter");
      }
      await np.getByRole("button", { name: "Salvar e continuar" }).click();
      await visible(np.getByRole("heading", { name: "Mentoria", exact: true }), "etapa 3");

      // 3. Mentoria
      await check(np.getByRole("switch", { name: /^Quero ser mentorada/ }));
      await np
        .getByRole("textbox", { name: /^O que você busca na mentoria/ })
        .fill("Quero orientação para publicar meu primeiro artigo e planejar o doutorado.");
      await check(np.getByRole("checkbox", { name: "Programação e análise de dados" }));
      await check(np.getByRole("checkbox", { name: "Carreira acadêmica" }));
      await np.getByRole("button", { name: "Salvar e continuar" }).click();
      await visible(np.getByRole("heading", { name: "Privacidade e IA" }), "etapa 4");

      // 4. Privacidade: sem consentimento de IA (as sugestões funcionam sem ele).
      await np.getByRole("button", { name: "Concluir cadastro" }).click();
      await np.waitForURL((url) => !url.pathname.startsWith("/onboarding"));
      const profile = await q(
        db
          .from("profiles")
          .select("onboarded_at, seeks_mentorship, ai_consent, career_stage")
          .eq("id", ctx.newUserId)
          .single(),
        "perfil",
      );
      assert(profile.onboarded_at, "onboarded_at continua vazio");
      assert(profile.seeks_mentorship, "seeks_mentorship não foi salvo");
      assert(!profile.ai_consent, "ai_consent deveria ser false");
      ctx.onboarded = true;
      return `concluído → ${new URL(np.url()).pathname}`;
    },
    { needs: ["confirmed"] },
  );

  await step(
    "Mentoria: sugestões sem IA e pedido à Marina",
    async () => {
      await open(np, "/mentoria?aba=sugestoes");
      await visible(np.getByText("Ativar sugestões com IA"), "cartão “Ativar sugestões com IA”");
      await np.getByRole("button", { name: "Encontrar mentoras" }).click();
      await visible(np.getByText(/Encontramos \d+ sugest/), "resultado das sugestões", 30_000);
      const card = np.locator("article", { hasText: "Marina Albuquerque" }).first();
      await visible(card, "Marina entre as sugestões");
      const suggestions = await q(
        db.from("mentor_suggestions").select("mentor_id, source").eq("mentee_id", ctx.newUserId),
        "sugestões",
      );
      assert(suggestions.length > 0, "nenhuma sugestão gravada");
      assert(
        suggestions.every((row) => row.source === "heuristic"),
        "sugestões deveriam ser heurísticas (sem consentimento de IA)",
      );
      await card.getByRole("button", { name: /Pedir mentoria/ }).click();
      const dialog = np.getByRole("dialog", { name: /Pedir mentoria a Marina/ });
      await visible(dialog, "diálogo do pedido");
      await dialog
        .getByLabel("Sua mensagem")
        .fill(
          `Olá, Marina! Sou mestranda em visão computacional no IFSP e gostaria de conversar sobre publicação e doutorado. (${TAG})`,
        );
      await dialog.getByRole("button", { name: "Enviar pedido" }).click();
      const request = await poll(async () => {
        const { data } = await db
          .from("mentorship_requests")
          .select("id, status")
          .eq("mentee_id", ctx.newUserId)
          .eq("mentor_id", SEED.marinaId)
          .maybeSingle();
        return data;
      }, "pedido gravado");
      assert(request.status === "pending", `status ${request.status}`);
      await visible(np.getByText(/Pedido enviado|aguardando|Aguardando/), "confirmação do pedido");
      ctx.requestId = request.id;
      return `${suggestions.length} sugestões heurísticas; pedido ${request.id}`;
    },
    { needs: ["onboarded"] },
  );

  await step(
    "Mentoria: Marina aceita e a mentoranda vê o contato",
    async () => {
      const marina = await newContext({ cookies: await sessionCookies(demo("marina")) });
      const mp = await newPage(marina);
      await open(mp, "/mentoria?aba=recebidas");
      const card = mp.getByRole("listitem", { name: NEW_NAME });
      await visible(card, "pedido da nova conta em “recebidas”");
      await card
        .getByRole("textbox", { name: /^Resposta para/ })
        .fill("Que bom te conhecer! Vamos marcar uma conversa na próxima semana.");
      await card.getByRole("button", { name: "Aceitar mentoria" }).click();
      await poll(async () => {
        const { data } = await db
          .from("mentorship_requests")
          .select("status")
          .eq("id", ctx.requestId)
          .single();
        return data?.status === "accepted";
      }, "pedido aceito");
      await mp.close();

      await open(np, "/mentoria?aba=ativas");
      await visible(np.getByText(demo("marina")), "e-mail da Marina na mentoria ativa");
      await open(np, "/notificacoes");
      await visible(np.getByText("Seu pedido de mentoria foi aceito"), "aviso de aceite");
      ctx.mentorshipAccepted = true;
      return "contato visível + aviso";
    },
    { needs: ["requestId"] },
  );

  // --- Fórum ---------------------------------------------------------------------------------

  await step(
    "Fórum: novo tópico e resposta",
    async () => {
      ctx.threadTitle = `Como organizar a rotina do mestrado? (${TAG})`;
      await open(np, "/forum/novo");
      await np.getByLabel("Categoria").selectOption({ label: "Carreira acadêmica" });
      await np.getByLabel("Título").fill(ctx.threadTitle);
      await np
        .getByRole("textbox", { name: "Texto" })
        .fill("Estou no primeiro ano e quero dicas de rotina entre disciplinas e pesquisa.");
      await np.getByRole("button", { name: "Publicar tópico" }).click();
      await np.waitForURL(/\/forum\/t\/[0-9a-f-]{36}/);
      ctx.threadId = np.url().match(/\/forum\/t\/([0-9a-f-]{36})/)[1];
      created.threadIds.push(ctx.threadId);
      await visible(np.getByRole("heading", { level: 1, name: ctx.threadTitle }), "título");

      const reply = `Atualizando: já montei um quadro semanal e está ajudando. (${TAG})`;
      await np.getByRole("textbox", { name: "Sua resposta" }).fill(reply);
      await np.getByRole("button", { name: "Publicar resposta" }).click();
      await visible(np.getByText(reply), "resposta publicada");
      return ctx.threadId;
    },
    { needs: ["onboarded"] },
  );

  await step(
    "Fórum: reação “Apoio” num tópico",
    async () => {
      await open(np, `/forum/t/${SEED.pinnedThread}`);
      const button = np
        .getByRole("group", { name: /Reagir ao tópico/ })
        .getByRole("button", { name: "Apoio" });
      await button.click();
      await poll(
        async () => (await button.getAttribute("aria-pressed")) === "true",
        "aria-pressed=true",
      );
      await poll(async () => {
        const { data } = await db
          .from("forum_reactions")
          .select("id")
          .eq("user_id", ctx.newUserId)
          .eq("thread_id", SEED.pinnedThread)
          .eq("kind", "support");
        return data?.length === 1;
      }, "reação gravada");
      return "aria-pressed + linha em forum_reactions";
    },
    { needs: ["onboarded"] },
  );

  await step(
    "Fórum: tópico anônimo em “Rede de apoio”",
    async () => {
      ctx.anonTitle = `Relato de teste automatizado (${TAG})`;
      await open(np, "/forum/novo");
      await np
        .getByLabel("Categoria")
        .selectOption({ label: "Rede de apoio — assédio e desafios (aceita anonimato)" });
      await check(np.getByRole("switch", { name: /^Publicar anonimamente/ }));
      await np.getByLabel("Título").fill(ctx.anonTitle);
      await np
        .getByRole("textbox", { name: "Texto" })
        .fill("Texto fictício para testar o anonimato e a moderação. Nada aconteceu de verdade.");
      await np.getByRole("button", { name: "Publicar tópico" }).click();
      await np.waitForURL(/\/forum\/t\/[0-9a-f-]{36}/);
      ctx.anonThreadId = np.url().match(/\/forum\/t\/([0-9a-f-]{36})/)[1];
      created.threadIds.push(ctx.anonThreadId);
      const row = await q(
        db
          .from("forum_threads")
          .select("author_id, is_anonymous")
          .eq("id", ctx.anonThreadId)
          .single(),
        "tópico anônimo",
      );
      assert(row.is_anonymous && row.author_id === null, "tópico não ficou anônimo no banco");
      const article = np.getByRole("article").first();
      assert(
        !(await article.innerText()).includes(NEW_NAME),
        "o nome da autora aparece no tópico anônimo",
      );
      return ctx.anonThreadId;
    },
    { needs: ["onboarded"] },
  );

  await step(
    "Fórum: gabriela@ denuncia o tópico anônimo",
    async () => {
      const gab = await newContext({ cookies: await sessionCookies(demo("gabriela")) });
      const gp = await newPage(gab);
      await open(gp, `/forum/t/${ctx.anonThreadId}`);
      await gp.getByRole("article").first().getByRole("button", { name: "Denunciar" }).click();
      const dialog = gp.getByRole("dialog");
      await visible(dialog, "diálogo de denúncia");
      await check(dialog.getByRole("radio", { name: "Outro motivo" }));
      await dialog.getByLabel("Detalhes").fill(`Denúncia de teste automatizado (${TAG}).`);
      await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
      await visible(gp.getByText("Recebemos sua denúncia"), "confirmação da denúncia");
      const report = await poll(async () => {
        const { data } = await db
          .from("reports")
          .select("id, status")
          .eq("target_id", ctx.anonThreadId)
          .maybeSingle();
        return data;
      }, "denúncia gravada");
      created.reportIds.push(report.id);
      ctx.reportId = report.id;
      await gp.close();
      return report.id;
    },
    { needs: ["anonThreadId"] },
  );

  // --- Moderação -----------------------------------------------------------------------------

  const reportCard = (page) => page.locator("article", { hasText: ctx.anonTitle }).first();

  await step(
    "Moderação: moderacao@ tranca o tópico (sem acesso a “Revelar autoria”)",
    async () => {
      const mod = await newContext({ cookies: await sessionCookies(demo("moderacao")) });
      ctx.modPage = await newPage(mod);
      await open(ctx.modPage, "/admin");
      const card = reportCard(ctx.modPage);
      await visible(card, "denúncia na fila da moderação");
      assert(
        (await card.getByRole("button", { name: "Revelar autoria" }).count()) === 0,
        "moderadora vê “Revelar autoria” (deveria ser só admin)",
      );
      await card.getByRole("button", { name: "Trancar respostas" }).click();
      await poll(async () => {
        const { data } = await db
          .from("forum_threads")
          .select("is_locked")
          .eq("id", ctx.anonThreadId)
          .single();
        return data?.is_locked;
      }, "tópico trancado");
      await visible(card.getByRole("button", { name: "Destrancar" }), "botão “Destrancar”");
      ctx.locked = true;
      return "is_locked = true";
    },
    { needs: ["reportId"] },
  );

  await step(
    "Moderação: admin@ revela a autoria com motivo (registro)",
    async () => {
      const adm = await newContext({ cookies: await sessionCookies(demo("admin")) });
      ctx.adminPage = await newPage(adm);
      await open(ctx.adminPage, "/admin");
      const card = reportCard(ctx.adminPage);
      await visible(card, "denúncia no painel da admin");
      await card.getByRole("button", { name: "Revelar autoria" }).click();
      const dialog = ctx.adminPage.getByRole("dialog");
      await visible(dialog, "diálogo de revelação");
      ctx.revealReason = `Teste automatizado da jornada (${TAG}): conferir o registro da revelação.`;
      await dialog.getByLabel("Motivo da revelação").fill(ctx.revealReason);
      await check(dialog.getByRole("checkbox", { name: /Entendo que este é um caso grave/ }));
      await dialog.getByRole("button", { name: "Revelar autoria" }).click();
      await visible(dialog.getByText(NEW_NAME), "nome revelado no diálogo");
      const audit = await poll(async () => {
        const { data } = await db
          .from("moderation_audit_log")
          .select("action, reason, actor_id")
          .eq("target_id", ctx.anonThreadId)
          .eq("action", "reveal_author");
        return data?.[0];
      }, "linha reveal_author no registro");
      assert(audit.reason === ctx.revealReason, "motivo diferente do digitado no registro");
      await ctx.adminPage.keyboard.press("Escape");
      return "reveal_author registrado com o motivo";
    },
    { needs: ["reportId"] },
  );

  await step(
    "Moderação: resolve a denúncia e gabriela@ recebe o aviso",
    async () => {
      const page = ctx.modPage;
      await open(page, "/admin");
      const card = reportCard(page);
      await visible(card, "denúncia ainda aberta");
      ctx.resolutionNote = `Obrigada por avisar, já cuidamos disso. (${TAG})`;
      await card.getByLabel(/Nota para quem denunciou/).fill(ctx.resolutionNote);
      await card.getByRole("button", { name: "Marcar como resolvida" }).click();
      await poll(async () => {
        const { data } = await db
          .from("reports")
          .select("status, resolution_note")
          .eq("id", ctx.reportId)
          .single();
        return data?.status === "resolved";
      }, "denúncia resolvida");
      const actions = await q(
        db
          .from("moderation_audit_log")
          .select("action")
          .or(`target_id.eq.${ctx.anonThreadId},report_id.eq.${ctx.reportId}`),
        "registro",
      );
      const names = actions.map((row) => row.action);
      for (const expected of ["lock_thread", "reveal_author", "resolve_report"]) {
        assert(names.includes(expected), `registro sem ${expected} (tem: ${names.join(", ")})`);
      }

      const gab = await newContext({ cookies: await sessionCookies(demo("gabriela")) });
      const gp = await newPage(gab);
      await open(gp, "/notificacoes");
      await visible(gp.getByText("Sua denúncia foi resolvida"), "aviso para quem denunciou");
      await visible(gp.getByText(ctx.resolutionNote, { exact: false }), "nota no aviso");
      await gp.close();

      // A autora vê o tópico trancado (sem formulário de resposta).
      await open(np, `/forum/t/${ctx.anonThreadId}`);
      assert(
        (await np.getByRole("button", { name: "Publicar resposta" }).count()) === 0,
        "tópico trancado ainda aceita respostas",
      );
      return `registro: ${names.join(", ")}`;
    },
    { needs: ["locked"] },
  );

  // --- Vitrine -------------------------------------------------------------------------------

  await step(
    "Vitrine: divulga paper pelo DOI (Crossref)",
    async () => {
      await open(np, "/papers/novo");
      await np.getByLabel(/^DOI/).fill(LOOKUP_DOI);
      await np.getByRole("button", { name: "Buscar dados pelo DOI" }).click();
      const title = np.getByLabel("Título");
      // A busca termina com o título preenchido ou com o aviso de erro do formulário (Crossref fora
      // do ar, sem rede no servidor, DOI não encontrado ou já na Vitrine): nos dois casos, segue.
      const lookupError = np.getByText(
        /O Crossref não respondeu|Não encontramos esse DOI|O Crossref respondeu num formato|já está na Vitrine/,
      );
      let viaLookup = false;
      let fallback = "";
      try {
        await poll(
          async () =>
            (await title.inputValue()).trim().length > 0 || (await lookupError.count()) > 0,
          "resposta da busca no Crossref",
          { timeout: 30_000 },
        );
        viaLookup = (await title.inputValue()).trim().length > 0;
        if (!viaLookup) fallback = (await lookupError.first().innerText()).trim();
      } catch {
        fallback = "a busca não respondeu em 30 s";
      }
      const { data: existing } = await db
        .from("papers")
        .select("id")
        .eq("doi", LOOKUP_DOI)
        .maybeSingle();
      if (!viaLookup || existing) {
        // Caminho alternativo: Crossref fora do ar/lento ou DOI já na Vitrine.
        if (viaLookup) fallback = "DOI já na Vitrine";
        viaLookup = false;
        await np.getByLabel(/^DOI/).fill(`10.5555/${TAG}`);
        await title.fill(`Paper de teste automatizado (${TAG})`);
        const authors = np.getByLabel("Autoras e autores");
        await authors.fill("Ana Teste");
        await authors.press("Enter");
      }
      const abstract = np.getByLabel("Resumo do paper (abstract)");
      if ((await abstract.inputValue()).trim().length < 50) {
        await abstract.fill(
          "Resumo de teste automatizado com mais de cinquenta caracteres para validar o envio do paper.",
        );
      }
      const area = np.getByLabel("Área");
      const options = await area
        .locator("option")
        .evaluateAll((items) =>
          items.map((item) => ({ value: item.value, label: item.textContent?.trim() })),
        );
      const choice =
        options.find((option) => option.label === "Genética") ?? options.find((o) => o.value);
      await area.selectOption(choice.value);
      await check(np.getByRole("radio", { name: /indicando o trabalho de outra/ }));
      await check(np.getByRole("checkbox", { name: /Confirmo que este trabalho tem autoria/ }));
      await np
        .getByLabel(/Resumo em linguagem simples/)
        .fill(`Mostra como cortar o DNA em pontos escolhidos, base da edição genética. (${TAG})`);
      await np.getByRole("button", { name: "Publicar na Vitrine" }).click();
      await np.waitForURL(/\/papers\/[0-9a-f-]{36}(\?|$)/, { timeout: 30_000 });
      await visible(np.getByText("Paper publicado na Vitrine!"), "confirmação da publicação");
      ctx.paperId = np.url().match(/\/papers\/([0-9a-f-]{36})/)[1];
      created.paperIds.push(ctx.paperId);
      ctx.paperTitle = (await np.getByRole("heading", { level: 1 }).innerText()).trim();
      return `${viaLookup ? "dados do Crossref" : `preenchido à mão (${fallback})`} → ${ctx.paperId}`;
    },
    { needs: ["onboarded"] },
  );

  await step(
    "Vitrine: larissa@ destaca o paper e ele entra no ranking",
    async () => {
      const lar = await newContext({ cookies: await sessionCookies(demo("larissa")) });
      const lp = await newPage(lar);
      await open(lp, `/papers/${ctx.paperId}`);
      const vote = lp.getByRole("button", { name: /^Destacar “/ }).first();
      await vote.click();
      await poll(async () => (await vote.getAttribute("aria-pressed")) === "true", "voto marcado");
      await poll(async () => {
        const { data } = await db
          .from("papers")
          .select("vote_count")
          .eq("id", ctx.paperId)
          .single();
        return data?.vote_count === 1;
      }, "vote_count = 1");
      await lp.close();

      for (const url of ["/ranking", "/ranking?periodo=hot"]) {
        await open(vp, url);
        if ((await vp.locator(`main a[href='/papers/${ctx.paperId}']`).count()) > 0) {
          return `aparece em ${url}`;
        }
      }
      throw new Error("paper destacado não aparece no ranking (semana nem em alta)");
    },
    { needs: ["paperId"] },
  );

  // --- Boletim -------------------------------------------------------------------------------

  await step(
    "Boletim: admin@ gera e envia a edição da semana (Mailpit)",
    async () => {
      const page =
        ctx.adminPage ??
        (await newPage(await newContext({ cookies: await sessionCookies(demo("admin")) })));
      ctx.adminPage = page;
      const before = new Set(
        (await q(db.from("newsletter_editions").select("id"), "edições")).map((row) => row.id),
      );
      await open(page, "/admin?aba=newsletter");
      await page.getByRole("button", { name: "Gerar edição da semana" }).click();
      await visible(
        page.getByText(/gerada e publicada|já existia/),
        "resultado da geração",
        60_000,
      );
      // A edição nova (ou, se ela já existia antes do teste, a mais recente).
      const rows = await q(
        db
          .from("newsletter_editions")
          .select("id, slug, status, content")
          .order("period_end", { ascending: false })
          .limit(5),
        "edições",
      );
      const edition = rows.find((row) => !before.has(row.id)) ?? rows[0];
      assert(edition, "nenhuma edição encontrada");
      if (!before.has(edition.id)) created.editionIds.push(edition.id);
      const content = JSON.stringify(edition.content);
      assert(!content.includes(ctx.anonTitle ?? "§"), "o relato anônimo entrou no Boletim");
      assert(!content.includes(NEW_NAME), "nome de membra no conteúdo público do Boletim");

      await open(page, "/admin?aba=newsletter");
      const item = page.getByRole("listitem").filter({ hasText: edition.slug }).first();
      await visible(item, `edição ${edition.slug} na lista`);
      await item
        .getByRole("button", { name: /Preparar envio|Enviar/ })
        .first()
        .click();
      await visible(item.getByText(/receberá|receberão/), "prévia do envio");
      await item.getByRole("button", { name: "Confirmar envio" }).click();
      await visible(item.getByText("Envio processado"), "“Envio processado”", 60_000);

      const mail = await waitForEmail(NEWS_EMAIL, { subject: /Boletim/i, timeout: 60_000 });
      const html = String(mail.HTML);
      assert(!html.includes(NEW_NAME), "o e-mail do Boletim traz nome de membra");
      assert(!html.includes(ctx.anonTitle ?? "§"), "o e-mail do Boletim traz o relato anônimo");
      assert(
        linksIn(mail).some((href) => href.includes("/newsletter/cancelar?token=")),
        "e-mail sem link de descadastro",
      );
      const headers = await mailpit(`/api/v1/message/${mail.ID}/headers`);
      assert(headers["List-Unsubscribe"], "e-mail sem cabeçalho List-Unsubscribe");
      assert(headers["List-Unsubscribe-Post"], "e-mail sem List-Unsubscribe-Post");
      return `${edition.slug}: “${mail.Subject}”`;
    },
    { needs: ["newsletterActive"] },
  );

  ctx.adminPage = null;
  ctx.modPage = null;
}

// ---------------------------------------------------------------------------------------------
// Varredura: capturas, console, rolagem horizontal, links e foco
// ---------------------------------------------------------------------------------------------

const VARIANTS = [
  { theme: "light", width: 1440, height: 900 },
  { theme: "dark", width: 1440, height: 900 },
  { theme: "light", width: 390, height: 844 },
  { theme: "dark", width: 390, height: 844 },
];
const shots = [];
/** Links internos encontrados por papel (cada papel confere com a própria sessão). */
const linkSources = new Map();

async function overflowReport(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const extra = doc.scrollWidth - doc.clientWidth;
    if (extra <= 0) return null;
    const vw = doc.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= vw + 1) continue;
      // Ignora quem está dentro de um contêiner com rolagem própria.
      let parent = el.parentElement;
      let clipped = false;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string"
          ? `.${el.className.split(/\s+/).slice(0, 3).join(".")}`
          : "";
      offenders.push(`${el.tagName.toLowerCase()}${id}${cls} (right=${Math.round(rect.right)})`);
      if (offenders.length >= 4) break;
    }
    return { extra, offenders };
  });
}

/**
 * Contraste de texto (WCAG AA: 4,5:1; 3:1 para texto grande). Lê as cores renderizadas
 * (via canvas, funciona com oklch) e compõe os fundos semitransparentes até achar um opaco.
 * Pula texto sobre imagem/gradiente, oculto, desabilitado ou só para leitor de tela.
 */
async function contrastReport(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = "#000";
      g.fillStyle = color;
      g.fillRect(0, 0, 1, 1);
      const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
      return { r, g: gr, b, a: a / 255 };
    };
    const over = (top, bottom) => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    });
    const lum = ({ r, g: gg, b }) => {
      const f = (v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    const backgroundOf = (el) => {
      const layers = [];
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none") return null;
        const color = rgba(style.backgroundColor);
        if (color.a > 0) layers.push(color);
        if (color.a >= 1) break;
      }
      let result = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const hasText = [...el.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent.trim().length > 1,
      );
      if (!hasText) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (
        el.closest(
          "[aria-hidden='true'], [disabled], [aria-disabled='true'], fieldset:disabled, .sr-only, svg",
        )
      )
        continue;
      const style = getComputedStyle(el);
      if (style.visibility !== "visible") continue;
      let opacity = 1;
      for (let node = el; node; node = node.parentElement)
        opacity *= Number(getComputedStyle(node).opacity);
      if (opacity < 0.99) continue;
      const bg = backgroundOf(el);
      if (!bg) continue;
      const fg = over(rgba(style.color), bg);
      const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const min = large ? 3 : 4.5;
      if (ratio >= min - 0.02) continue;
      const text = el.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
      const key = `${text}|${ratio.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`${ratio.toFixed(2)}:1 (mín. ${min}) “${text}” <${el.tagName.toLowerCase()}>`);
      if (out.length >= 6) break;
    }
    return out;
  });
}

async function collectLinks(page, bucket) {
  const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((a) => a.href));
  const from = page.url().replace(BASE_URL, "") || "/";
  for (const href of hrefs) {
    if (!href.startsWith(BASE_URL)) continue;
    const url = href.split("#")[0];
    if (!url || url.includes("/auth/sair")) continue;
    if (!bucket.has(url)) bucket.set(url, from);
  }
}

/** Visita as páginas de um papel nas 4 variantes (tema × largura), com capturas e checagens. */
async function sweepRole(role, paths, cookies, { collectLinks: collect = true } = {}) {
  for (const variant of VARIANTS) {
    const context = await newContext({
      cookies,
      colorScheme: variant.theme,
      width: variant.width,
      height: variant.height,
    });
    const page = await newPage(context);
    for (const url of paths) {
      const label = `${role} ${variant.theme} ${variant.width} ${url}`;
      try {
        const response = await open(page, url);
        const status = response?.status() ?? 0;
        const expect404 = url === NOT_FOUND_PATH;
        if (expect404 ? status !== 404 : status >= 400) {
          issue("status", label, `HTTP ${status}${expect404 ? " (esperado 404)" : ""}`);
        }
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        if (theme !== variant.theme) issue("theme", label, `data-theme=${theme}`);
        const overflow = await overflowReport(page);
        if (overflow) {
          issue("overflow", label, `+${overflow.extra}px: ${overflow.offenders.join("; ") || "?"}`);
        }
        const file = path.join(
          OUT,
          "capturas",
          `${role}-${variant.theme}-${variant.width}-${slug(url)}.png`,
        );
        await page.screenshot({ path: file, fullPage: true });
        shots.push({ role, url, ...variant, file });
        if (variant.width === 1440) {
          for (const item of await contrastReport(page)) {
            issue("contrast", `${role} ${variant.theme} ${url}`, item);
          }
        }
        if (collect && variant.theme === "light" && variant.width === 1440) {
          if (!linkSources.has(role)) linkSources.set(role, { cookies, links: new Map() });
          await collectLinks(page, linkSources.get(role).links);
        }
      } catch (error) {
        issue(
          "sweep",
          label,
          error instanceof Error ? error.message.split("\n")[0] : String(error),
        );
      }
    }
    await context.close();
  }
}

async function checkLinks(cookies, bucket, who) {
  const context = await newContext({ cookies });
  let checked = 0;
  for (const [url, from] of bucket) {
    if (url.includes(NOT_FOUND_PATH)) continue;
    checked += 1;
    try {
      const response = await context.request.get(url, { maxRedirects: 10, timeout: 30_000 });
      if (response.status() >= 400) {
        issue("link", `${who} (em ${from})`, `${response.status()} ${url.replace(BASE_URL, "")}`);
      }
    } catch (error) {
      issue("link", `${who} (em ${from})`, `${url.replace(BASE_URL, "")}: ${error.message}`);
    }
  }
  await context.close();
  return checked;
}

/** Percorre a página com Tab e confere se cada elemento focado mostra um indicador visível. */
async function focusAudit(cookies, url, who, maxTabs = 40) {
  const context = await newContext({ cookies });
  const page = await newPage(context);
  await open(page, url);
  const missing = [];
  let seen = 0;
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const ringIn = (style) =>
        (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
        (style.boxShadow && style.boxShadow !== "none");
      // O anel pode estar no próprio elemento ou num pseudo-elemento (ex.: CardLink usa ::after).
      const hasRing = (node) =>
        node instanceof Element &&
        [null, "::after", "::before"].some((pseudo) => ringIn(getComputedStyle(node, pseudo)));
      const candidates = [
        el,
        el.parentElement,
        el.nextElementSibling,
        el.previousElementSibling,
        el.labels?.[0],
        el.closest("label"),
      ];
      const rect = el.getBoundingClientRect();
      return {
        name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 50),
        tag: el.tagName.toLowerCase(),
        ring: candidates.some(hasRing),
        size: rect.width * rect.height,
      };
    });
    if (!info) break;
    seen += 1;
    if (!info.ring) missing.push(`${info.tag} “${info.name}”`);
  }
  await context.close();
  for (const item of [...new Set(missing)])
    issue("focus", `${who} ${url}`, `sem indicador de foco: ${item}`);
  return seen;
}

function writeGallery() {
  const rows = shots
    .map(
      (shot) =>
        `<figure><figcaption>${shot.role} · ${shot.theme} · ${shot.width}px · ${shot.url}</figcaption><a href="capturas/${path.basename(shot.file)}"><img loading="lazy" src="capturas/${path.basename(shot.file)}" alt=""></a></figure>`,
    )
    .join("\n");
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Capturas da jornada ${TAG}</title><style>body{font:14px system-ui;margin:16px;background:#f4f2f8}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}figure{margin:0;background:#fff;padding:8px;border-radius:8px}img{width:100%;max-height:520px;object-fit:cover;object-position:top;border:1px solid #ddd}figcaption{font-size:12px;margin-bottom:6px}</style><h1>Capturas da jornada ${TAG}</h1><main>${rows}</main></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}

async function sweep() {
  const member = await sessionCookies(demo("larissa"));
  const mentor = await sessionCookies(demo("marina"));
  const adminCookies = await sessionCookies(demo("admin"));

  const visitorPaths = [
    "/",
    "/papers",
    `/papers/${SEED.paper}`,
    "/ranking",
    "/newsletter",
    `/newsletter/${SEED.edition}`,
    "/sobre",
    "/conduta",
    "/privacidade",
    "/entrar",
    "/cadastro",
    "/recuperar-senha",
    "/design-system",
    NOT_FOUND_PATH,
  ];
  const memberPaths = [
    "/",
    "/forum",
    "/forum/c/carreira",
    `/forum/t/${SEED.pinnedThread}`,
    "/forum/novo",
    "/mentoria",
    "/mentoria?aba=enviadas",
    "/pesquisadoras",
    `/pesquisadoras/${SEED.marinaId}`,
    "/perfil",
    "/notificacoes",
    "/papers/novo",
    "/ranking?aba=comunidade",
    ...(ctx.paperId ? [`/papers/${ctx.paperId}`] : []),
  ];

  await step("Varredura: visitante (14 páginas × 4 variantes)", async () => {
    await sweepRole("visitante", visitorPaths, undefined);
    return `${visitorPaths.length * 4} capturas`;
  });
  await step("Varredura: membra larissa@ (× 4 variantes)", async () => {
    await sweepRole("membra", memberPaths, member);
    return `${memberPaths.length * 4} capturas`;
  });
  await step("Varredura: mentora marina@ e admin@ (× 4 variantes)", async () => {
    await sweepRole("mentora", ["/mentoria?aba=recebidas", "/mentoria?aba=ativas"], mentor);
    await sweepRole(
      "admin",
      ["/admin", "/admin?aba=newsletter", "/admin?aba=membros", "/admin?aba=registro"],
      adminCookies,
    );
    return "12 capturas da mentora + 16 da admin";
  });
  await step("Links internos de cada papel (< 400)", async () => {
    const counts = [];
    for (const [role, source] of linkSources) {
      counts.push(`${await checkLinks(source.cookies, source.links, role)} (${role})`);
    }
    return `links conferidos: ${counts.join(", ")}`;
  });
  await step("Foco visível pelo teclado", async () => {
    let total = 0;
    for (const url of ["/", "/newsletter", "/cadastro", "/papers"]) {
      total += await focusAudit(undefined, url, "visitante");
    }
    for (const url of ["/forum/novo", "/mentoria", "/perfil"]) {
      total += await focusAudit(member, url, "membra");
    }
    total += await focusAudit(adminCookies, "/admin", "admin");
    return `${total} paradas de Tab conferidas`;
  });
  await step("Menu do celular (390 px): abre, prende o foco e fecha com Esc", async () => {
    const context = await newContext({ cookies: member, width: 390, height: 844 });
    const page = await newPage(context);
    await open(page, "/forum");
    const trigger = page.getByRole("button", { name: "Abrir menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("dialog", { name: "Menu principal" });
    await visible(menu, "menu aberto");
    assert(
      (await trigger.getAttribute("aria-expanded")) === "true",
      "aria-expanded não virou true",
    );
    for (const name of ["Fórum", "Mentoria", "Pesquisadoras", "Papers"]) {
      await visible(menu.getByRole("link", { name, exact: true }), `link “${name}” no menu`);
    }
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press("Tab");
      // <dialog> modal nativo: o resto da página fica inerte. Depois do último item o foco
      // pode ir para a interface do navegador (activeElement = body), nunca para a página.
      const inside = await page.evaluate(() => {
        const el = document.activeElement;
        return !el || el === document.body || el.closest("dialog[open]") !== null;
      });
      assert(inside, "o foco saiu do menu aberto (Tab)");
    }
    await page.keyboard.press("Escape");
    await poll(async () => !(await menu.isVisible()), "menu fechado");
    assert((await trigger.getAttribute("aria-expanded")) === "false", "aria-expanded não voltou");
    const back = await page.evaluate(() => document.activeElement?.textContent?.trim());
    assert(back === "Abrir menu", `o foco não voltou ao botão (está em “${back}”)`);
    await context.close();
    return "aria-expanded, foco preso e devolvido";
  });
  writeGallery();
}

// ---------------------------------------------------------------------------------------------
// GitHub Actions: anotações de erro e resumo do job (só quando GITHUB_ACTIONS=true)
// ---------------------------------------------------------------------------------------------

/** Mensagem de um comando de workflow (`::error ...::mensagem`): %, \r e \n viram escapes. */
const ghMessage = (value) =>
  String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
/** Valor de propriedade (`title=`): além dos escapes da mensagem, `:` e `,`. */
const ghProperty = (value) => ghMessage(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
/** Célula de tabela Markdown numa linha só. */
const mdCell = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .slice(0, 300);

function reportToGithub(failed, grouped) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  for (const item of failed) {
    const level = item.status === "fail" ? "error" : "warning";
    console.log(
      `::${level} title=${ghProperty(`Jornada E2E: ${item.name}`)}::${ghMessage(item.detail)}`,
    );
  }
  for (const [kind, list] of Object.entries(grouped)) {
    const sample = list
      .slice(0, 5)
      .map((item) => `${item.where}: ${item.detail}`)
      .join("\n");
    const more = list.length > 5 ? `\n… e mais ${list.length - 5} (report.json no artefato)` : "";
    console.log(
      `::error title=${ghProperty(`Jornada E2E: ${list.length} problema(s) [${kind}]`)}::${ghMessage(sample + more)}`,
    );
  }

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  const label = { ok: "ok", fail: "falhou", skip: "pulada" };
  const lines = [
    "## Jornada E2E",
    "",
    `Etapas: **${steps.length - failed.length}/${steps.length} ok** · capturas: ${shots.length} · ` +
      `problemas nas verificações: **${issues.length}**`,
    "",
    "| Situação | Etapa | Detalhe | Tempo |",
    "| --- | --- | --- | --- |",
    ...steps.map(
      (item) =>
        `| ${label[item.status] ?? item.status} | ${mdCell(item.name)} | ${mdCell(item.detail)} | ` +
        `${item.ms ? `${(item.ms / 1000).toFixed(1)} s` : ""} |`,
    ),
  ];
  for (const [kind, list] of Object.entries(grouped)) {
    lines.push("", `### Problemas [${kind}]: ${list.length}`, "");
    for (const item of list.slice(0, 15))
      lines.push(`- ${mdCell(item.where)}: ${mdCell(item.detail)}`);
    if (list.length > 15) lines.push(`- … e mais ${list.length - 15} (report.json no artefato)`);
  }
  try {
    fs.appendFileSync(summaryFile, `${lines.join("\n")}\n`);
  } catch (error) {
    console.warn(`Não consegui escrever o resumo do job: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(path.join(OUT, "capturas"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "falhas"), { recursive: true });
  console.log(`Jornada ${TAG} contra ${BASE_URL} (saída em ${OUT})`);

  const health = await fetch(BASE_URL).catch(() => null);
  if (!health?.ok) {
    console.error(`O app não respondeu em ${BASE_URL}.`);
    process.exit(2);
  }
  await mailpit("/api/v1/info").catch(() => {
    console.error(`O Mailpit não respondeu em ${MAILPIT}.`);
    process.exit(2);
  });

  const leftovers = await cleanup();
  if (Object.values(leftovers).some((value) => typeof value === "number" && value > 0)) {
    console.log(`Sobras de execuções anteriores apagadas: ${JSON.stringify(leftovers)}`);
  }

  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  let exitCode = 0;
  try {
    if (!ONLY_SWEEP) await journey();
    if (!SKIP_SWEEP) await sweep();
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
    if (KEEP_DATA) {
      console.log("KEEP_DATA=1: dados mantidos (rode de novo para limpar).");
    } else {
      await step("Limpeza dos dados do teste", async () => JSON.stringify(await cleanup()));
    }
  }

  const failed = steps.filter((item) => item.status !== "ok");
  const grouped = {};
  for (const item of issues) (grouped[item.kind] ??= []).push(item);
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ tag: TAG, baseUrl: BASE_URL, steps, issues, shots: shots.length }, null, 2),
  );

  console.log("\n=== Resumo ===");
  console.log(`Etapas: ${steps.length - failed.length}/${steps.length} ok`);
  for (const item of failed)
    console.log(`  ${item.status.toUpperCase()} ${item.name}: ${item.detail}`);
  console.log(`Capturas: ${shots.length} (galeria: ${path.join(OUT, "index.html")})`);
  if (issues.length === 0) {
    console.log("Verificações: nenhum problema (console, hidratação, HTTP, rolagem, links, foco).");
  } else {
    console.log(`Verificações: ${issues.length} problema(s)`);
    for (const [kind, list] of Object.entries(grouped)) {
      console.log(`  [${kind}] ${list.length}`);
      for (const item of list.slice(0, 15)) console.log(`    - ${item.where}: ${item.detail}`);
      if (list.length > 15) console.log(`    … e mais ${list.length - 15} (report.json)`);
    }
  }
  reportToGithub(failed, grouped);
  if (failed.length > 0 || issues.length > 0) exitCode = 1;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
