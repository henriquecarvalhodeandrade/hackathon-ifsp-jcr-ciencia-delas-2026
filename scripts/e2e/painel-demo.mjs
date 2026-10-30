#!/usr/bin/env node
/**
 * E2E do /painel e do modo demonstração (docs/14-painel-e-modo-demo.md), com Playwright, contra o
 * app rodando de verdade e o Supabase local com o seed (supabase/seed.sql + supabase/seeds/*.sql).
 *
 * O que o script confere, em ordem:
 *   1. Visitante: GET /painel → /entrar?next=%2Fpainel; a landing (/) continua igual; sem aviso
 *      de demonstração.
 *   2. larissa@ entra pelo formulário SEM ?next → cai no /painel e vê "Seus próximos passos" e
 *      "O que está esperando você"; "/" leva ao /painel; "/?visao=publica" mostra a landing.
 *   3. marina@ (mentora) vê "Perguntas esperando por você" com um tópico do seed 10_painel.sql e o
 *      motivo ("Fala de: …").
 *   4. Com DEMO=1 (servidor com DEMO_MODE=true): /entrar mostra o cartão; /demo → "Entrar como
 *      Marina" → /painel com o aviso "você está como Marina"; trocar para a Larissa; um slug forjado
 *      (admin, moderacao, e-mail) é recusado sem mexer na sessão; excluir uma conta fictícia é
 *      recusado (com uma conta TEMPORÁRIA do domínio demo — nunca com as personas).
 *      Sem DEMO: /demo responde 404, /entrar não tem o cartão e não há aviso.
 *   5. Capturas claro/escuro × 1440/390 do /painel (larissa, marina) e do /demo e /entrar (com DEMO=1), com
 *      a checagem de rolagem horizontal da journey.mjs, contraste AA (1440 px), erros de console e
 *      avisos de hidratação.
 *
 * As asserções olham títulos de seção e links, não o estado de cada passo: outras execuções E2E
 * podem mudar as sugestões e mensagens da Larissa ao mesmo tempo.
 *
 * Pré-requisitos: Supabase local com o seed, .env.local com NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY (a chave secreta só cria/apaga a conta
 * temporária) e o app rodando em BASE_URL.
 *
 * Uso (na raiz do repositório)
 *   BASE_URL=http://localhost:3801 node scripts/e2e/painel-demo.mjs          # DEMO_MODE desligado
 *   DEMO=1 BASE_URL=http://localhost:3801 node scripts/e2e/painel-demo.mjs   # DEMO_MODE=true
 * Variáveis opcionais: OUT_DIR (capturas e report.json), DEMO_PASSWORD (senha das contas demo,
 * padrão ciencia-delas-demo), HEADED=1.
 * Sai com 1 se alguma etapa ou verificação falhar e com 2 se faltar pré-requisito.
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
    "Playwright não encontrado. Rode `npm install` e `npx playwright install chromium`.",
  );
  process.exit(2);
}
const { chromium } = loadPlaywright();

// ---------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3801").replace(/\/+$/, "");
const DEMO = process.env.DEMO === "1";
const PASSWORD = process.env.DEMO_PASSWORD ?? "ciencia-delas-demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const TAG_PREFIX = "e2e-painel";
const RUN = Date.now().toString(36);
const TAG = `${TAG_PREFIX}-${RUN}`;
const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), "artemis-e2e", TAG);
/** Conta temporária do domínio demo (só para o teste de exclusão recusada). */
const TEMP_EMAIL = `${TAG}@demo.cienciadelas.dev`;
const TEMP_PASSWORD = `senha-${RUN}-painel`;

const demo = (user) => `${user}@demo.cienciadelas.dev`;
/** Tópicos sem resposta do seed supabase/seeds/10_painel.sql. */
const SEEDED_QUESTIONS = [
  "Como começo a analisar meus dados em Python sem me perder?",
  "Vale a pena fazer o mestrado logo depois da graduação?",
];
const HEADINGS = {
  steps: "Seus próximos passos",
  waiting: "O que está esperando você",
  questionsMentor: "Perguntas esperando por você",
  questionsMember: "Sem resposta ainda: talvez você saiba ajudar",
  news: "Novidades da semana",
};
const DEMO_CARD = "Só quer conhecer? Entre como uma pessoa fictícia";
const DEMO_DELETE_REFUSED = "Contas de demonstração não podem ser excluídas.";
const LANDING_HERO = "#hero-titulo";

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
// Etapas, problemas e navegador
// ---------------------------------------------------------------------------------------------

const steps = [];
const issues = [];
const contexts = [];
const ctx = {};
let browser;
let activePage = null;
let stepIndex = 0;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function dumpFailure(name) {
  if (!activePage || activePage.isClosed()) return;
  const base = path.join(OUT, "falhas", `${String(stepIndex).padStart(2, "0")}-${slug(name)}`);
  try {
    fs.mkdirSync(path.dirname(base), { recursive: true });
    await activePage.screenshot({ path: `${base}.png`, fullPage: true });
    const snapshot = await activePage.locator("body").ariaSnapshot({ timeout: 5000 });
    fs.writeFileSync(`${base}.txt`, `${activePage.url()}\n\n${snapshot}`);
  } catch {
    // a página pode ter fechado
  }
}

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

const HYDRATION = /hydrat|did not match|server rendered html|Minified React error #(418|423|425)/i;

function watch(page, { allow404 = false } = {}) {
  page.on("console", (message) => {
    const text = message.text();
    const where = page.url().replace(BASE_URL, "") || "/";
    if (HYDRATION.test(text)) return issue("hydration", where, text.slice(0, 400));
    if (message.type() !== "error") return;
    if (allow404 && /status of 404/.test(text)) return;
    issue("console", where, text.slice(0, 400));
  });
  page.on("pageerror", (error) =>
    issue("pageerror", page.url().replace(BASE_URL, "") || "/", error.message.slice(0, 400)),
  );
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(BASE_URL) || response.status() < 400) return;
    if (allow404 && response.status() === 404) return;
    issue("http", page.url().replace(BASE_URL, "") || "/", `${response.status()} ${url}`);
  });
}

const cookieCache = new Map();

/** Cookies de sessão (formato @supabase/ssr) de uma conta, sem passar pela tela de login. */
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

async function newPage(context, options) {
  const page = await context.newPage();
  watch(page, options);
  activePage = page;
  return page;
}

async function open(page, url) {
  activePage = page;
  const response = await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return response;
}

async function visible(locator, what, timeout = 15_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`Não apareceu: ${what}`);
  }
}

function pathOf(page) {
  const url = new URL(page.url());
  return { pathname: url.pathname, search: url.search, next: url.searchParams.get("next") };
}

const region = (page, name) => page.getByRole("region", { name, exact: true });
const banner = (page) => page.getByRole("region", { name: "Modo demonstração", exact: true });

/** Encerra a sessão do navegador (POST /auth/sair, escopo local) — limpa o que o teste abriu. */
async function signOutIn(context) {
  try {
    await context.request.post(`${BASE_URL}/auth/sair`, {
      headers: { origin: BASE_URL },
      maxRedirects: 0,
    });
  } catch {
    // sessão já encerrada
  }
}

// ---------------------------------------------------------------------------------------------
// Conta temporária (só para o teste de exclusão recusada)
// ---------------------------------------------------------------------------------------------

async function listTempUsers() {
  const found = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const user of data.users) {
      if (user.email?.startsWith(`${TAG_PREFIX}-`)) found.push(user.id);
    }
    if (data.users.length < 200) break;
  }
  return found;
}

async function cleanup() {
  for (const id of await listTempUsers()) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) issue("cleanup", id, error.message);
  }
}

async function createTempDemoUser() {
  const { data, error } = await db.auth.admin.createUser({
    email: TEMP_EMAIL,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Painel E2E", demo: true },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const { error: profileError } = await db
    .from("profiles")
    .update({
      full_name: `Painel E2E ${RUN}`,
      headline: "Conta temporária do teste E2E (fictícia)",
      career_stage: "undergraduate",
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);
  if (profileError) throw new Error(`perfil temporário: ${profileError.message}`);
  return data.user.id;
}

// ---------------------------------------------------------------------------------------------
// Capturas (claro/escuro × 1440/390) com rolagem horizontal e contraste — como na journey.mjs
// ---------------------------------------------------------------------------------------------

const VARIANTS = [
  { theme: "light", width: 1440, height: 900 },
  { theme: "dark", width: 1440, height: 900 },
  { theme: "light", width: 390, height: 844 },
  { theme: "dark", width: 390, height: 844 },
];
const shots = [];

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

async function capture(role, url, cookies) {
  for (const variant of VARIANTS) {
    const context = await newContext({
      cookies,
      colorScheme: variant.theme,
      width: variant.width,
      height: variant.height,
    });
    const page = await newPage(context);
    const label = `${role} ${variant.theme} ${variant.width} ${url}`;
    try {
      const response = await open(page, url);
      const status = response?.status() ?? 0;
      if (status >= 400) issue("status", label, `HTTP ${status}`);
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
        for (const item of await contrastReport(page)) issue("contrast", label, item);
      }
    } catch (error) {
      issue(
        "capture",
        label,
        error instanceof Error ? error.message.split("\n")[0] : String(error),
      );
    }
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Jornada
// ---------------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(path.join(OUT, "capturas"), { recursive: true });
  try {
    const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`O app não respondeu em ${BASE_URL} (${error.message}).`);
    process.exit(2);
  }

  console.log(`Painel + modo demonstração — ${BASE_URL} (DEMO=${DEMO ? "1" : "0"}) · ${TAG}`);
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  await cleanup();

  // 1. Visitante -------------------------------------------------------------------------------
  await step("Visitante: /painel pede login (next=/painel)", async () => {
    const page = await newPage(await newContext());
    await open(page, "/painel");
    await page.waitForURL(/\/entrar\?/, { timeout: 15_000 });
    const where = pathOf(page);
    assert(where.pathname === "/entrar", `foi para ${where.pathname}`);
    assert(where.next === "/painel", `next=${where.next}`);
    await visible(
      page.getByRole("heading", { level: 1, name: "Entrar na Artemis" }),
      "tela de login",
    );
    const hasCard = (await page.getByText(DEMO_CARD).count()) > 0;
    assert(
      hasCard === DEMO,
      DEMO
        ? "faltou o cartão do modo demonstração"
        : "cartão do modo demonstração apareceu com DEMO_MODE desligado",
    );
    return DEMO ? "com o cartão do modo demonstração" : "sem o cartão do modo demonstração";
  });

  await step("Visitante: a landing (/) continua igual, sem aviso de demonstração", async () => {
    const page = await newPage(await newContext());
    const response = await open(page, "/");
    assert(response?.status() === 200, `HTTP ${response?.status()}`);
    assert(pathOf(page).pathname === "/", `foi para ${page.url()}`);
    await visible(page.locator(LANDING_HERO), "título da landing");
    assert((await banner(page).count()) === 0, "aviso de demonstração para visitante");
  });

  // 2. Larissa (mentoranda) --------------------------------------------------------------------
  await step("larissa@ entra pelo formulário sem next e cai no /painel", async () => {
    const context = await newContext();
    const page = await newPage(context);
    await open(page, "/entrar");
    await page.getByLabel("E-mail").fill(demo("larissa"));
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/painel", { timeout: 30_000 });
    await visible(
      page.getByRole("heading", { level: 1, name: /^Que bom te ver, Larissa\./ }),
      "saudação",
    );
    await visible(page.getByRole("heading", { level: 2, name: HEADINGS.steps }), HEADINGS.steps);
    await visible(
      page.getByRole("heading", { level: 2, name: HEADINGS.waiting }),
      HEADINGS.waiting,
    );
    await visible(
      page.getByRole("heading", { level: 2, name: HEADINGS.questionsMember }),
      HEADINGS.questionsMember,
    );
    await visible(page.getByRole("heading", { level: 2, name: HEADINGS.news }), HEADINGS.news);
    const meter = page.getByRole("meter", { name: "Seu caminho na Artemis" });
    const valueText = await meter.getAttribute("aria-valuetext");
    assert(/^\d de 5$/.test(valueText ?? ""), `medidor: ${valueText}`);
    const stepsRegion = region(page, HEADINGS.steps);
    assert(
      (await stepsRegion.getByRole("listitem").count()) === 5,
      "a mentoranda deveria ter 5 passos",
    );
    await visible(
      page.getByRole("link", { name: "Ver a página pública da Artemis" }),
      "link da página pública",
    );
    ctx.larissaContext = context;
    ctx.larissaPage = page;
    return `progresso ${valueText}`;
  });

  await step(
    "larissa@: '/' leva ao /painel; '/?visao=publica' mostra a landing",
    async () => {
      const page = ctx.larissaPage;
      await open(page, "/");
      await page.waitForURL((url) => url.pathname === "/painel", { timeout: 15_000 });
      await open(page, "/?visao=publica");
      assert(pathOf(page).pathname === "/", `foi para ${page.url()}`);
      await visible(page.locator(LANDING_HERO), "título da landing");
    },
    { needs: ["larissaPage"] },
  );

  await step(
    "larissa@: o menu da conta começa por “Meu painel”",
    async () => {
      const page = ctx.larissaPage;
      await open(page, "/forum");
      await page.getByRole("button", { name: /^Menu da conta de / }).click();
      const first = page.getByRole("menuitem").first();
      await visible(first, "itens do menu");
      const text = (await first.textContent())?.trim();
      assert(text?.startsWith("Meu painel"), `primeiro item: ${text}`);
      await first.click();
      await page.waitForURL((url) => url.pathname === "/painel", { timeout: 15_000 });
    },
    { needs: ["larissaPage"] },
  );

  // 3. Marina (mentora) ------------------------------------------------------------------------
  await step(
    "marina@ vê “Perguntas esperando por você” com um tópico do seed e o motivo",
    async () => {
      const page = await newPage(
        await newContext({ cookies: await sessionCookies(demo("marina")) }),
      );
      await open(page, "/painel");
      await visible(
        page.getByRole("heading", { level: 1, name: /^Que bom te ver, Marina\./ }),
        "saudação",
      );
      await visible(
        page.getByText("Onde você é esperada esta semana, em poucos minutos."),
        "descrição da mentora",
      );
      const questions = region(page, HEADINGS.questionsMentor);
      await visible(questions, HEADINGS.questionsMentor);
      let found = null;
      for (const title of SEEDED_QUESTIONS) {
        const link = questions.getByRole("link", { name: title, exact: true });
        if ((await link.count()) > 0) {
          found = title;
          // `has` é relativo ao item: o localizador interno parte da página, não da região.
          const item = questions
            .getByRole("listitem")
            .filter({ has: page.getByRole("link", { name: title, exact: true }) });
          await visible(item.getByText(/^Fala de: /), `motivo em “${title}”`);
          const href = await link.getAttribute("href");
          assert(/^\/forum\/t\/[0-9a-f-]{36}$/.test(href ?? ""), `link do tópico: ${href}`);
          break;
        }
      }
      assert(found, "nenhum tópico do seed 10_painel.sql em “Perguntas esperando por você”");
      const steps = region(page, HEADINGS.steps);
      await visible(
        steps.getByRole("heading", { name: /Responda aos pedidos/ }),
        "passo da mentora",
      );
      return `“${found}”`;
    },
  );

  // 4. Modo demonstração -----------------------------------------------------------------------
  if (DEMO) {
    await step("/demo: “Entrar como Marina” abre a sessão e mostra o aviso", async () => {
      const context = await newContext();
      const page = await newPage(context);
      const response = await open(page, "/demo");
      assert(response?.status() === 200, `HTTP ${response?.status()}`);
      await visible(
        page.getByText(
          "Modo demonstração: todas as pessoas, papers e conversas daqui são fictícios.",
        ),
        "aviso honesto",
      );
      await visible(page.getByRole("heading", { name: "Roteiro de 3 minutos" }), "roteiro");
      assert(
        (await page
          .getByRole("button", { name: /^Entrar como (Admin|Helena|Priscila)/ })
          .count()) === 0,
        "persona de administração/moderação na lista",
      );
      await page.getByRole("button", { name: "Entrar como Marina" }).click();
      await page.waitForURL((url) => url.pathname === "/painel", { timeout: 30_000 });
      await visible(banner(page), "aviso de demonstração");
      const text = (await banner(page).textContent()) ?? "";
      assert(/você está como\s*Marina/.test(text), `aviso: ${text}`);
      await visible(
        page.getByRole("heading", { level: 1, name: /^Que bom te ver, Marina\./ }),
        "painel da Marina",
      );
      ctx.demoContext = context;
      ctx.demoPage = page;
    });

    await step(
      "/demo: trocar para a Larissa",
      async () => {
        const page = ctx.demoPage;
        await banner(page).getByRole("link", { name: "Trocar persona" }).click();
        await page.waitForURL((url) => url.pathname === "/demo");
        await page.getByRole("button", { name: "Entrar como Larissa" }).click();
        await page.waitForURL((url) => url.pathname === "/painel", { timeout: 30_000 });
        await visible(
          page.getByRole("heading", { level: 1, name: /^Que bom te ver, Larissa\./ }),
          "painel da Larissa",
        );
        const text = (await banner(page).textContent()) ?? "";
        assert(/você está como\s*Larissa/.test(text), `aviso: ${text}`);
      },
      { needs: ["demoPage"] },
    );

    await step(
      "/demo: slug forjado (admin, moderacao, e-mail) é recusado sem trocar a sessão",
      async () => {
        const page = ctx.demoPage;
        for (const forged of ["admin", "moderacao", demo("admin"), "helena", "LARISSA"]) {
          await open(page, "/demo");
          const form = page
            .locator("form")
            .filter({ has: page.getByRole("button", { name: "Entrar como Larissa" }) });
          await form.locator('input[name="persona"]').evaluate((input, value) => {
            input.value = value;
          }, forged);
          await form.getByRole("button", { name: "Entrar como Larissa" }).click();
          await visible(
            form.getByText("Não conhecemos essa pessoa de demonstração."),
            `recusa de “${forged}”`,
          );
          assert(pathOf(page).pathname === "/demo", `saiu do /demo com “${forged}”`);
        }
        await open(page, "/painel");
        const text = (await banner(page).textContent()) ?? "";
        assert(/você está como\s*Larissa/.test(text), `sessão mudou depois das recusas: ${text}`);
        return "admin, moderacao, admin@…, helena e LARISSA recusados; a sessão continuou a mesma";
      },
      { needs: ["demoPage"] },
    );

    await step(
      "Exclusão de conta fictícia é recusada (conta temporária do domínio demo)",
      async () => {
        ctx.tempUserId = await createTempDemoUser();
        const context = await newContext({
          cookies: await sessionCookies(TEMP_EMAIL, TEMP_PASSWORD),
        });
        const page = await newPage(context);
        await open(page, "/perfil");
        await visible(banner(page), "aviso de demonstração para a conta temporária");
        await page.getByRole("button", { name: "Excluir minha conta" }).click();
        const dialog = page.getByRole("dialog", { name: "Excluir sua conta?" });
        await dialog.getByLabel(/Para confirmar, digite EXCLUIR/).fill("EXCLUIR");
        await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
        await visible(dialog.getByText(DEMO_DELETE_REFUSED), "recusa da exclusão");
        const { data } = await db.auth.admin.getUserById(ctx.tempUserId);
        assert(data?.user?.id === ctx.tempUserId, "a conta temporária foi apagada");
        await signOutIn(context);
      },
    );
  } else {
    await step("Sem DEMO_MODE: /demo responde 404 e não há aviso", async () => {
      const page = await newPage(
        await newContext({ cookies: await sessionCookies(demo("larissa")) }),
        {
          allow404: true,
        },
      );
      const response = await open(page, "/demo");
      assert(response?.status() === 404, `/demo respondeu ${response?.status()}`);
      await open(page, "/painel");
      await visible(page.getByRole("heading", { level: 2, name: HEADINGS.steps }), HEADINGS.steps);
      assert((await banner(page).count()) === 0, "aviso de demonstração com DEMO_MODE desligado");
    });
  }

  // 5. Capturas --------------------------------------------------------------------------------
  await step("Capturas claro/escuro × 1440/390 (rolagem horizontal e contraste)", async () => {
    await capture("larissa", "/painel", await sessionCookies(demo("larissa")));
    await capture("marina", "/painel", await sessionCookies(demo("marina")));
    if (DEMO) {
      await capture("visitante", "/demo", undefined);
      await capture("visitante", "/entrar", undefined);
    }
    return `${shots.length} capturas em ${path.join(OUT, "capturas")}`;
  });

  if (ctx.larissaContext) await signOutIn(ctx.larissaContext);
  if (ctx.demoContext) await signOutIn(ctx.demoContext);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    issue("cleanup", "conta temporária", error.message);
  }
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
}

const failed = steps.filter((s) => s.status === "fail");
const skipped = steps.filter((s) => s.status === "skip");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify({ base: BASE_URL, demo: DEMO, tag: TAG, steps, issues, shots }, null, 2),
);
console.log(
  `\n${steps.length - failed.length - skipped.length}/${steps.length} etapas ok` +
    (skipped.length ? `, ${skipped.length} puladas` : "") +
    ` · ${issues.length} problema(s) · ${shots.length} capturas · ${OUT}`,
);
for (const item of issues) console.log(`  ! [${item.kind}] ${item.where}: ${item.detail}`);
if (failed.length > 0 || skipped.length > 0 || issues.length > 0) exitCode = 1;
process.exit(exitCode);
