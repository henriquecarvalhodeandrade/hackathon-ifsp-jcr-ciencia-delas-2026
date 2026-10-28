#!/usr/bin/env node
/**
 * E2E da afinidade de trajetória (docs/17-afinidade-de-trajetoria.md), com Playwright contra o
 * app rodando de verdade e o Supabase local (seed + supabase/seeds/40_trajetoria.sql).
 * Funciona SEM chave de IA (é a sugestão por afinidade, só com as regras da plataforma).
 *
 * O que o script faz, em ordem:
 *   1. larissa@ abre /mentoria e clica em "Encontrar mentoras": pelo menos um cartão mostra a
 *      linha "Em comum na trajetória" e um motivo que começa com "Vocês têm em comum"; depois de
 *      recarregar (sugestões salvas), os chips continuam lá (calculados na hora).
 *   2. Em /perfil#sobre ela desmarca uma marca (clique) e marca outra (teclado: Tab/Espaço),
 *      salva e recarrega: a mudança ficou (tela e banco). Um valor forjado fora do catálogo volta
 *      com erro no grupo e não grava nada.
 *   3. /pesquisadoras?trajetoria=primeira-geracao lista a Marina e não a Débora, com o chip de
 *      filtro ativo (que remove só aquele filtro); um slug desconhecido é ignorado.
 *   4. /pesquisadoras/<Marina> mostra "Trajetória" e "Vocês têm em comum" para a Larissa; para a
 *      Débora (outra trajetória), a seção sem o destaque; visitante sem sessão vai para /entrar.
 *   5. Onboarding: uma conta nova (sem marca nenhuma) marca "Estudei em escola pública" na
 *      etapa "Sobre você" e a marca é gravada (com capturas da etapa).
 *   6. Capturas claro/escuro × 1440/390 do cartão de sugestão, do grupo do perfil, do diretório
 *      filtrado e do perfil da Marina, com checagem de rolagem horizontal, contraste (AA, 1440),
 *      erros de console e avisos de hidratação.
 * As marcas da Larissa voltam ao valor original no fim (e a conta nova é apagada).
 *
 * Pré-requisitos: Supabase local com a migration 20261028190200 e o seed 40_trajetoria.sql,
 * .env.local com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e
 * SUPABASE_SECRET_KEY, e o app rodando em BASE_URL (padrão http://localhost:3804).
 *
 * Uso (na raiz do repositório)
 *   BASE_URL=http://localhost:3804 node scripts/e2e/trajetoria.mjs
 * Variáveis opcionais: OUT_DIR (capturas e report.json), DEMO_PASSWORD, HEADED=1,
 * SKIP_SHOTS=1 (sem as capturas). Sai com 1 se algo falhar e 2 se faltar pré-requisito.
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

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3804").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "ciencia-delas-demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SKIP_SHOTS = process.env.SKIP_SHOTS === "1";

const TAG_PREFIX = "e2e-traj";
const RUN = Date.now().toString(36);
const TAG = `${TAG_PREFIX}-${RUN}`;
const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), "artemis-e2e", TAG);

const demo = (user) => `${user}@demo.cienciadelas.dev`;
const LARISSA = { id: "d2000000-0000-4000-8000-000000000001", email: demo("larissa") };
const DEBORA = { id: "d2000000-0000-4000-8000-000000000005", email: demo("debora") };
const MARINA = { id: "d1000000-0000-4000-8000-000000000001", name: "Marina Albuquerque" };
const DEBORA_NAME = "Débora Alves";
/** Marcas da Larissa no seed 40_trajetoria.sql (o banco guarda em ordem alfabética). */
const LARISSA_SEED = ["ensino-tecnico", "escola-publica", "primeira-geracao"];
/** Mentoras que a Larissa ainda pode pedir e que compartilham marcas com ela no seed. */
const SHARED_MENTORS = [
  "d1000000-0000-4000-8000-000000000008",
  "d1000000-0000-4000-8000-000000000002",
];
const NEW_EMAIL = `${TAG}@example.com`;
const NEW_NAME = "Teste Trajetória E2E";

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
// Etapas, problemas e utilitários
// ---------------------------------------------------------------------------------------------

const steps = [];
const issues = [];
const ctx = {};
const contexts = [];
const shots = [];
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
  if (!issues.some((item) => item.key === key)) issues.push({ key, kind, where, detail });
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
    steps.push({ name, status: "ok", detail: detail ?? "", ms: Date.now() - started });
    console.log(
      `✓ ${name}${detail ? ` — ${detail}` : ""} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
    );
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

async function q(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function visible(locator, what, timeout = 20_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`Não apareceu: ${what}`);
  }
}

const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---------------------------------------------------------------------------------------------
// Navegador e sessões
// ---------------------------------------------------------------------------------------------

const HYDRATION = /hydrat|did not match|server rendered html|Minified React error #(418|423|425)/i;

function watch(page) {
  page.on("console", (message) => {
    const text = message.text();
    const where = page.url().replace(BASE_URL, "") || "/";
    if (HYDRATION.test(text)) return issue("hydration", where, text.slice(0, 300));
    if (message.type() === "error" && !/status of 404/.test(text)) {
      issue("console", where, text.slice(0, 300));
    }
  });
  page.on("pageerror", (error) =>
    issue("pageerror", page.url().replace(BASE_URL, "") || "/", error.message.slice(0, 300)),
  );
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

async function pageAs(email, password) {
  const context = await newContext({
    cookies: email ? await sessionCookies(email, password) : undefined,
  });
  return newPage(context);
}

// ---------------------------------------------------------------------------------------------
// Checagens visuais (mesmas regras da jornada: rolagem horizontal e contraste AA)
// ---------------------------------------------------------------------------------------------

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
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;
      offenders.push(`${el.tagName.toLowerCase()} (right=${Math.round(rect.right)})`);
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
    for (const el of document.querySelectorAll("body *")) {
      const hasText = [...el.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent.trim().length > 1,
      );
      if (!hasText) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (el.closest("[aria-hidden='true'], [disabled], .sr-only, svg")) continue;
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
      out.push(
        `${ratio.toFixed(2)}:1 “${el.textContent.replace(/\s+/g, " ").trim().slice(0, 40)}”`,
      );
      if (out.length >= 6) break;
    }
    return out;
  });
}

const VARIANTS = [
  { theme: "light", width: 1440, height: 900 },
  { theme: "dark", width: 1440, height: 900 },
  { theme: "light", width: 390, height: 844 },
  { theme: "dark", width: 390, height: 844 },
];

/**
 * Capturas claro/escuro × 1440/390 de uma página (página inteira + o elemento de interesse,
 * se `element` vier), com rolagem horizontal e contraste.
 */
async function capture(name, url, email, { element } = {}) {
  if (SKIP_SHOTS) return 0;
  const cookies = email ? await sessionCookies(email) : undefined;
  let count = 0;
  for (const variant of VARIANTS) {
    const context = await newContext({
      cookies,
      colorScheme: variant.theme,
      width: variant.width,
      height: variant.height,
    });
    const page = await newPage(context);
    const label = `${name} ${variant.theme} ${variant.width}`;
    const response = await open(page, url);
    if ((response?.status() ?? 0) >= 400) issue("status", label, `HTTP ${response?.status()}`);
    const overflow = await overflowReport(page);
    if (overflow)
      issue("overflow", label, `+${overflow.extra}px: ${overflow.offenders.join("; ")}`);
    if (variant.width === 1440) {
      for (const item of await contrastReport(page)) issue("contrast", label, item);
    }
    const file = path.join(OUT, "capturas", `${name}-${variant.theme}-${variant.width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ name, url, ...variant, file });
    count += 1;
    if (element) {
      const target = element(page).first();
      await visible(target, `${name}: elemento da captura`);
      await target.scrollIntoViewIfNeeded();
      const detail = path.join(
        OUT,
        "capturas",
        `${name}-detalhe-${variant.theme}-${variant.width}.png`,
      );
      await target.screenshot({ path: detail });
      shots.push({ name: `${name}-detalhe`, url, ...variant, file: detail });
      count += 1;
    }
    await context.close();
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// Dados (service role)
// ---------------------------------------------------------------------------------------------

/** Marcas da Larissa para devolver no fim. */
let larissaOriginal = null;

async function larissaTags() {
  const row = await q(
    db.from("profiles").select("trajectory_tags").eq("id", LARISSA.id).single(),
    "marcas da larissa",
  );
  return row.trajectory_tags ?? [];
}

async function setLarissaTags(tags) {
  await q(
    db.from("profiles").update({ trajectory_tags: tags }).eq("id", LARISSA.id),
    "gravar marcas da larissa",
  );
}

async function restoreLarissa() {
  if (larissaOriginal === null) return;
  await setLarissaTags(larissaOriginal);
  larissaOriginal = null;
}

/** Contas de onboarding desta e de execuções anteriores (e-mail com a marca do teste). */
async function cleanupUsers() {
  let removed = 0;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listar contas: ${error.message}`);
    const users = data?.users ?? [];
    for (const user of users) {
      if (!user.email?.startsWith(`${TAG_PREFIX}-`)) continue;
      const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`apagar ${user.email}: ${deleteError.message}`);
      removed += 1;
    }
    if (users.length < 200) break;
  }
  return removed;
}

// ---------------------------------------------------------------------------------------------
// Jornada
// ---------------------------------------------------------------------------------------------

const SHARED_REASON = /(^|[.!?]\s+)Vocês têm em comum: as duas /;

async function journey() {
  await step("Pré-condições: coluna, seed e marcas da Larissa", async () => {
    const mentors = await q(
      db.from("profiles").select("id, trajectory_tags").in("id", SHARED_MENTORS),
      "marcas das mentoras do seed",
    );
    assert(
      mentors.length === SHARED_MENTORS.length &&
        mentors.every((m) => (m.trajectory_tags ?? []).includes("primeira-geracao")),
      "o seed supabase/seeds/40_trajetoria.sql não foi aplicado (Juliana/Luiza sem marcas)",
    );
    const current = await larissaTags();
    // Sobras de uma execução interrompida: volta ao seed e devolve o seed no fim.
    larissaOriginal = current.includes("primeira-geracao") ? current : LARISSA_SEED;
    if (!sameSet(current, LARISSA_SEED)) await setLarissaTags(LARISSA_SEED);
    const removed = await cleanupUsers();
    return `marcas originais: ${larissaOriginal.join(", ")}; ${removed} conta(s) antiga(s) apagada(s)`;
  });

  await step("larissa@ clica em “Encontrar mentoras” e vê o que têm em comum", async () => {
    // Sem sugestões salvas: o botão é "Encontrar mentoras" e não há a espera de 60 s.
    await q(
      db.from("mentor_suggestions").delete().eq("mentee_id", LARISSA.id),
      "apagar sugestões da larissa",
    );
    const page = await pageAs(LARISSA.email);
    ctx.larissa = page;
    await open(page, "/mentoria");
    await page.getByRole("button", { name: "Encontrar mentoras" }).click();
    const list = page.getByRole("list", { name: "Sugestões de mentoras" });
    await visible(list, "lista de sugestões", 45_000);
    const cards = list.getByRole("article");
    const withTrajectory = cards.filter({ hasText: "Em comum na trajetória" });
    await visible(withTrajectory, "cartão com “Em comum na trajetória”");
    const total = await cards.count();
    const count = await withTrajectory.count();
    const texts = await withTrajectory.allInnerTexts();
    assert(
      texts.some((text) => SHARED_REASON.test(text)),
      "nenhum cartão com o motivo “Vocês têm em comum: as duas …”",
    );
    const first = withTrajectory.first();
    const chips = first
      .getByRole("definition")
      .filter({ hasText: "Primeira da família na universidade" });
    await visible(chips, "chip “Primeira da família na universidade”");
    ctx.cardName = (await first.getByRole("heading", { level: 3 }).innerText()).trim();

    const saved = await q(
      db.from("mentor_suggestions").select("mentor_id, reason, source").eq("mentee_id", LARISSA.id),
      "sugestões salvas",
    );
    assert(
      saved.some((row) => row.source === "heuristic" && SHARED_REASON.test(row.reason)),
      "o motivo com a trajetória não foi salvo em mentor_suggestions",
    );
    assert(
      !saved.some((row) => row.mentor_id === MARINA.id),
      "a Marina (mentoria ativa) voltou nas sugestões",
    );

    // Sugestões salvas: os chips são calculados na hora, então continuam depois de recarregar.
    await open(page, "/mentoria");
    await visible(
      page
        .getByRole("list", { name: "Sugestões de mentoras" })
        .getByRole("article")
        .filter({ hasText: "Em comum na trajetória" }),
      "chips depois de recarregar",
    );
    return `${count} de ${total} cartões com trajetória em comum; primeiro: ${ctx.cardName}`;
  });

  await step("/perfil#sobre: desmarca (clique) e marca (teclado), salva e recarrega", async () => {
    const page = await pageAs(LARISSA.email);
    await open(page, "/perfil#sobre");
    const section = page.locator("section#sobre");
    const group = section.getByRole("group", { name: /Sua trajetória/ });
    await visible(group, "grupo “Sua trajetória (opcional)”");
    await visible(group.getByText(/^Opcional\. Ajuda a encontrar mentoras/), "texto de ajuda");
    const tecnico = group.getByRole("checkbox", { name: "Vim do ensino técnico" });
    const mudanca = group.getByRole("checkbox", { name: "Mudei de área ao longo do caminho" });
    assert(await tecnico.isChecked(), "“Vim do ensino técnico” deveria vir marcada do seed");
    assert(!(await mudanca.isChecked()), "“Mudei de área” deveria vir desmarcada");
    assert((await group.getByRole("checkbox").count()) === 8, "o grupo deveria ter 8 opções");

    await group.getByText("Vim do ensino técnico", { exact: true }).click();
    // Teclado: foco no checkbox (Tab chega nele) e Espaço marca.
    await mudanca.focus();
    await page.keyboard.press("Space");
    assert(!(await tecnico.isChecked()), "o clique não desmarcou");
    assert(await mudanca.isChecked(), "o Espaço não marcou");

    await section.getByRole("button", { name: "Salvar" }).click();
    await visible(section.getByText("Seus dados foram salvos."), "mensagem de sucesso");

    await open(page, "/perfil#sobre");
    const again = page.locator("section#sobre").getByRole("group", { name: /Sua trajetória/ });
    assert(
      !(await again.getByRole("checkbox", { name: "Vim do ensino técnico" }).isChecked()),
      "depois de recarregar, “Vim do ensino técnico” continua marcada",
    );
    assert(
      await again.getByRole("checkbox", { name: "Mudei de área ao longo do caminho" }).isChecked(),
      "depois de recarregar, “Mudei de área” não ficou marcada",
    );
    const saved = await larissaTags();
    const expected = ["escola-publica", "mudanca-de-area", "primeira-geracao"];
    assert(
      JSON.stringify(saved) === JSON.stringify(expected),
      `banco: ${saved.join(", ")} (esperado ${expected.join(", ")})`,
    );
    ctx.profileSaved = true;
    return saved.join(", ");
  });

  await step("Valor forjado fora do catálogo volta com erro no grupo", async () => {
    const before = await larissaTags();
    const page = await pageAs(LARISSA.email);
    await open(page, "/perfil#sobre");
    const section = page.locator("section#sobre");
    const group = section.getByRole("group", { name: /Sua trajetória/ });
    await visible(group, "grupo de trajetória");
    await group
      .locator('input[name="trajectory_tags"]')
      .first()
      .evaluate((input) => {
        input.value = "inventada";
        input.checked = true;
      });
    await section.getByRole("button", { name: "Salvar" }).click();
    await visible(
      group.getByText("Uma das opções de trajetória não existe mais.", { exact: false }),
      "erro no grupo",
    );
    assert(
      (await group.getByRole("checkbox").first().getAttribute("aria-invalid")) === "true",
      "as opções não ficaram marcadas como inválidas",
    );
    const after = await larissaTags();
    assert(sameSet(before, after), "o valor forjado mudou as marcas no banco");
    return "zod recusou; nada gravado";
  });

  // As capturas e os passos seguintes usam as marcas do seed.
  await step("Service role: marcas da Larissa de volta ao seed", async () => {
    await setLarissaTags(LARISSA_SEED);
    return LARISSA_SEED.join(", ");
  });

  await step(
    "/pesquisadoras?trajetoria=primeira-geracao lista a Marina e não a Débora",
    async () => {
      const page = await pageAs(LARISSA.email);
      await open(page, "/pesquisadoras?trajetoria=primeira-geracao");
      await visible(page.getByRole("link", { name: MARINA.name }), "Marina no diretório");
      assert(
        (await page.getByRole("link", { name: DEBORA_NAME }).count()) === 0,
        "a Débora apareceu com o filtro de primeira geração",
      );
      const select = page.getByRole("combobox", { name: "Trajetória" });
      assert((await select.inputValue()) === "primeira-geracao", "o select não veio preenchido");
      const chip = page.getByRole("link", {
        name: "Remover filtro Trajetória: Primeira da família na universidade",
      });
      await visible(chip, "chip do filtro ativo");
      const marinaCard = page
        .locator("li")
        .filter({ has: page.getByRole("link", { name: MARINA.name }) });
      await visible(
        marinaCard
          .getByRole("list", { name: "Trajetória" })
          .getByText("Primeira da família na universidade"),
        "marca no cartão da Marina",
      );
      const results = await page.getByRole("heading", { level: 2, name: /encontrada/ }).innerText();

      await chip.click();
      await page.waitForURL(/\/pesquisadoras$/);
      await visible(page.getByRole("link", { name: DEBORA_NAME }), "Débora sem o filtro");

      await open(page, "/pesquisadoras?trajetoria=raca");
      assert(
        (await page.getByRole("link", { name: /^Remover filtro Trajetória/ }).count()) === 0,
        "slug desconhecido virou filtro",
      );
      await visible(page.getByRole("link", { name: DEBORA_NAME }), "slug desconhecido ignorado");
      return results;
    },
  );

  await step("/pesquisadoras/<Marina>: “Trajetória” e “Vocês têm em comum”", async () => {
    const page = await pageAs(LARISSA.email);
    await open(page, `/pesquisadoras/${MARINA.id}`);
    await visible(page.getByRole("heading", { level: 2, name: "Trajetória" }), "seção Trajetória");
    await visible(
      page.getByText(
        "Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em escola pública.",
      ),
      "destaque “Vocês têm em comum”",
    );

    const debora = await pageAs(DEBORA.email);
    await open(debora, `/pesquisadoras/${MARINA.id}`);
    await visible(debora.getByRole("heading", { level: 2, name: "Trajetória" }), "seção (Débora)");
    assert(
      (await debora.getByText(/Vocês têm em comum/).count()) === 0,
      "a Débora viu “Vocês têm em comum” sem marca em comum",
    );

    const visitor = await pageAs(null);
    await open(visitor, `/pesquisadoras/${MARINA.id}`);
    assert(new URL(visitor.url()).pathname === "/entrar", "visitante não foi para /entrar");
    const html = await visitor.content();
    assert(!html.includes("Primeira da família"), "marca apareceu para visitante");
    return "ok";
  });

  await step("Onboarding: conta nova marca uma opção em “Sobre você”", async () => {
    const created = await q(
      db.auth.admin.createUser({
        email: NEW_EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: NEW_NAME },
      }),
      "criar conta",
    );
    ctx.newUserId = created.user.id;
    // Capturas da etapa 1 antes de salvar (depois, o onboarding continua na etapa 2).
    const shotsTaken = await capture("onboarding-sobre", "/onboarding", NEW_EMAIL, {
      element: (p) => p.getByRole("group", { name: /Sua trajetória/ }),
    });
    const page = await pageAs(NEW_EMAIL);
    await open(page, "/onboarding");
    const group = page.getByRole("group", { name: /Sua trajetória/ });
    await visible(group, "grupo de trajetória na etapa 1");
    assert(
      (await group.getByRole("checkbox", { checked: true }).count()) === 0,
      "conta nova não deveria ter marca nenhuma",
    );
    await page.getByLabel("Nome completo").fill(NEW_NAME);
    await page.getByLabel("Fase da carreira").selectOption("undergraduate");
    await group.getByText("Estudei em escola pública", { exact: true }).click();
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await visible(page.getByRole("heading", { name: "Sua pesquisa" }), "etapa 2");
    const row = await q(
      db.from("profiles").select("trajectory_tags").eq("id", ctx.newUserId).single(),
      "perfil novo",
    );
    assert(
      JSON.stringify(row.trajectory_tags) === JSON.stringify(["escola-publica"]),
      `banco: ${JSON.stringify(row.trajectory_tags)}`,
    );
    return `escola-publica gravada na etapa 1; ${shotsTaken} capturas`;
  });

  await step(
    "Capturas: cartão, grupo do perfil, diretório filtrado e perfil da Marina",
    async () => {
      const n =
        (await capture("mentoria-sugestoes", "/mentoria", LARISSA.email, {
          element: (page) =>
            page
              .getByRole("list", { name: "Sugestões de mentoras" })
              .getByRole("article")
              .filter({ hasText: "Em comum na trajetória" }),
        })) +
        (await capture("perfil-trajetoria", "/perfil#sobre", LARISSA.email, {
          element: (page) =>
            page.locator("section#sobre").getByRole("group", { name: /Sua trajetória/ }),
        })) +
        (await capture(
          "pesquisadoras-trajetoria",
          "/pesquisadoras?trajetoria=primeira-geracao",
          LARISSA.email,
        )) +
        (await capture("pesquisadora-marina", `/pesquisadoras/${MARINA.id}`, LARISSA.email, {
          element: (page) =>
            page.locator("section").filter({
              has: page.getByRole("heading", { level: 2, name: "Trajetória" }),
            }),
        }));
      return `${n} capturas`;
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(path.join(OUT, "capturas"), { recursive: true });
  try {
    const response = await fetch(`${BASE_URL}/entrar`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(
      `O app não respondeu em ${BASE_URL}: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(2);
  }
  const { error: columnError } = await db.from("profiles").select("trajectory_tags").limit(1);
  if (columnError) {
    console.error(
      `Coluna profiles.trajectory_tags indisponível (${columnError.message}). Aplique a migration 20261028190200.`,
    );
    process.exit(2);
  }

  console.log(`Trajetória E2E — ${BASE_URL} — ${TAG}\nCapturas em ${OUT}\n`);
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  try {
    await journey();
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await step("Limpeza: marcas da Larissa restauradas e conta nova apagada", async () => {
      const restored = larissaOriginal;
      await restoreLarissa();
      const removed = await cleanupUsers();
      const now = await larissaTags();
      if (restored) assert(sameSet(now, restored), "as marcas da Larissa não voltaram");
      return `larissa: ${now.join(", ")}; ${removed} conta(s) apagada(s)`;
    });
  }

  const failed = steps.filter((s) => s.status === "fail");
  const skipped = steps.filter((s) => s.status === "skip");
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ base: BASE_URL, tag: TAG, steps, issues, shots }, null, 2),
  );
  console.log(
    `\n${steps.length - failed.length - skipped.length}/${steps.length} etapas ok` +
      `${failed.length ? `, ${failed.length} com falha` : ""}${skipped.length ? `, ${skipped.length} puladas` : ""}; ` +
      `${shots.length} capturas; ${issues.length} problema(s).`,
  );
  for (const item of issues) console.log(`  ! [${item.kind}] ${item.where}: ${item.detail}`);
  process.exit(failed.length || skipped.length || issues.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await restoreLarissa().catch(() => {});
  process.exit(1);
});
