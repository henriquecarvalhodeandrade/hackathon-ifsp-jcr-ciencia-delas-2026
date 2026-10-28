#!/usr/bin/env node
/**
 * E2E do reconhecimento da mentoria (retorno privado, declaração verificável com QR e impacto),
 * com Playwright contra o app rodando de verdade e o Supabase local (seed + 20_reconhecimento).
 *
 * O que o script faz, em ordem:
 *   1. Service role: cria uma mentoria ACEITA gabriela@ (mentoranda) → aline@ (mentora).
 *   2. gabriela@ conclui pela interface e cai em /mentoria/concluida/<id>; o retorno sem nota de
 *      ajuda mostra o erro; ela envia o retorno e pede a declaração (sem a caixa → erro; com a
 *      caixa → pedido). O código pendente ainda não aparece em /verificar ("não encontrada").
 *   3. aline@ vê "Autorizar e emitir" em /mentoria?aba=ativas e autoriza; ela NÃO lê o retorno
 *      da gabriela (consulta com a sessão dela pelo RLS).
 *   4. A declaração mostra o código e o QR em SVG (que codifica a URL de verificação); em mídia
 *      de impressão o cabeçalho do site some e o PDF tem uma página A4. Quem está de fora
 *      (larissa@) recebe 404 na mentoria e na declaração.
 *   5. Visitante sem sessão abre /verificar/<código>: "Válida" e os dois nomes (noindex,
 *      no-referrer); minúsculas redirecionam para o código canônico.
 *   6. gabriela@ revoga (com motivo) e a verificação mostra "Revogada", sem nomes.
 *   7. /verificar/ART-0000-0000-0000 → "não encontrada"; o código do seed ART-7K2M-Q9XD-4HNP →
 *      "Válida"; o formulário de /verificar normaliza e redireciona.
 *   8. Capturas claro/escuro × 1440/390 de /mentoria/concluida, /mentoria/declaracao e
 *      /verificar/<código> (mais o cartão da aline e as páginas de verificação), com checagem de
 *      rolagem horizontal, contraste (AA, 1440 px), erros de console e avisos de hidratação.
 * Tudo o que o teste cria é apagado no fim com a service role (e sobras de execuções anteriores,
 * no começo); a disponibilidade da aline@ volta ao valor original.
 *
 * Pré-requisitos: Supabase local com o seed (incluindo supabase/seeds/20_reconhecimento.sql),
 * .env.local com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e
 * SUPABASE_SECRET_KEY, e o app rodando em BASE_URL (padrão http://localhost:3802).
 *
 * Uso (na raiz do repositório)
 *   BASE_URL=http://localhost:3802 node scripts/e2e/reconhecimento.mjs
 * Variáveis opcionais: OUT_DIR (capturas e report.json), DEMO_PASSWORD, KEEP_DATA=1, HEADED=1,
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
const QRCode = require("qrcode");

// ---------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3802").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "ciencia-delas-demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const KEEP_DATA = process.env.KEEP_DATA === "1";
const SKIP_SHOTS = process.env.SKIP_SHOTS === "1";

/** Tudo o que o teste cria carrega esta marca (na mensagem do pedido), para achar e apagar. */
const TAG_PREFIX = "e2e-rec";
const RUN = Date.now().toString(36);
const TAG = `${TAG_PREFIX}-${RUN}`;
const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), "artemis-e2e", TAG);

const demo = (user) => `${user}@demo.cienciadelas.dev`;
const GABRIELA = {
  id: "d2000000-0000-4000-8000-000000000002",
  email: demo("gabriela"),
  name: "Gabriela Lima",
};
const ALINE = {
  id: "d1000000-0000-4000-8000-000000000009",
  email: demo("aline"),
  name: "Aline Barbosa",
};
const OUTSIDER = demo("larissa");
const SEED_CODE = "ART-7K2M-Q9XD-4HNP";
const UNKNOWN_CODE = "ART-0000-0000-0000";
const CODE_RE = /^ART-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

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

async function signIn(email) {
  const jar = new Map();
  const supabase = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Login de ${email} falhou: ${error.message}`);
  return { supabase, jar };
}

/** Cookies de sessão (formato @supabase/ssr) de uma conta demo, sem passar pela tela de login. */
async function sessionCookies(email) {
  if (cookieCache.has(email)) return cookieCache.get(email);
  const { jar } = await signIn(email);
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

async function pageAs(email) {
  const context = await newContext({ cookies: email ? await sessionCookies(email) : undefined });
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

/** Capturas claro/escuro × 1440/390 de uma página, com rolagem horizontal e contraste. */
async function capture(name, url, email, { variants = VARIANTS } = {}) {
  if (SKIP_SHOTS) return 0;
  const cookies = email ? await sessionCookies(email) : undefined;
  let count = 0;
  for (const variant of variants) {
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
    await context.close();
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// Dados (service role): criar, conferir e limpar
// ---------------------------------------------------------------------------------------------

let alineAvailability = null;
const runStartedAt = new Date(Date.now() - 5_000).toISOString();

async function cleanup() {
  // Mentorias do teste (esta e sobras): retornos, declarações e o aviso de conclusão saem em
  // cascata / pelo trigger da migration.
  const requests = await q(
    db
      .from("mentorship_requests")
      .select("id")
      .eq("mentee_id", GABRIELA.id)
      .eq("mentor_id", ALINE.id)
      .like("message", `%${TAG_PREFIX}-%`),
    "buscar mentorias do teste",
  );
  const ids = (requests ?? []).map((row) => row.id);
  if (ids.length > 0) {
    await q(db.from("mentorship_requests").delete().in("id", ids), "apagar mentorias do teste");
  }
  // Avisos de pedido/aceite/conclusão criados durante esta execução para as duas contas.
  await q(
    db
      .from("notifications")
      .delete()
      .in("user_id", [GABRIELA.id, ALINE.id])
      .in("type", ["mentorship_request", "mentorship_response"])
      .gte("created_at", runStartedAt),
    "apagar avisos do teste",
  );
  return ids.length;
}

async function restoreAline() {
  if (alineAvailability === null) return;
  await q(
    db.from("profiles").update({ mentor_available: alineAvailability }).eq("id", ALINE.id),
    "restaurar disponibilidade da aline",
  );
  alineAvailability = null;
}

/** Linha do d="" do QR esperado para uma URL (mesmas opções de src/lib/recognition/qr.ts). */
async function expectedQrPath(url) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#0000" },
  });
  return /\sd="([^"]+)"/.exec(svg)?.[1] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Jornada
// ---------------------------------------------------------------------------------------------

async function journey() {
  await step("Limpeza de execuções anteriores", async () => {
    const removed = await cleanup();
    return `${removed} mentoria(s) antiga(s) removida(s)`;
  });

  await step("Service role: mentoria aceita gabriela@ → aline@", async () => {
    const profile = await q(
      db.from("profiles").select("mentor_available").eq("id", ALINE.id).single(),
      "perfil da aline",
    );
    alineAvailability = profile.mentor_available;
    // O trigger de pedido exige a mentora disponível; voltamos ao valor original logo depois.
    if (!alineAvailability) {
      await q(
        db.from("profiles").update({ mentor_available: true }).eq("id", ALINE.id),
        "disponível",
      );
    }
    const created = await q(
      db
        .from("mentorship_requests")
        .insert({
          mentee_id: GABRIELA.id,
          mentor_id: ALINE.id,
          message: `Aline, quero conversar sobre carreira acadêmica e intercâmbio. (${TAG})`,
        })
        .select("id")
        .single(),
      "criar pedido",
    );
    await restoreAline();
    await q(
      db
        .from("mentorship_requests")
        .update({ status: "accepted", response_message: `Vamos juntas! (${TAG})` })
        .eq("id", created.id),
      "aceitar pedido",
    );
    ctx.requestId = created.id;
    return created.id;
  });

  await step(
    "gabriela@ conclui pela interface e cai em /mentoria/concluida/<id>",
    async () => {
      const page = await pageAs(GABRIELA.email);
      ctx.gabriela = page;
      await open(page, "/mentoria?aba=ativas");
      const card = page
        .locator("li")
        .filter({ hasText: ALINE.name })
        .filter({
          has: page.getByRole("button", { name: "Concluir mentoria" }),
        });
      await visible(card, "cartão da mentoria ativa com a Aline");
      await card.getByRole("button", { name: "Concluir mentoria" }).click();
      const dialog = page.getByRole("dialog");
      await visible(dialog, "diálogo de conclusão");
      await dialog.getByRole("button", { name: "Sim, concluir" }).click();
      await page.waitForURL(`**/mentoria/concluida/${ctx.requestId}`, { timeout: 20_000 });
      await visible(
        page.getByRole("heading", {
          level: 1,
          name: "Mentoria concluída. Obrigada por fazer parte.",
        }),
        "título da página de conclusão",
      );
      await visible(page.getByRole("link", { name: "Agora não" }), "link Agora não");
      const row = await q(
        db
          .from("mentorship_requests")
          .select("status, completed_at")
          .eq("id", ctx.requestId)
          .single(),
        "status",
      );
      assert(row.status === "completed" && row.completed_at, "pedido não ficou concluído com data");
      ctx.completed = true;
      return `concluída em ${row.completed_at}`;
    },
    { needs: ["requestId"] },
  );

  await step(
    "Capturas de /mentoria/concluida (formulário do retorno)",
    async () =>
      `${await capture("concluida", `/mentoria/concluida/${ctx.requestId}`, GABRIELA.email)} capturas`,
    { needs: ["completed"] },
  );

  await step(
    "gabriela@ envia o retorno privado (e vê o erro sem a nota de ajuda)",
    async () => {
      const page = ctx.gabriela;
      await open(page, `/mentoria/concluida/${ctx.requestId}`);
      await page.getByRole("checkbox", { name: "Me senti menos sozinha na pesquisa" }).check();
      await page.getByRole("button", { name: "Enviar meu retorno" }).click();
      await visible(
        page.getByText("Escolha de 1 a 5 quanto a mentoria ajudou você.").first(),
        "erro da nota de ajuda",
      );
      assert(
        await page
          .getByRole("checkbox", { name: "Me senti menos sozinha na pesquisa" })
          .isChecked(),
        "a opção marcada se perdeu depois do erro",
      );
      await page.locator('input[name="helpfulness"][value="4"]').check();
      await page.getByRole("checkbox", { name: "Saí com um plano para os próximos meses" }).check();
      await page.getByRole("radio", { name: "Sim" }).check();
      await page.getByLabel("Quer deixar uma nota?").fill(`Foi muito bom conversar. (${TAG})`);
      await page.getByRole("button", { name: "Enviar meu retorno" }).click();
      await visible(page.getByText("Obrigada por contar como foi!"), "aviso de retorno enviado");
      await visible(
        page.getByText("Você já contou como foi. Obrigada!"),
        "estado de retorno enviado",
      );
      const rows = await q(
        db
          .from("mentorship_feedback")
          .select("author_id, role, helpfulness, outcomes, would_recommend, note")
          .eq("request_id", ctx.requestId),
        "retornos",
      );
      assert(rows.length === 1, `esperava 1 retorno, veio ${rows.length}`);
      const [row] = rows;
      assert(row.author_id === GABRIELA.id && row.role === "mentee", "autoria/papel errados");
      assert(row.helpfulness === 4 && row.would_recommend === true, "respostas erradas");
      assert(
        row.outcomes.join(",") === "menos-sozinha,plano-definido",
        `opções: ${row.outcomes.join(",")}`,
      );
      ctx.feedback = true;
      return "retorno gravado (mentee, nota 4)";
    },
    { needs: ["completed"] },
  );

  await step(
    "gabriela@ pede a declaração (a caixa de autorização é obrigatória)",
    async () => {
      const page = ctx.gabriela;
      const panel = page.locator("#declaracao");
      await panel.getByRole("button", { name: "Pedir declaração" }).click();
      await visible(
        panel.getByText(/autorize que seu nome apareça na declaração/).first(),
        "erro sem a autorização",
      );
      await panel.getByRole("checkbox", { name: /Autorizo que meu nome apareça/ }).check();
      await panel.getByRole("button", { name: "Pedir declaração" }).click();
      await visible(page.getByText("Declaração pedida", { exact: true }), "aviso de pedido");
      await visible(
        page
          .locator("#declaracao")
          .getByText(`Aguardando a autorização de ${ALINE.name.split(" ")[0]}`),
        "estado aguardando",
      );
      const declarations = await q(
        db
          .from("mentorship_declarations")
          .select("id, code, requested_by, mentee_consented_at, mentor_consented_at, issued_at")
          .eq("request_id", ctx.requestId),
        "declarações",
      );
      assert(declarations.length === 1, `esperava 1 declaração, veio ${declarations.length}`);
      const [decl] = declarations;
      assert(CODE_RE.test(decl.code), `código fora do formato: ${decl.code}`);
      assert(decl.requested_by === GABRIELA.id && decl.mentee_consented_at, "autorização dela");
      assert(!decl.mentor_consented_at && !decl.issued_at, "não deveria estar emitida");
      ctx.declarationId = decl.id;
      ctx.code = decl.code;
      return decl.code;
    },
    { needs: ["feedback"] },
  );

  await step(
    "Código pendente ainda não aparece na verificação pública",
    async () => {
      const page = await pageAs(null);
      await open(page, `/verificar/${ctx.code}`);
      await visible(page.getByText("Declaração não encontrada"), "não encontrada (pendente)");
      assert((await page.getByText(GABRIELA.name).count()) === 0, "nome vazou antes da emissão");
      return "pendente = não encontrada";
    },
    { needs: ["code"] },
  );

  await step(
    "aline@ não lê o retorno da gabriela (RLS)",
    async () => {
      const { supabase } = await signIn(ALINE.email);
      const { data, error } = await supabase
        .from("mentorship_feedback")
        .select("id")
        .eq("request_id", ctx.requestId);
      assert(!error, `consulta falhou: ${error?.message}`);
      assert((data ?? []).length === 0, "a mentora leu o retorno da mentoranda");
      await supabase.auth.signOut();
      return "0 linhas";
    },
    { needs: ["feedback"] },
  );

  await step(
    "Capturas do cartão da aline@ com “Autorizar e emitir”",
    async () =>
      `${await capture("ativas-aline", "/mentoria?aba=ativas", ALINE.email, { variants: VARIANTS })} capturas`,
    { needs: ["code"] },
  );

  await step(
    "aline@ autoriza e emite em /mentoria?aba=ativas",
    async () => {
      const page = await pageAs(ALINE.email);
      await open(page, "/mentoria?aba=ativas");
      const card = page.locator(`#reconhecimento-${ctx.requestId}`);
      await visible(card, "cartão da mentoria concluída");
      await visible(
        card.getByText(`${GABRIELA.name.split(" ")[0]} pediu a declaração desta mentoria`),
        "texto do pedido",
      );
      await visible(
        card.getByText("Conte como foi (privado)"),
        "link do retorno (ela ainda não respondeu)",
      );
      await card.getByRole("checkbox", { name: /Autorizo que meu nome apareça/ }).check();
      await card.getByRole("button", { name: "Autorizar e emitir" }).click();
      await visible(page.getByText("Declaração emitida!"), "aviso de emissão");
      await visible(
        page.locator(`#reconhecimento-${ctx.requestId}`).getByText(ctx.code),
        "código no cartão",
      );
      const decl = await q(
        db
          .from("mentorship_declarations")
          .select("issued_at, mentor_consented_at")
          .eq("id", ctx.declarationId)
          .single(),
        "declaração",
      );
      assert(decl.issued_at && decl.mentor_consented_at, "não foi emitida");
      ctx.issued = true;
      return `emitida em ${decl.issued_at}`;
    },
    { needs: ["code"] },
  );

  await step(
    "Declaração: código, QR (SVG com a URL de verificação), impressão sem o cabeçalho, 1 página A4",
    async () => {
      const page = ctx.gabriela;
      await open(page, `/mentoria/declaracao/${ctx.declarationId}`);
      await visible(
        page.getByRole("heading", { level: 1, name: "Declaração de participação em mentoria" }),
        "título da declaração",
      );
      await visible(page.getByText(ctx.code).first(), "código");
      const qr = page.getByRole("img", { name: "QR code para verificar a declaração" });
      await visible(qr, "QR code");
      assert((await qr.locator("svg").count()) === 1, "o QR não é um SVG");
      const url = await qr.getAttribute("data-qr-url");
      assert(url?.endsWith(`/verificar/${ctx.code}`), `URL do QR inesperada: ${url}`);
      const actual = /\sd="([^"]+)"/.exec(await qr.innerHTML())?.[1];
      assert(
        actual && actual === (await expectedQrPath(url)),
        "o QR não codifica a URL de verificação",
      );
      const text = await page.locator("article").innerText();
      assert(text.includes(ALINE.name) && text.includes(GABRIELA.name), "nomes ausentes");
      assert(
        !/hora/i.test(text.split("Declaração de participação registrada")[0]),
        "texto fala em horas",
      );

      await page.emulateMedia({ media: "print" });
      assert(
        !(await page.locator("body > header").first().isVisible()),
        "cabeçalho visível na impressão",
      );
      assert(
        !(await page.locator("body > footer").first().isVisible()),
        "rodapé visível na impressão",
      );
      assert(
        !(await page.getByRole("button", { name: "Imprimir ou salvar em PDF" }).isVisible()),
        "botão de imprimir visível na impressão",
      );
      assert(await page.locator("article").isVisible(), "a folha sumiu na impressão");
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
      assert(pages === 1, `a impressão ocupou ${pages} páginas`);
      await page.emulateMedia({ media: "screen" });
      ctx.qrUrl = url;
      return `QR → ${url}; PDF com ${pages} página A4`;
    },
    { needs: ["issued"] },
  );

  await step(
    "Quem está de fora (larissa@) recebe 404 na mentoria e na declaração",
    async () => {
      const page = await pageAs(OUTSIDER);
      for (const url of [
        `/mentoria/concluida/${ctx.requestId}`,
        `/mentoria/declaracao/${ctx.declarationId}`,
      ]) {
        const response = await open(page, url);
        assert(response?.status() === 404, `${url}: HTTP ${response?.status()}`);
      }
      return "404 nas duas";
    },
    { needs: ["issued"] },
  );

  await step(
    "Capturas de /mentoria/declaracao",
    async () =>
      `${await capture("declaracao", `/mentoria/declaracao/${ctx.declarationId}`, GABRIELA.email)} capturas`,
    { needs: ["issued"] },
  );

  await step(
    "Visitante: /verificar/<código> mostra “Válida” e os dois nomes",
    async () => {
      const page = await pageAs(null);
      const response = await open(
        page,
        `/verificar/${ctx.code.toLowerCase().replaceAll("-", " ")}`,
      );
      assert(response?.ok(), `HTTP ${response?.status()}`);
      assert(
        page.url().endsWith(`/verificar/${ctx.code}`),
        `não foi para o código canônico: ${page.url()}`,
      );
      await visible(page.getByRole("heading", { level: 1, name: "Declaração válida" }), "título");
      await visible(page.getByText("Válida", { exact: true }), "selo Válida");
      await visible(page.getByText(GABRIELA.name), "nome da mentoranda");
      await visible(page.getByText(ALINE.name), "nome da mentora");
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      const referrer = await page.locator('meta[name="referrer"]').getAttribute("content");
      assert(/noindex/.test(robots ?? ""), `robots: ${robots}`);
      assert(referrer === "no-referrer", `referrer: ${referrer}`);
      const body = await page.locator("main").innerText();
      assert(
        !/@demo\.cienciadelas\.dev|Universidade|Instituto/i.test(body),
        "dados demais na verificação",
      );
      ctx.verified = true;
      return "válida, noindex, no-referrer";
    },
    { needs: ["issued"] },
  );

  await step(
    "Capturas de /verificar/<código> (válida)",
    async () => `${await capture("verificar-valida", `/verificar/${ctx.code}`, null)} capturas`,
    { needs: ["verified"] },
  );

  await step(
    "gabriela@ revoga e a verificação mostra “Revogada”, sem nomes",
    async () => {
      const page = ctx.gabriela;
      await open(page, `/mentoria/concluida/${ctx.requestId}`);
      const panel = page.locator("#declaracao");
      await panel.getByRole("button", { name: "Revogar" }).click();
      const dialog = page.getByRole("dialog");
      await visible(dialog, "diálogo de revogação");
      await dialog.getByLabel("Motivo").fill(`Teste automatizado (${TAG})`);
      await dialog.getByRole("button", { name: "Sim, revogar" }).click();
      await visible(page.getByText("Declaração revogada", { exact: true }), "aviso de revogação");
      await visible(page.locator("#declaracao").getByText(/Revogada em/), "estado revogada");
      await visible(
        page.locator("#declaracao").getByRole("button", { name: "Pedir uma nova" }),
        "pedir uma nova",
      );

      const visitor = await pageAs(null);
      await open(visitor, `/verificar/${ctx.code}`);
      await visible(
        visitor.getByRole("heading", { level: 1, name: "Declaração revogada" }),
        "título revogada",
      );
      const text = await visitor.locator("main").innerText();
      assert(
        !text.includes(GABRIELA.name) && !text.includes(ALINE.name),
        "nomes aparecem na revogada",
      );
      ctx.revoked = true;
      return "revogada sem nomes";
    },
    { needs: ["verified"] },
  );

  await step(
    "Capturas de /verificar/<código> (revogada)",
    async () =>
      `${await capture("verificar-revogada", `/verificar/${ctx.code}`, null, { variants: VARIANTS.filter((v) => v.theme === "light") })} capturas`,
    { needs: ["revoked"] },
  );

  await step("Códigos desconhecido, do seed e o formulário de /verificar", async () => {
    const page = await pageAs(null);
    await open(page, `/verificar/${UNKNOWN_CODE}`);
    await visible(page.getByText("Declaração não encontrada"), "não encontrada");
    await visible(page.getByText("Confira se digitou o código como está na declaração."), "dica");
    await open(page, `/verificar/${SEED_CODE}`);
    await visible(
      page.getByRole("heading", { level: 1, name: "Declaração válida" }),
      "seed válida",
    );
    await open(page, "/verificar");
    await page.getByLabel("Código da declaração").fill("art 7k2m q9xd 4hnp");
    await page.getByRole("button", { name: "Verificar" }).first().click();
    await page.waitForURL(`**/verificar/${SEED_CODE}`);
    await open(page, "/verificar?codigo=abc");
    await visible(page.getByText(/não está no formato da declaração/), "erro de formato");
    return "ok";
  });

  await step("Capturas de /verificar e do código desconhecido", async () => {
    const light = VARIANTS.filter((v) => v.theme === "light");
    const n =
      (await capture("verificar", "/verificar", null)) +
      (await capture("verificar-nao-encontrada", `/verificar/${UNKNOWN_CODE}`, null, {
        variants: light,
      })) +
      (await capture("verificar-seed", `/verificar/${SEED_CODE}`, null, { variants: light }));
    return `${n} capturas`;
  });
}

// ---------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(path.join(OUT, "capturas"), { recursive: true });
  try {
    const response = await fetch(`${BASE_URL}/verificar`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(
      `O app não respondeu em ${BASE_URL}: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(2);
  }

  console.log(`Reconhecimento E2E — ${BASE_URL} — ${TAG}\nCapturas em ${OUT}\n`);
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  try {
    await journey();
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await restoreAline().catch((error) => issue("cleanup", "aline", String(error)));
    if (!KEEP_DATA) {
      await step("Limpeza (service role)", async () => `${await cleanup()} mentoria(s) apagada(s)`);
    }
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
  await restoreAline().catch(() => {});
  process.exit(1);
});
