#!/usr/bin/env node
/**
 * E2E do "Pergunte a uma cientista" (docs/16-pergunte-a-uma-cientista.md), com Playwright, contra o
 * app rodando de verdade e o Supabase local com o seed (supabase/seed.sql + supabase/seeds/*.sql).
 *
 * O que o script confere, em ordem:
 *   1. Visitante a 390 px, SÓ COM O TECLADO, envia uma pergunta anônima (marcada com
 *      e2e-perg-<execução>): recebe o link de acompanhamento (token só na tela, nunca na URL), a
 *      pergunta não aparece para anon pela API e o acompanhamento mostra "Em análise".
 *   2. Uma pergunta com e-mail mostra o aviso CD041 (no navegador) e o banco recusa a mesma
 *      pergunta chamada direto pela API (e também com telefone).
 *   3. moderacao@ publica na aba /admin?aba=perguntas; o Registro mostra "publicou a pergunta".
 *   4. marina@ responde SEM marcar "Mostrar meu nome…".
 *   5. O visitante vê a resposta como "Uma cientista da rede" (sem o nome) e o acompanhamento
 *      mostra "Respondida".
 *   6. moderacao@ oculta a resposta: o visitante não a vê mais; o Registro mostra "ocultou a resposta".
 *   7. O visitante apaga a pergunta pelo link: volta para /pergunte com a confirmação e
 *      /pergunte/<id> responde 404.
 *   8. Capturas claro/escuro × 1440/390 de /pergunte, /pergunte/<pergunta do seed>, do
 *      acompanhamento (token de demonstração do seed), das duas páginas vistas pela marina@ (com
 *      "Perguntas esperando resposta" e o formulário de resposta) e da aba de moderação, com a checagem de
 *      rolagem horizontal, contraste AA (1440 px), erros de console e avisos de hidratação.
 *
 * Limpeza (service role): perguntas com a marca e2e-perg- (as respostas vão em cascata) e as linhas
 * do registro da moderação sobre elas e sobre os ids criados nesta execução (a etapa 7 apaga a
 * pergunta antes) — no começo (sobras de execuções interrompidas) e no fim.
 *
 * Pré-requisitos: Supabase local com o seed (inclusive supabase/seeds/30_pergunte.sql), .env.local
 * com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY, e o app
 * rodando em BASE_URL.
 *
 * Uso (na raiz do repositório)
 *   BASE_URL=http://localhost:3803 node scripts/e2e/pergunte.mjs
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

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3803").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "ciencia-delas-demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const TAG_PREFIX = "e2e-perg";
const RUN = Date.now().toString(36);
const TAG = `${TAG_PREFIX}-${RUN}`;
const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), "artemis-e2e", TAG);

const demo = (user) => `${user}@demo.cienciadelas.dev`;
/** Pergunta respondida e token de demonstração do seed supabase/seeds/30_pergunte.sql. */
const SEEDED_QUESTION = "e3000000-0000-4000-8000-000000000001";
const DEMO_TOKEN = "DemoPergunte-Artemis2026-IFSPjcr";

const QUESTION_BODY = `Como é o trabalho de uma astrônoma? Quero entender como alguém começa a estudar estrelas. ${TAG}`;
const PII_QUESTION = `Meu e-mail é estudante.teste@gmail.com, alguém pode me ajudar a escolher um curso? ${TAG}`;
const ANSWER_BODY = `Que pergunta boa! Comece observando o céu e anotando o que vê, e procure um clube de ciências na sua escola. ${TAG}`;
const PII_MESSAGE =
  "Para proteger você, tire da pergunta e-mails, telefones, documentos, links e @ de redes sociais.";
const ANONYMOUS = "Uma cientista da rede";
/** O servidor recusa envios feitos menos de 3 s depois de o formulário aparecer. */
const MIN_FILL_MS = 3500;

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

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
/** Service role: só para descobrir ids e limpar. */
const db = createClient(SUPABASE_URL, SECRET_KEY, clientOptions);
/** Visitante (anon) pela API, como qualquer pessoa com a chave publicável. */
const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, clientOptions);

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
// Limpeza (service role): perguntas marcadas e o registro da moderação sobre elas
// ---------------------------------------------------------------------------------------------

/** Ids criados nesta execução (a pergunta pode ser apagada pelo próprio teste antes da limpeza). */
const created = { questions: new Set(), answers: new Set() };

async function cleanup() {
  const { data: questions, error } = await db
    .from("public_questions")
    .select("id")
    .like("body", `%${TAG_PREFIX}-%`);
  if (error) throw new Error(`limpeza (perguntas): ${error.message}`);
  const questionIds = [...new Set([...(questions ?? []).map((q) => q.id), ...created.questions])];
  if (questionIds.length === 0) return 0;
  const { data: answers } = await db
    .from("public_answers")
    .select("id")
    .in("question_id", questionIds);
  const targets = [...questionIds, ...(answers ?? []).map((a) => a.id), ...created.answers];
  const { error: auditError } = await db
    .from("moderation_audit_log")
    .delete()
    .in("target_type", ["public_question", "public_answer"])
    .in("target_id", targets);
  if (auditError) issue("cleanup", "registro", auditError.message);
  const { error: deleteError } = await db.from("public_questions").delete().in("id", questionIds);
  if (deleteError) throw new Error(`limpeza (apagar): ${deleteError.message}`);
  return (questions ?? []).length;
}

async function questionId() {
  const { data, error } = await db
    .from("public_questions")
    .select("id, status")
    .eq("body", QUESTION_BODY)
    .maybeSingle();
  if (error) throw new Error(`consulta da pergunta: ${error.message}`);
  return data;
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

/** Espera o tempo mínimo de preenchimento (o servidor recusa envios rápidos demais). */
async function waitFillTime(startedAt) {
  const left = MIN_FILL_MS - (Date.now() - startedAt);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
}

async function activeElementName(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    return (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "")
      .replace(/\s+/g, " ")
      .trim();
  });
}

const answerCard = (page) =>
  page.locator("article").filter({ hasText: "Que pergunta boa! Comece observando o céu" });

async function main() {
  fs.mkdirSync(path.join(OUT, "capturas"), { recursive: true });
  try {
    const response = await fetch(`${BASE_URL}/pergunte`, { redirect: "manual" });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`O app não respondeu em ${BASE_URL} (${error.message}).`);
    process.exit(2);
  }

  console.log(`Pergunte a uma cientista — ${BASE_URL} · ${TAG}`);
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  const leftovers = await cleanup();
  if (leftovers > 0) console.log(`  (limpou ${leftovers} pergunta(s) de execuções anteriores)`);

  // 1. Visitante envia (390 px, só teclado) ---------------------------------------------------
  await step("Visitante (390 px, só teclado): envia a pergunta e recebe o link", async () => {
    const context = await newContext({ width: 390, height: 844 });
    const page = await newPage(context);
    await open(page, "/pergunte");
    const startedAt = Date.now();
    await visible(
      page.getByRole("heading", {
        level: 1,
        name: "Ainda não pesquisa? Pergunte a uma cientista.",
      }),
      "título da página",
    );

    // Tab a partir do começo da página até o campo da pergunta.
    const field = page.getByRole("textbox", { name: "Sua pergunta" });
    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await field.evaluate((el) => el === document.activeElement);
    }
    assert(reached, "o campo da pergunta não foi alcançado com Tab");
    await page.keyboard.type(QUESTION_BODY);
    await page.keyboard.press("Tab"); // etapa
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab"); // área
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab"); // enviar (a armadilha para robôs fica fora da tabulação)
    const focused = await activeElementName(page);
    assert(focused === "Enviar pergunta", `o foco foi para “${focused}”, não para o botão`);
    await waitFillTime(startedAt);
    await page.keyboard.press("Enter");

    const heading = page.getByRole("heading", {
      name: "Guarde este link para acompanhar sua pergunta",
    });
    await visible(heading, "cartão do link de acompanhamento", 30_000);
    assert(
      await heading.evaluate((el) => el === document.activeElement),
      "o foco não foi para o cartão do link",
    );
    const link = await page.getByLabel("Seu link de acompanhamento").inputValue();
    const match = /\/pergunte\/acompanhar\/([A-Za-z0-9_-]{32})$/.exec(link);
    assert(match, `link inesperado: ${link}`);
    assert(!page.url().includes(match[1]), "o token apareceu na URL da página");
    await visible(
      page.getByText("Só quem tiver este link vê o andamento. Não conseguimos recuperá-lo depois."),
      "aviso de guardar o link",
    );

    const row = await questionId();
    assert(row?.status === "pending", `pergunta no banco: ${JSON.stringify(row)}`);
    created.questions.add(row.id);
    const { data: stage } = await db
      .from("public_questions")
      .select("stage, area_id")
      .eq("id", row.id)
      .single();
    assert(stage?.stage === "ensino_medio_tecnico" && stage?.area_id, "etapa/área pelo teclado");

    ctx.trackingPath = new URL(link).pathname;
    ctx.visitorContext = context;
    ctx.visitor = page;
    return `link ${ctx.trackingPath.replace(match[1], "<token>")}`;
  });

  await step(
    "Pendente: invisível pela API (anon) e o acompanhamento mostra “Em análise”",
    async () => {
      const { data, error } = await anon
        .from("public_questions")
        .select("id")
        .eq("body", QUESTION_BODY);
      assert(!error && (data ?? []).length === 0, "anon leu a pergunta pendente");
      const hash = await anon.from("public_questions").select("tracking_token_hash").limit(1);
      assert(hash.error?.code === "42501", `anon leu tracking_token_hash (${hash.error?.code})`);

      const page = ctx.visitor;
      await open(page, ctx.trackingPath);
      await visible(
        page.getByRole("heading", { level: 1, name: "Em análise pela moderação" }),
        "estado “Em análise”",
      );
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      const referrer = await page.locator('meta[name="referrer"]').getAttribute("content");
      assert(/noindex/.test(robots ?? ""), `robots: ${robots}`);
      assert(referrer === "no-referrer", `referrer: ${referrer}`);
    },
    { needs: ["trackingPath"] },
  );

  // 2. Dados pessoais --------------------------------------------------------------------------
  await step("Pergunta com e-mail: aviso CD041 na tela e recusa no banco", async () => {
    const page = await newPage(await newContext());
    await open(page, "/pergunte");
    const startedAt = Date.now();
    await page.getByRole("textbox", { name: "Sua pergunta" }).fill(PII_QUESTION);
    await visible(page.getByText(/Parece que o texto tem e-mail/), "aviso enquanto digita");
    await waitFillTime(startedAt);
    await page.getByRole("button", { name: "Enviar pergunta" }).click();
    await visible(page.getByText(PII_MESSAGE), "mensagem CD041");
    const field = page.getByRole("textbox", { name: "Sua pergunta" });
    assert(
      (await field.getAttribute("aria-invalid")) === "true",
      "campo não marcado como inválido",
    );
    assert((await field.inputValue()) === PII_QUESTION, "o texto digitado se perdeu");

    const viaApi = await anon.rpc("submit_public_question", { p_body: PII_QUESTION });
    assert(viaApi.error?.code === "CD041", `API com e-mail: ${viaApi.error?.code ?? "aceitou"}`);
    const phone = await anon.rpc("submit_public_question", {
      p_body: `Me liga no (12) 99876-5432 para conversar sobre engenharia, por favor. ${TAG}`,
    });
    assert(phone.error?.code === "CD041", `API com telefone: ${phone.error?.code ?? "aceitou"}`);
    const { count } = await db
      .from("public_questions")
      .select("id", { count: "exact", head: true })
      .like("body", `%${TAG}%`)
      .neq("body", QUESTION_BODY);
    assert(count === 0, "uma pergunta com dados pessoais foi gravada");
    return "navegador e banco recusam (e-mail e telefone)";
  });

  // 3. Moderação publica ------------------------------------------------------------------------
  await step(
    "moderacao@ publica na aba Perguntas; o Registro mostra “publicou a pergunta”",
    async () => {
      const context = await newContext({ cookies: await sessionCookies(demo("moderacao")) });
      const page = await newPage(context);
      await open(page, "/admin?aba=perguntas");
      const tab = page.getByRole("link", { name: /^Perguntas \d+/ });
      await visible(tab, "aba Perguntas com contagem");
      assert((await tab.getAttribute("aria-current")) === "page", "aba Perguntas não está ativa");
      const card = page.locator("article").filter({ hasText: TAG });
      await visible(card, "pergunta na fila");
      await card.getByRole("button", { name: "Publicar", exact: true }).click();
      await visible(page.getByText(/^Pergunta publicada\./), "aviso de publicação");
      await card.first().waitFor({ state: "detached", timeout: 15_000 });

      const row = await questionId();
      assert(row?.status === "published", `status: ${row?.status}`);
      ctx.questionId = row.id;
      created.questions.add(row.id);

      await open(page, "/admin?aba=registro");
      const entry = page.getByRole("list", { name: "Ações da moderação" }).locator("li").first();
      await visible(entry, "registro");
      const text = (await entry.textContent()) ?? "";
      assert(/publicou a pergunta/.test(text), `primeira linha do registro: ${text}`);
      assert(/Pergunta pública/.test(text), `alvo do registro: ${text}`);
      ctx.modContext = context;
      ctx.mod = page;
    },
    { needs: ["trackingPath"] },
  );

  // 4. Mentora responde sem se identificar ------------------------------------------------------
  await step(
    "marina@ responde sem marcar “Mostrar meu nome…”",
    async () => {
      const context = await newContext({ cookies: await sessionCookies(demo("marina")) });
      const page = await newPage(context);
      await open(page, `/pergunte/${ctx.questionId}`);
      await page.getByRole("textbox", { name: "Sua resposta" }).fill(ANSWER_BODY);
      const consent = page.getByRole("checkbox", {
        name: "Mostrar meu nome e minha etapa da carreira nesta resposta",
      });
      assert(!(await consent.isChecked()), "a identidade veio marcada por padrão");
      await page.getByRole("button", { name: "Publicar resposta" }).click();
      await visible(page.getByText(/^Resposta publicada\./), "confirmação da resposta");
      await visible(answerCard(page).getByText("Sua resposta"), "selo “Sua resposta”");
      const { data } = await db
        .from("public_answers")
        .select("id, show_identity, author_id")
        .eq("question_id", ctx.questionId)
        .single();
      assert(data && !data.show_identity, "show_identity gravado como verdadeiro");
      assert(data.author_id === "d1000000-0000-4000-8000-000000000001", "autora errada");
      ctx.marinaContext = context;
      ctx.answerId = data.id;
      created.answers.add(data.id);
    },
    { needs: ["questionId"] },
  );

  // 5. Visitante vê a resposta anônima ----------------------------------------------------------
  await step(
    "Visitante vê “Uma cientista da rede” (sem o nome) e o acompanhamento mostra “Respondida”",
    async () => {
      const page = ctx.visitor;
      await open(page, `/pergunte/${ctx.questionId}`);
      const card = answerCard(page);
      await visible(card, "resposta");
      await visible(card.getByText(ANONYMOUS, { exact: true }), ANONYMOUS);
      const body = (await page.locator("main").textContent()) ?? "";
      assert(!/Marina/.test(body), "o nome da mentora apareceu na página");
      await visible(
        page.getByRole("link", { name: "Entrar para responder" }),
        "convite para entrar",
      );
      await open(page, ctx.trackingPath);
      await visible(
        page.getByRole("heading", { level: 1, name: "Respondida: 1 resposta" }),
        "estado “Respondida”",
      );
    },
    { needs: ["answerId"] },
  );

  // 6. Moderação oculta a resposta ---------------------------------------------------------------
  await step(
    "moderacao@ oculta a resposta; o visitante não a vê mais",
    async () => {
      const page = ctx.mod;
      await open(page, "/admin?aba=perguntas");
      const card = answerCard(page);
      await visible(card, "resposta nas recentes");
      await visible(card.getByText("Marina Albuquerque"), "nome visível só para a moderação");
      await card.getByRole("button", { name: "Ocultar" }).click();
      const dialog = page.getByRole("dialog", { name: "Ocultar esta resposta?" });
      await dialog.getByRole("textbox", { name: /Motivo/ }).fill("Teste automatizado (E2E)");
      await dialog.getByRole("button", { name: "Ocultar resposta" }).click();
      await visible(card.getByText("Oculta", { exact: true }), "selo “Oculta”");

      await open(ctx.visitor, `/pergunte/${ctx.questionId}`);
      assert((await answerCard(ctx.visitor).count()) === 0, "a resposta oculta continua visível");
      await visible(
        ctx.visitor.getByText("Esta pergunta ainda espera a primeira resposta"),
        "estado sem respostas",
      );

      await open(page, "/admin?aba=registro");
      const entry = page.getByRole("list", { name: "Ações da moderação" }).locator("li").first();
      const text = (await entry.textContent()) ?? "";
      assert(/ocultou a resposta/.test(text), `primeira linha do registro: ${text}`);
      assert(/Teste automatizado/.test(text), `motivo no registro: ${text}`);
    },
    { needs: ["answerId", "mod"] },
  );

  // 7. Visitante apaga pelo link ------------------------------------------------------------------
  await step(
    "Visitante apaga a pergunta pelo link; /pergunte/<id> responde 404",
    async () => {
      const page = ctx.visitor;
      await open(page, ctx.trackingPath);
      await page.getByRole("button", { name: "Apagar minha pergunta" }).click();
      const dialog = page.getByRole("dialog", { name: "Apagar sua pergunta?" });
      await dialog.getByRole("button", { name: "Sim, apagar" }).click();
      await page.waitForURL(
        (url) => url.pathname === "/pergunte" && url.searchParams.get("pergunta") === "apagada",
        { timeout: 30_000 },
      );
      await visible(page.getByText("Sua pergunta foi apagada"), "confirmação");

      const gone = await newPage(ctx.visitorContext, { allow404: true });
      const response = await open(gone, `/pergunte/${ctx.questionId}`);
      assert(response?.status() === 404, `/pergunte/<id> respondeu ${response?.status()}`);
      const tracking = await open(gone, ctx.trackingPath);
      assert(tracking?.status() === 200, `acompanhamento respondeu ${tracking?.status()}`);
      await visible(gone.getByText("Não encontramos esta pergunta"), "link sem pergunta");
      const { count } = await db
        .from("public_answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", ctx.questionId);
      assert(count === 0, "as respostas não foram apagadas junto");
      await gone.close();
    },
    { needs: ["questionId"] },
  );

  // 8. Capturas ----------------------------------------------------------------------------------
  await step("Capturas claro/escuro × 1440/390 (rolagem horizontal e contraste)", async () => {
    await capture("visitante", "/pergunte", undefined);
    await capture("visitante", `/pergunte/${SEEDED_QUESTION}`, undefined);
    await capture("visitante", `/pergunte/acompanhar/${DEMO_TOKEN}`, undefined);
    await capture("marina", "/pergunte", await sessionCookies(demo("marina")));
    await capture("marina", `/pergunte/${SEEDED_QUESTION}`, await sessionCookies(demo("marina")));
    await capture("moderacao", "/admin?aba=perguntas", await sessionCookies(demo("moderacao")));
    return `${shots.length} capturas em ${path.join(OUT, "capturas")}`;
  });

  if (ctx.modContext) await signOutIn(ctx.modContext);
  if (ctx.marinaContext) await signOutIn(ctx.marinaContext);
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
    issue("cleanup", "perguntas de teste", error.message);
  }
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
}

const failed = steps.filter((s) => s.status === "fail");
const skipped = steps.filter((s) => s.status === "skip");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify({ base: BASE_URL, tag: TAG, steps, issues, shots }, null, 2),
);
console.log(
  `\n${steps.length - failed.length - skipped.length}/${steps.length} etapas ok` +
    (skipped.length ? `, ${skipped.length} puladas` : "") +
    ` · ${issues.length} problema(s) · ${shots.length} capturas · ${OUT}`,
);
for (const item of issues) console.log(`  ! [${item.kind}] ${item.where}: ${item.detail}`);
if (failed.length > 0 || skipped.length > 0 || issues.length > 0) exitCode = 1;
process.exit(exitCode);
