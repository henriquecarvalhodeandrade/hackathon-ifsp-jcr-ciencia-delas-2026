#!/usr/bin/env node
/**
 * Configura um projeto do Supabase Cloud (e, opcionalmente, a Vercel) para este app.
 * Node 22+, sem dependências: usa o `fetch` global e o CLI do Supabase (`npx supabase`).
 *
 * Uso (detalhes em scripts/deploy/README.md):
 *
 *   export SUPABASE_ACCESS_TOKEN=sbp_...          # https://supabase.com/dashboard/account/tokens
 *   export SUPABASE_PROJECT_REF=abcdefghijklmnopqrst
 *   export SUPABASE_DB_PASSWORD='senha-do-banco'
 *
 *   # 1) Simulação: não altera nada (com token, só faz leituras para conferir o acesso)
 *   node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --dry-run
 *
 *   # 2) Para valer, gravando as chaves num arquivo local ignorado pelo git
 *   node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --write-env=.env.cloud
 *
 * Flags:
 *   --site-url=<https://...>   URL pública do site (obrigatória)
 *   --dry-run                  simula; nenhuma escrita no Supabase, na Vercel ou no disco
 *   --write-env[=<arquivo>]    grava as variáveis num arquivo .env* ignorado pelo git (padrão .env.cloud)
 *   --vercel                   cadastra as variáveis na Vercel (precisa de VERCEL_TOKEN)
 *   --redirect-url=<url>       URL extra para "Redirect URLs" (pode repetir; ex.: previews da Vercel)
 *   --migrations-via-api       aplica as migrations por HTTPS (API de gerenciamento) em vez de
 *                              `supabase db push`; para redes sem acesso TCP ao Postgres
 *   --with-demo-seed           aplica o seed.sql INTEIRO (contas fictícias, senha pública). Nunca em produção.
 *   --help                     mostra esta ajuda
 *
 * Variáveis opcionais: VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT, CRON_SECRET, GEMINI_API_KEY,
 * GROQ_API_KEY, OPENROUTER_API_KEY, RESEND_API_KEY, NEWSLETTER_FROM e SMTP_HOST/SMTP_PORT/SMTP_USER/
 * SMTP_PASS/SMTP_ADMIN_EMAIL/SMTP_SENDER_NAME (SMTP próprio para os e-mails do Auth).
 */

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

export const SUPABASE_API_BASE = "https://api.supabase.com";
export const VERCEL_API_BASE = "https://api.vercel.com";

/** Tipos de e-mail do Auth configurados por este app (nomes iguais aos do config.toml e da API). */
export const EMAIL_TEMPLATE_TYPES = [
  "confirmation",
  "magic_link",
  "recovery",
  "email_change",
  "invite",
];

export const MIN_PASSWORD_LENGTH = 8;
export const DEFAULT_ENV_FILE = ".env.cloud";
export const STORAGE_BUCKET = "avatars";
/** Placeholder usado só na simulação sem SUPABASE_PROJECT_REF (20 letras minúsculas, como um ref real). */
export const PLACEHOLDER_REF = "xxxxxxxxxxxxxxxxxxxx";

/** Arquivos que o próprio Next.js carrega em `next dev`/`next build` locais. */
const NEXT_AUTOLOADED_ENV_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
]);

/** Variáveis repassadas à Vercel quando existem no ambiente de quem roda o script. */
const OPTIONAL_PASSTHROUGH_VARS = [
  { key: "GEMINI_API_KEY", secret: true },
  { key: "GROQ_API_KEY", secret: true },
  { key: "OPENROUTER_API_KEY", secret: true },
  { key: "RESEND_API_KEY", secret: true },
  { key: "NEWSLETTER_FROM", secret: false },
];

const CRON_SECRET_PLACEHOLDER = "troque-por-uma-string-aleatoria-longa";

const LINKS = {
  supabaseTokens: "https://supabase.com/dashboard/account/tokens",
  supabaseDashboard: "https://supabase.com/dashboard/project",
  vercelTokens: "https://vercel.com/account/tokens",
  vercelNew: "https://vercel.com/new",
};

// -----------------------------------------------------------------------------
// Argumentos e validação
// -----------------------------------------------------------------------------

/**
 * Lê as flags da linha de comando. Aceita `--flag=valor` e `--flag valor`.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const args = {
    siteUrl: undefined,
    dryRun: false,
    withDemoSeed: false,
    writeEnv: undefined,
    vercel: false,
    redirectUrls: [],
    migrationsViaApi: false,
    autoConfirmEmail: false,
    help: false,
    errors: [],
  };
  const valueFlags = new Set(["--site-url", "--write-env", "--redirect-url"]);
  // Flags booleanas não aceitam valor: "--with-demo-seed=false" LIGARIA a flag se fosse aceito.
  const booleanFlags = new Set([
    "--help",
    "-h",
    "--dry-run",
    "--with-demo-seed",
    "--vercel",
    "--migrations-via-api",
    "--auto-confirm-email",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const eq = raw.indexOf("=");
    const name = eq === -1 ? raw : raw.slice(0, eq);
    let value = eq === -1 ? undefined : raw.slice(eq + 1);
    if (booleanFlags.has(name) && value !== undefined) {
      args.errors.push(
        `${name} não aceita valor (recebido: ${raw}). Para ligar, use só ${name}; para desligar, omita a flag.`,
      );
      continue;
    }
    if (
      value === undefined &&
      valueFlags.has(name) &&
      i + 1 < argv.length &&
      !argv[i + 1].startsWith("--")
    ) {
      value = argv[++i];
    }
    switch (name) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--with-demo-seed":
        args.withDemoSeed = true;
        break;
      case "--vercel":
        args.vercel = true;
        break;
      case "--migrations-via-api":
        args.migrationsViaApi = true;
        break;
      case "--auto-confirm-email":
        args.autoConfirmEmail = true;
        break;
      case "--site-url":
        if (!value)
          args.errors.push(
            "--site-url precisa de um valor (ex.: --site-url=https://seu-app.vercel.app).",
          );
        args.siteUrl = value;
        break;
      case "--write-env":
        args.writeEnv = value || DEFAULT_ENV_FILE;
        break;
      case "--redirect-url":
        if (!value) args.errors.push("--redirect-url precisa de um valor.");
        else args.redirectUrls.push(value);
        break;
      default:
        args.errors.push(`Flag desconhecida: ${raw}`);
    }
  }
  return args;
}

/**
 * Normaliza a URL do site: exige https, sem credenciais, query, fragmento ou vírgula, e remove a
 * barra final. Lança um Error com mensagem em pt-BR se a URL for inválida.
 */
export function normalizeSiteUrl(input) {
  if (!input) throw new Error("Informe a URL pública do site com --site-url=https://...");
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`--site-url inválida: "${input}". Use algo como https://seu-app.vercel.app`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`--site-url precisa começar com https:// (recebido: ${input}).`);
  }
  if (url.username || url.password || url.search || url.hash || input.includes(",")) {
    throw new Error("--site-url não pode ter usuário/senha, query (?), fragmento (#) nem vírgula.");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}`;
}

/** Valida uma URL extra de redirect (aceita curingas * e ** do Supabase). */
export function validateRedirectUrl(input) {
  if (!/^https?:\/\/[^\s,]+$/.test(input ?? "")) {
    throw new Error(
      `--redirect-url inválida: "${input}". Use http(s)://..., sem espaços nem vírgulas (ex.: https://*-sua-conta.vercel.app/**).`,
    );
  }
  return input;
}

/** Aceita o ref puro ou a URL do projeto (https://<ref>.supabase.co). */
export function normalizeProjectRef(input) {
  const value = (input ?? "").trim();
  const fromUrl = value.match(/^https?:\/\/([a-z]{20})\.supabase\.co\/?$/);
  return fromUrl ? fromUrl[1] : value;
}

export function isValidProjectRef(ref) {
  return /^[a-z]{20}$/.test(ref ?? "");
}

/**
 * Valida o caminho do arquivo de variáveis: precisa ficar dentro do repositório e se chamar .env*
 * (o .gitignore do projeto ignora `.env*`, exceto .env.example).
 */
export function resolveEnvFilePath(rootDir, file) {
  const abs = path.resolve(rootDir, file);
  const rel = path.relative(rootDir, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `--write-env precisa apontar para um arquivo dentro do repositório (recebido: ${file}).`,
    );
  }
  const base = path.basename(abs);
  if (!/^\.env(\..+)?$/.test(base) || base === ".env.example") {
    throw new Error(
      `--write-env precisa ser um arquivo .env* ignorado pelo git (ex.: ${DEFAULT_ENV_FILE}); recebido: ${file}.`,
    );
  }
  return { abs, rel, base, autoloadedByNext: NEXT_AUTOLOADED_ENV_FILES.has(base) };
}

/** Lê a configuração de SMTP próprio do ambiente (opcional; tudo ou nada). */
export function readSmtpConfig(env) {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const adminEmail = env.SMTP_ADMIN_EMAIL?.trim();
  if (!host && !user && !pass && !adminEmail) return { smtp: null, errors: [] };
  const missing = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !pass && "SMTP_PASS",
    !adminEmail && "SMTP_ADMIN_EMAIL",
  ].filter(Boolean);
  if (missing.length) {
    return {
      smtp: null,
      errors: [
        `SMTP próprio incompleto: faltam ${missing.join(", ")} (ou remova todas as SMTP_*).`,
      ],
    };
  }
  const port = (env.SMTP_PORT ?? "465").trim();
  if (!/^\d{2,5}$/.test(port)) return { smtp: null, errors: [`SMTP_PORT inválida: ${port}`] };
  return {
    smtp: {
      host,
      port,
      user,
      pass,
      adminEmail,
      senderName: env.SMTP_SENDER_NAME?.trim() || undefined,
    },
    errors: [],
  };
}

/**
 * Junta flags e variáveis de ambiente numa configuração validada.
 * Na simulação, token/ref/senha ausentes viram avisos (a simulação roda offline).
 */
export function buildConfig(args, env, { packageName } = {}) {
  const errors = [...args.errors];
  const warnings = [];
  const dryRun = args.dryRun;

  const token = env.SUPABASE_ACCESS_TOKEN?.trim() || "";
  const rawRef = env.SUPABASE_PROJECT_REF?.trim() || "";
  let ref = normalizeProjectRef(rawRef);
  const dbPassword = env.SUPABASE_DB_PASSWORD ?? "";

  const requireOrWarn = (ok, message) => {
    if (ok) return;
    if (dryRun) warnings.push(`${message} (simulação: seguindo sem ele)`);
    else errors.push(message);
  };
  requireOrWarn(
    Boolean(token),
    `SUPABASE_ACCESS_TOKEN ausente. Crie um Personal Access Token em ${LINKS.supabaseTokens}`,
  );
  if (token && !token.startsWith("sbp_")) {
    warnings.push(
      'SUPABASE_ACCESS_TOKEN não começa com "sbp_"; confira se é um Personal Access Token.',
    );
  }
  if (rawRef && !isValidProjectRef(ref)) {
    errors.push(
      `SUPABASE_PROJECT_REF inválido: deve ter 20 letras minúsculas (Project Settings > General). Recebido: "${rawRef}".`,
    );
  } else if (rawRef && ref !== rawRef) {
    warnings.push(`SUPABASE_PROJECT_REF veio como URL; usando o ref ${ref}.`);
  }
  requireOrWarn(
    Boolean(rawRef),
    "SUPABASE_PROJECT_REF ausente (Project Settings > General > Project ID)",
  );
  if (!rawRef) ref = PLACEHOLDER_REF;
  // Só o CLI (link/db push) usa a senha; com --migrations-via-api tudo vai pela API com o token.
  if (!args.migrationsViaApi) {
    requireOrWarn(
      Boolean(dbPassword),
      "SUPABASE_DB_PASSWORD ausente (a senha do banco definida ao criar o projeto)",
    );
  }

  let siteUrl;
  try {
    siteUrl = normalizeSiteUrl(args.siteUrl);
  } catch (err) {
    errors.push(err.message);
  }

  const redirectUrls = [];
  for (const url of args.redirectUrls) {
    try {
      redirectUrls.push(validateRedirectUrl(url));
    } catch (err) {
      errors.push(err.message);
    }
  }

  const { smtp, errors: smtpErrors } = readSmtpConfig(env);
  errors.push(...smtpErrors);

  if (args.autoConfirmEmail) {
    warnings.push(
      "--auto-confirm-email: contas novas entram sem confirmar o e-mail. Útil para a demo sem SMTP próprio; para o site aberto ao público, prefira configurar SMTP (SMTP_*) e rodar de novo sem esta flag.",
    );
  }
  if (args.withDemoSeed) {
    warnings.push(
      "--with-demo-seed: o seed.sql INTEIRO será aplicado, com contas FICTÍCIAS e senha PÚBLICA. Use só num projeto de demonstração, nunca em produção real.",
    );
  }

  const vercelToken = env.VERCEL_TOKEN?.trim() || "";
  if (args.vercel && !vercelToken) {
    warnings.push(
      `--vercel sem VERCEL_TOKEN: no final será impressa a lista de variáveis para cadastrar à mão (token em ${LINKS.vercelTokens}).`,
    );
  }

  return {
    errors,
    warnings,
    config: {
      dryRun,
      token,
      hasToken: Boolean(token),
      ref,
      refIsPlaceholder: ref === PLACEHOLDER_REF,
      dbPassword,
      siteUrl,
      redirectUrls,
      withDemoSeed: args.withDemoSeed,
      autoConfirmEmail: args.autoConfirmEmail,
      migrationsViaApi: args.migrationsViaApi,
      writeEnv: args.writeEnv,
      vercel: args.vercel,
      vercelToken,
      vercelTeam: env.VERCEL_TEAM_ID?.trim() || "",
      vercelProject: env.VERCEL_PROJECT?.trim() || packageName || "",
      vercelProjectExplicit: Boolean(env.VERCEL_PROJECT?.trim()),
      smtp,
      supabaseUrl: `https://${ref}.supabase.co`,
    },
  };
}

// -----------------------------------------------------------------------------
// Segredos: máscara e redação
// -----------------------------------------------------------------------------

/** Mostra só o prefixo conhecido e o tamanho. Nunca devolve caracteres do corpo do segredo. */
export function maskSecret(value) {
  if (value === undefined || value === null || value === "") return "(vazio)";
  const str = String(value);
  const prefix = str.match(/^(sb_publishable_|sb_secret_|sbp_oauth_|sbp_|eyJ)/)?.[1] ?? "";
  return `${prefix}****(${str.length} caracteres)`;
}

/** Cria uma função que troca qualquer segredo conhecido pela versão mascarada. */
export function createRedactor() {
  const secrets = new Set();
  const redact = (text) => {
    let out = String(text);
    for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
      if (out.includes(secret)) out = out.split(secret).join(maskSecret(secret));
    }
    return out;
  };
  redact.add = (...values) => {
    for (const v of values) if (typeof v === "string" && v.length >= 6) secrets.add(v);
  };
  return redact;
}

// -----------------------------------------------------------------------------
// config.toml (subconjunto de TOML suficiente para este arquivo)
// -----------------------------------------------------------------------------

/** Interpreta um valor TOML de uma linha: strings básicas/literais, booleanos e inteiros. */
export function parseTomlValue(raw) {
  const s = raw.trim();
  if (s.startsWith('"""') || s.startsWith("'''")) {
    throw new Error("Strings TOML multilinha não são suportadas por este script.");
  }
  if (s.startsWith('"')) {
    let out = "";
    for (let i = 1; i < s.length; i++) {
      const c = s[i];
      if (c === '"') return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const n = s[++i];
      const simple = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
      if (n in simple) out += simple[n];
      else if (n === "u" || n === "U") {
        const len = n === "u" ? 4 : 8;
        out += String.fromCodePoint(parseInt(s.slice(i + 1, i + 1 + len), 16));
        i += len;
      } else throw new Error(`Escape TOML inválido: \\${n}`);
    }
    throw new Error(`String TOML sem aspas de fechamento: ${s}`);
  }
  if (s.startsWith("'")) {
    const end = s.indexOf("'", 1);
    if (end === -1) throw new Error(`String TOML sem aspas de fechamento: ${s}`);
    return s.slice(1, end);
  }
  const value = s.replace(/\s+#.*$/, "");
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^[+-]?\d[\d_]*$/.test(value)) return Number(value.replaceAll("_", ""));
  return value;
}

/** Devolve Map(seção -> Map(chave -> valor)). Ignora comentários; arrays ficam como texto. */
export function parseTomlSections(text) {
  const sections = new Map([["", new Map()]]);
  let current = "";
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[\s*([A-Za-z0-9_.-]+)\s*\]\s*(#.*)?$/);
    if (header) {
      current = header[1];
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    let raw = kv[2];
    if (raw.startsWith("[") && !raw.includes("]")) {
      while (i + 1 < lines.length && !raw.includes("]")) raw += ` ${lines[++i].trim()}`;
    }
    sections.get(current).set(kv[1], parseTomlValue(raw));
  }
  return sections;
}

/**
 * Lê do config.toml os assuntos e caminhos dos modelos de e-mail ([auth.email.template.<tipo>])
 * e a senha mínima ([auth] minimum_password_length).
 */
export function parseAuthEmailConfig(tomlText) {
  const sections = parseTomlSections(tomlText);
  const templates = {};
  const missing = [];
  for (const type of EMAIL_TEMPLATE_TYPES) {
    const section = sections.get(`auth.email.template.${type}`);
    const subject = section?.get("subject");
    const contentPath = section?.get("content_path");
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof contentPath !== "string" ||
      !contentPath
    ) {
      missing.push(type);
      continue;
    }
    templates[type] = { subject: subject.trim(), contentPath };
  }
  const configured = sections.get("auth")?.get("minimum_password_length");
  const passwordMinLength = Math.max(
    MIN_PASSWORD_LENGTH,
    Number.isInteger(configured) ? configured : MIN_PASSWORD_LENGTH,
  );
  return { templates, missing, passwordMinLength };
}

/** Caminhos candidatos para um content_path do config.toml (relativo à raiz ou à pasta supabase/). */
export function templatePathCandidates(rootDir, contentPath) {
  if (path.isAbsolute(contentPath)) return [contentPath];
  return [path.resolve(rootDir, contentPath), path.resolve(rootDir, "supabase", contentPath)];
}

// -----------------------------------------------------------------------------
// seed.sql
// -----------------------------------------------------------------------------

const SEED_MARKERS = {
  areas: /^--\s*1\.\s*Áreas de pesquisa\s*$/u,
  categories: /^--\s*1b\.\s*Categorias do fórum/u,
  demo: /^--\s*2\.\s*DEMONSTRAÇÃO/u,
};

/** Remove comentários de linha (`-- ...`) para análises simples do SQL. */
function stripSqlLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

/** Garante que todo INSERT tenha ON CONFLICT (o SQL pode ser reaplicado sem duplicar nada). */
export function assertIdempotentInserts(sql, label = "SQL") {
  const code = stripSqlLineComments(sql);
  const inserts = code.match(/\binsert\s+into\b/gi)?.length ?? 0;
  const conflicts = code.match(/\bon\s+conflict\b/gi)?.length ?? 0;
  if (inserts === 0) throw new Error(`${label}: nenhum INSERT encontrado.`);
  if (conflicts < inserts) {
    throw new Error(
      `${label}: ${inserts - conflicts} INSERT(s) sem ON CONFLICT; o script não aplica SQL que duplicaria dados ao ser reexecutado.`,
    );
  }
}

/**
 * Separa o seed.sql em: dados de referência (seções "1. Áreas de pesquisa" e "1b. Categorias do
 * fórum") e demonstração (de "2. DEMONSTRAÇÃO" em diante). Lê os marcadores em tempo de execução,
 * sem editar o arquivo.
 */
export function extractSeedSections(seedSql) {
  const lines = seedSql.split(/\r?\n/);
  const norm = (line) => line.normalize("NFC").trim();
  const find = (re, from) => {
    for (let i = from; i < lines.length; i++) if (re.test(norm(lines[i]))) return i;
    return -1;
  };
  const areasIdx = find(SEED_MARKERS.areas, 0);
  const categoriesIdx = areasIdx === -1 ? -1 : find(SEED_MARKERS.categories, areasIdx + 1);
  const demoIdx = categoriesIdx === -1 ? -1 : find(SEED_MARKERS.demo, categoriesIdx + 1);
  if (areasIdx === -1 || categoriesIdx === -1 || demoIdx === -1) {
    throw new Error(
      'Não encontrei no seed.sql os marcadores "-- 1. Áreas de pesquisa", "-- 1b. Categorias do fórum" e "-- 2. DEMONSTRAÇÃO", nessa ordem.',
    );
  }
  const isSeparator = (line) => /^--\s*[-=]{5,}\s*$/.test(norm(line)) || norm(line) === "";
  let start = areasIdx;
  while (start > 0 && /^--\s*-{5,}\s*$/.test(norm(lines[start - 1]))) start--;
  let end = demoIdx;
  while (end > areasIdx && isSeparator(lines[end - 1])) end--;

  const referenceSql = `${lines.slice(start, end).join("\n").trim()}\n`;
  let demoStart = demoIdx;
  while (demoStart > end && /^--\s*=+\s*$/.test(norm(lines[demoStart - 1]))) demoStart--;
  const demoSql = lines.slice(demoStart).join("\n");

  if (!/insert\s+into\s+public\.research_areas\b/i.test(referenceSql)) {
    throw new Error("Seção de áreas de pesquisa sem INSERT em public.research_areas.");
  }
  if (!/insert\s+into\s+public\.forum_categories\b/i.test(referenceSql)) {
    throw new Error("Seção de categorias sem INSERT em public.forum_categories.");
  }
  if (/\bauth\.(users|identities)\b/i.test(stripSqlLineComments(referenceSql))) {
    throw new Error(
      "Os dados de referência extraídos mencionam auth.users: marcadores do seed.sql fora do lugar?",
    );
  }
  assertIdempotentInserts(referenceSql, "Dados de referência do seed.sql");

  const [areasPart, categoriesPart = ""] = referenceSql.split(
    /insert\s+into\s+public\.forum_categories/i,
  );
  const counts = {
    areas: areasPart.match(/^\s*\('[a-z0-9-]+',\s*'/gm)?.length ?? 0,
    categories: categoriesPart.match(/^\s*\('[a-z0-9-]+',\s*'/gm)?.length ?? 0,
  };
  const demoMarkerUserId =
    demoSql.match(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid/)?.[1] ??
    null;
  return { referenceSql, demoSql, counts, demoMarkerUserId };
}

/** Extrai o INSERT do bucket de uma migration (para recriá-lo se o db push não o tiver criado). */
export function extractBucketInsert(migrationSql, bucket = STORAGE_BUCKET) {
  const match = migrationSql.match(/insert\s+into\s+storage\.buckets\b[\s\S]*?;/i);
  if (!match || !match[0].includes(`'${bucket}'`)) return null;
  assertIdempotentInserts(match[0], `INSERT do bucket ${bucket}`);
  return match[0];
}

// -----------------------------------------------------------------------------
// Migrations por HTTPS (--migrations-via-api)
// -----------------------------------------------------------------------------
// Mesmo formato do CLI: arquivos <versão>_<nome>.sql e o histórico em
// supabase_migrations.schema_migrations(version, name, statements), para que um
// `supabase db push` posterior reconheça o que já foi aplicado.

const MIGRATION_FILE = /^([0-9]+)_(.*)\.sql$/;

export function parseMigrationFileName(file) {
  const m = MIGRATION_FILE.exec(file);
  return m ? { file, version: m[1], name: m[2] } : null;
}

/**
 * Compara as migrations locais com o histórico remoto, com as mesmas regras do `db push`:
 * versões remotas sem arquivo local ou arquivos locais anteriores à última versão remota
 * interrompem o processo.
 * @param {string[]} files nomes dos arquivos em supabase/migrations
 * @param {string[]} appliedVersions versões já registradas no banco
 */
export function planMigrations(files, appliedVersions) {
  const local = files
    .map(parseMigrationFileName)
    .filter(Boolean)
    .sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  const localVersions = new Set(local.map((m) => m.version));
  const applied = [...new Set(appliedVersions.map(String))].sort();
  const missingLocal = applied.filter((v) => !localVersions.has(v));
  if (missingLocal.length) {
    return {
      pending: [],
      error: `O banco tem migrations que não existem em supabase/migrations: ${missingLocal.join(", ")}. Resolva com "npx supabase migration list" antes de continuar.`,
    };
  }
  const appliedSet = new Set(applied);
  const pending = local.filter((m) => !appliedSet.has(m.version));
  const last = applied.at(-1);
  const outOfOrder = last ? pending.filter((m) => m.version < last) : [];
  if (outOfOrder.length) {
    return {
      pending: [],
      error: `Migrations locais anteriores à última aplicada (${last}): ${outOfOrder.map((m) => m.file).join(", ")}. Use "npx supabase db push --include-all" numa rede com acesso ao Postgres.`,
    };
  }
  return { pending, error: null };
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Dollar-quote com uma etiqueta que não aparece no conteúdo. */
export function dollarQuote(content) {
  let n = 0;
  let tag = "$migration$";
  while (content.includes(tag)) tag = `$migration_${++n}$`;
  return `${tag}${content}${tag}`;
}

/** Remove corpos entre $$...$$ / $tag$...$tag$ (funções plpgsql, DO) para análises simples. */
export function stripDollarQuoted(sql) {
  return sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, "''");
}

/** true se o SQL tem BEGIN/COMMIT/ROLLBACK/START TRANSACTION como instruções próprias. */
export function hasTransactionControl(sql) {
  const code = stripDollarQuoted(stripSqlLineComments(sql));
  return /(^|;)\s*(begin|start\s+transaction|commit|rollback)(\s+(work|transaction))?\s*;/i.test(
    code,
  );
}

/**
 * SQL de uma migration + registro no histórico, enviado numa única requisição. Várias instruções
 * numa mesma consulta simples rodam numa transação implícita: se algo falhar, nada fica aplicado
 * nem registrado. Por isso o arquivo não pode ter BEGIN/COMMIT próprios.
 */
export function buildMigrationQuery(content, { version, name }) {
  if (!/^[0-9]+$/.test(version)) throw new Error(`Versão de migration inválida: ${version}`);
  if (hasTransactionControl(content)) {
    throw new Error(
      `A migration ${version}_${name} controla a própria transação (BEGIN/COMMIT); aplique-a com "npx supabase db push".`,
    );
  }
  return [
    content.trimEnd(),
    ";",
    "create schema if not exists supabase_migrations;",
    "create table if not exists supabase_migrations.schema_migrations (version text not null primary key);",
    "alter table supabase_migrations.schema_migrations add column if not exists statements text[];",
    "alter table supabase_migrations.schema_migrations add column if not exists name text;",
    `insert into supabase_migrations.schema_migrations (version, name, statements) values (${quoteLiteral(version)}, ${quoteLiteral(name)}, array[${dollarQuote(content)}]);`,
    "",
  ].join("\n");
}

export const MIGRATION_HISTORY_EXISTS_SQL =
  "select to_regclass('supabase_migrations.schema_migrations') is not null as present;";
export const MIGRATION_HISTORY_SQL =
  "select version from supabase_migrations.schema_migrations order by version;";

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

/** Junta a lista atual de Redirect URLs (texto separado por vírgulas) com as novas, sem repetir. */
export function mergeAllowList(existing, additions) {
  const list = (existing ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const url of additions) if (url && !list.includes(url)) list.push(url);
  return list.join(",");
}

/**
 * Monta o corpo do PATCH /v1/projects/{ref}/config/auth (campos do schema UpdateAuthConfigBody).
 * @param {{siteUrl: string, currentAllowList?: string|null, extraRedirectUrls?: string[],
 *   templates: Record<string, {subject: string, content: string}>, passwordMinLength?: number,
 *   smtp?: {host: string, port: string, user: string, pass: string, adminEmail: string, senderName?: string}|null}} input
 */
export function buildAuthConfigPayload({
  siteUrl,
  currentAllowList = "",
  extraRedirectUrls = [],
  templates,
  passwordMinLength = MIN_PASSWORD_LENGTH,
  smtp = null,
  autoConfirmEmail = false,
}) {
  const payload = {
    site_url: siteUrl,
    uri_allow_list: mergeAllowList(currentAllowList, [`${siteUrl}/**`, ...extraRedirectUrls]),
    external_email_enabled: true,
    // true só com --auto-confirm-email (demo sem SMTP próprio): a conta entra sem confirmar o e-mail.
    mailer_autoconfirm: Boolean(autoConfirmEmail),
    password_min_length: Math.max(MIN_PASSWORD_LENGTH, passwordMinLength),
  };
  for (const type of EMAIL_TEMPLATE_TYPES) {
    const t = templates?.[type];
    if (!t?.subject || !t?.content)
      throw new Error(`Modelo de e-mail "${type}" sem assunto ou conteúdo.`);
    payload[`mailer_subjects_${type}`] = t.subject;
    payload[`mailer_templates_${type}_content`] = t.content;
  }
  if (smtp) {
    payload.smtp_host = smtp.host;
    payload.smtp_port = String(smtp.port);
    payload.smtp_user = smtp.user;
    payload.smtp_pass = smtp.pass;
    payload.smtp_admin_email = smtp.adminEmail;
    if (smtp.senderName) payload.smtp_sender_name = smtp.senderName;
  }
  return payload;
}

/** Resumo legível do payload do Auth (modelos viram tamanhos; senha do SMTP mascarada). */
export function summarizeAuthPayload(payload) {
  return Object.entries(payload).map(([key, value]) => {
    if (key.startsWith("mailer_templates_"))
      return `${key}: (${Buffer.byteLength(value)} bytes de HTML)`;
    if (key === "smtp_pass") return `${key}: ${maskSecret(value)}`;
    return `${key}: ${JSON.stringify(value)}`;
  });
}

// -----------------------------------------------------------------------------
// Chaves da API
// -----------------------------------------------------------------------------

/** Uma chave revelada só tem caracteres de token (sem "•", "*" ou espaços de uma versão mascarada). */
export function looksRevealed(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{20,}$/.test(value);
}

/**
 * Escolhe as chaves: prefere as novas (sb_publishable_/sb_secret_) e cai para as legadas.
 * Com `requireRevealed`, ignora valores mascarados (quando a API não revelou o segredo).
 */
export function pickApiKeys(keys, { requireRevealed = false } = {}) {
  const usable = (k) =>
    k &&
    typeof k.api_key === "string" &&
    k.api_key &&
    (!requireRevealed || looksRevealed(k.api_key));
  const list = Array.isArray(keys) ? keys.filter(usable) : [];
  const prefer = (arr) => arr.find((k) => k.name === "default") ?? arr[0];
  const publishable = prefer(list.filter((k) => k.type === "publishable"));
  const secret = prefer(list.filter((k) => k.type === "secret"));
  const isLegacy = (k) => k.type === "legacy" || k.type === null || k.type === undefined;
  const anon = list.find((k) => isLegacy(k) && k.name === "anon");
  const serviceRole = list.find((k) => isLegacy(k) && k.name === "service_role");
  return {
    publishable: publishable?.api_key ?? null,
    secret: secret?.api_key ?? null,
    legacyAnon: anon?.api_key ?? null,
    legacyServiceRole: serviceRole?.api_key ?? null,
  };
}

// -----------------------------------------------------------------------------
// Arquivo de variáveis
// -----------------------------------------------------------------------------

/** Lê KEY=VALUE (aceita `export`, aspas simples/duplas e comentários). */
export function parseEnvText(text) {
  const out = new Map();
  for (const line of (text ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out.set(m[1], value);
  }
  return out;
}

export function formatEnvValue(value) {
  const v = String(value);
  return /^[A-Za-z0-9_./:@+=,*-]*$/.test(v) ? v : JSON.stringify(v);
}

/**
 * Monta o conteúdo do arquivo .env: substitui as chaves gerenciadas que já existem e acrescenta as
 * que faltam, preservando todas as outras linhas.
 * @param {Record<string,string>} values
 * @param {string} [existingText]
 */
export function buildEnvFile(values, existingText = "", { generatedAt = new Date() } = {}) {
  const pending = new Map(Object.entries(values).filter(([, v]) => v !== undefined && v !== null));
  const lines = existingText ? existingText.replace(/\r?\n$/, "").split(/\r?\n/) : [];
  const out = lines.map((line) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m || !pending.has(m[1])) return line;
    const key = m[1];
    const replaced = `${key}=${formatEnvValue(pending.get(key))}`;
    pending.delete(key);
    return replaced;
  });
  if (pending.size) {
    if (!out.length) {
      out.push(
        "# Variáveis do Supabase Cloud geradas por scripts/deploy/setup-supabase-cloud.mjs",
        `# ${generatedAt.toISOString()} — contém SEGREDOS: não versione nem compartilhe este arquivo.`,
      );
    } else {
      out.push(
        "",
        `# Atualizado por scripts/deploy/setup-supabase-cloud.mjs em ${generatedAt.toISOString()}`,
      );
    }
    for (const [key, value] of pending) out.push(`${key}=${formatEnvValue(value)}`);
  }
  return `${out.join("\n")}\n`;
}

/** CRON_SECRET: do ambiente, do arquivo existente ou um novo (32 bytes aleatórios em hex). */
export function resolveCronSecret(env, existingEnv, randomHex) {
  const fromEnv = env.CRON_SECRET?.trim();
  if (fromEnv && fromEnv !== CRON_SECRET_PLACEHOLDER) return { value: fromEnv, source: "ambiente" };
  const fromFile = existingEnv?.get("CRON_SECRET")?.trim();
  if (fromFile && fromFile !== CRON_SECRET_PLACEHOLDER)
    return { value: fromFile, source: "arquivo" };
  return { value: randomHex(32), source: "gerado" };
}

// -----------------------------------------------------------------------------
// Vercel
// -----------------------------------------------------------------------------

/**
 * Lista de variáveis para a Vercel. NEXT_PUBLIC_* e URLs viram "encrypted" (Config, legíveis);
 * chaves e senhas viram "sensitive" (Secret, só escrita).
 */
export function buildVercelEnvVars(appEnv, env, targets = ["production", "preview"]) {
  const items = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: appEnv.NEXT_PUBLIC_SUPABASE_URL, secret: false },
    {
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      value: appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      secret: false,
    },
    { key: "SUPABASE_SECRET_KEY", value: appEnv.SUPABASE_SECRET_KEY, secret: true },
    { key: "NEXT_PUBLIC_SITE_URL", value: appEnv.NEXT_PUBLIC_SITE_URL, secret: false },
    { key: "CRON_SECRET", value: appEnv.CRON_SECRET, secret: true },
    ...OPTIONAL_PASSTHROUGH_VARS.map(({ key, secret }) => ({
      key,
      value: env[key]?.trim(),
      secret,
    })),
  ];
  return items
    .filter((item) => item.value)
    .map((item) => ({
      key: item.key,
      value: item.value,
      type: item.secret ? "sensitive" : "encrypted",
      target: [...targets],
      comment: "Definida por scripts/deploy/setup-supabase-cloud.mjs",
    }));
}

/**
 * Nome do repositório a partir da URL do remote (https://github.com/dona/repo(.git) ou
 * git@github.com:dona/repo.git). Ao importar um repositório, a Vercel sugere esse nome para o projeto.
 */
export function repoNameFromRemoteUrl(url) {
  const m = String(url ?? "")
    .trim()
    .match(/([^/:]+?)(?:\.git)?\/?$/);
  return m ? m[1].toLowerCase() : null;
}

/** teamId (team_...) ou slug do time, como query string da API da Vercel. */
export function vercelTeamQuery(team) {
  if (!team) return "";
  return team.startsWith("team_")
    ? `teamId=${encodeURIComponent(team)}`
    : `slug=${encodeURIComponent(team)}`;
}

// -----------------------------------------------------------------------------
// HTTP
// -----------------------------------------------------------------------------

export class HttpError extends Error {
  constructor({ status, data, method, url }) {
    let detail;
    if (data && typeof data === "object") {
      detail =
        data.message ??
        data.error?.message ??
        (typeof data.error === "string" ? data.error : JSON.stringify(data));
    } else {
      detail = String(data ?? "");
    }
    super(`${method} ${url} -> ${status || "falha de rede"}: ${String(detail).slice(0, 400)}`);
    this.status = status;
    this.data = data;
    this.detail = String(detail).slice(0, 400);
  }
}

/**
 * Cliente HTTP com novas tentativas: 429 sempre (a requisição não foi processada); 5xx e falhas de
 * rede só para operações idempotentes.
 */
export function createRequester({ fetchImpl, sleep, retries = 3 }) {
  return async function request(
    url,
    { method = "GET", headers = {}, body, idempotent, timeoutMs = 60_000 } = {},
  ) {
    const canRepeat = idempotent ?? method === "GET";
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetchImpl(url, {
          method,
          headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (canRepeat && attempt < retries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new HttpError({ status: 0, data: err?.message ?? String(err), method, url });
      }
      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (res.ok) return { status: res.status, data };
      const retryable = res.status === 429 || (canRepeat && res.status >= 500);
      if (retryable && attempt < retries) {
        const retryAfter = Number(res.headers?.get?.("retry-after"));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt,
        );
        continue;
      }
      throw new HttpError({ status: res.status, data, method, url });
    }
  };
}

/** Endpoints da API de gerenciamento do Supabase (https://supabase.com/docs/reference/api). */
export function createSupabaseApi({ request, token, ref, base = SUPABASE_API_BASE }) {
  const headers = { Authorization: `Bearer ${token}` };
  const project = `${base}/v1/projects/${ref}`;
  return {
    getProject: () => request(project, { headers }),
    getAuthConfig: () => request(`${project}/config/auth`, { headers }),
    updateAuthConfig: (body) =>
      request(`${project}/config/auth`, { method: "PATCH", headers, body, idempotent: true }),
    runQuery: (query, { idempotent = true, timeoutMs = 180_000 } = {}) =>
      request(`${project}/database/query`, {
        method: "POST",
        headers,
        body: { query },
        idempotent,
        timeoutMs,
      }),
    runReadOnlyQuery: (query) =>
      request(`${project}/database/query/read-only`, {
        method: "POST",
        headers,
        body: { query },
        idempotent: true,
      }),
    listBuckets: () => request(`${project}/storage/buckets`, { headers }),
    getApiKeys: ({ reveal }) =>
      request(`${project}/api-keys?reveal=${reveal ? "true" : "false"}`, { headers }),
    createApiKey: (type, name) =>
      request(`${project}/api-keys?reveal=true`, {
        method: "POST",
        headers,
        body: { type, name, description: "Criada por scripts/deploy/setup-supabase-cloud.mjs" },
        idempotent: false,
      }),
  };
}

/** Endpoints da API REST da Vercel (https://vercel.com/docs/rest-api). */
export function createVercelApi({ request, token, team, base = VERCEL_API_BASE }) {
  const headers = { Authorization: `Bearer ${token}` };
  const teamQs = vercelTeamQuery(team);
  const qs = (extra) => {
    const parts = [extra, teamQs].filter(Boolean);
    return parts.length ? `?${parts.join("&")}` : "";
  };
  return {
    getProject: (idOrName) =>
      request(`${base}/v9/projects/${encodeURIComponent(idOrName)}${qs()}`, { headers }),
    upsertEnv: (idOrName, items) =>
      request(`${base}/v10/projects/${encodeURIComponent(idOrName)}/env${qs("upsert=true")}`, {
        method: "POST",
        headers,
        body: items,
        idempotent: true,
      }),
  };
}

/**
 * Permissões que faltam a um token escopado. Desde out/2026 o 403 da API lista essas permissões num
 * array `missing_permissions` (https://supabase.com/changelog/scoped-personal-access-tokens-ga); o
 * formato exato dos itens não está documentado, então aceita texto ou objeto.
 */
export function missingPermissions(data) {
  const list =
    data?.missing_permissions ??
    data?.error?.missing_permissions ??
    data?.details?.missing_permissions;
  if (!Array.isArray(list)) return [];
  return list
    .map((p) =>
      typeof p === "string"
        ? p
        : (p?.name ?? p?.permission ?? p?.id ?? (p ? JSON.stringify(p) : "")),
    )
    .filter(Boolean)
    .map((p) => String(p).slice(0, 80));
}

/** Mensagens amigáveis para erros da API do Supabase. */
export function describeSupabaseError(err, what, { networkHint = "" } = {}) {
  switch (err?.status) {
    case 401:
      return `${what}: token do Supabase inválido ou expirado (401). Gere um novo Personal Access Token em ${LINKS.supabaseTokens} e exporte SUPABASE_ACCESS_TOKEN.`;
    case 403: {
      const missing = missingPermissions(err.data);
      return `${what}: sem permissão (403).${missing.length ? ` Faltam no token: ${missing.join(", ")}.` : ""} Tokens criados no painel são escopados por padrão: gere outro com as permissões listadas em scripts/deploy/README.md (seção 1), para uma conta Owner/Admin/Developer do projeto.`;
    }
    case 404:
      return `${what}: projeto não encontrado (404). Confira SUPABASE_PROJECT_REF (Project Settings > General > Project ID) e se o token é da conta dona do projeto.`;
    case 429:
      return `${what}: limite de requisições da API do Supabase atingido (429). Espere um minuto e rode de novo (o script pode ser reexecutado).`;
    case 0:
    case undefined:
      return `${what}: falha de rede ao falar com a API do Supabase (${err?.detail ?? err?.message}). Confira sua conexão.${networkHint}`;
    default:
      return `${what}: a API do Supabase respondeu ${err.status}: ${err.detail}`;
  }
}

/** Mensagens amigáveis para erros da API da Vercel. */
export function describeVercelError(err, what, { networkHint = "" } = {}) {
  switch (err?.status) {
    case 401:
      return `${what}: VERCEL_TOKEN inválido ou expirado (401). Crie outro em ${LINKS.vercelTokens}.`;
    case 403:
      return `${what}: sem permissão (403). Se o projeto pertence a um time, defina VERCEL_TEAM_ID (team_... ou o slug do time) e use um token com acesso a ele.`;
    case 404:
      return `${what}: projeto não encontrado na Vercel (404). Importe o repositório em ${LINKS.vercelNew} e/ou defina VERCEL_PROJECT com o nome ou id do projeto.`;
    case 0:
    case undefined:
      return `${what}: falha de rede ao falar com a Vercel (${err?.detail ?? err?.message}).${networkHint}`;
    default:
      return `${what}: a Vercel respondeu ${err.status}: ${err.detail}`;
  }
}

// -----------------------------------------------------------------------------
// Dependências padrão (injetáveis nos testes)
// -----------------------------------------------------------------------------

/**
 * Entrada JS do CLI do Supabase instalado no projeto (devDependency `supabase`; desde a 2.x o `bin` do
 * pacote é um launcher Node, `dist/supabase.js`). null se não estiver instalado.
 */
export function resolveLocalSupabaseCli(rootDir) {
  let pkgFile;
  try {
    pkgFile = createRequire(path.join(rootDir, "package.json")).resolve("supabase/package.json");
  } catch {
    pkgFile = path.join(rootDir, "node_modules", "supabase", "package.json");
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.supabase;
    if (!rel) return null;
    const entry = path.resolve(path.dirname(pkgFile), rel);
    return existsSync(entry) ? entry : null;
  } catch {
    return null;
  }
}

/** Aspas para o cmd.exe (só no fallback do Windows; caminhos com espaço, ex.: C:\Users\Maria Silva). */
function quoteForCmd(arg) {
  const s = String(arg);
  return /^[A-Za-z0-9_\-.:\\/=@]+$/.test(s) ? s : `"${s.replaceAll('"', '""')}"`;
}

/**
 * Como chamar o CLI do Supabase em Windows, macOS e Linux.
 * - Com o CLI instalado no projeto: `node <launcher> ...args`, sem shell (sem problemas de aspas,
 *   sem depender do npx no PATH e sem o erro EINVAL de .cmd sem shell no Node 20+).
 * - Sem ele: `npx supabase ...`; no Windows via cmd.exe com os argumentos já entre aspas.
 */
export function buildCliInvocation(
  args,
  { platform = process.platform, cliEntry = null, execPath = process.execPath } = {},
) {
  if (cliEntry && /\.[cm]?js$/.test(cliEntry)) {
    return { command: execPath, args: [cliEntry, ...args], shell: false };
  }
  if (platform === "win32") {
    return {
      command: ["npx.cmd", "supabase", ...args].map(quoteForCmd).join(" "),
      args: [],
      shell: true,
    };
  }
  return { command: "npx", args: ["supabase", ...args], shell: false };
}

/** Roda o CLI do Supabase repassando a saída em tempo real. Resolve com o código de saída. */
export function defaultRunCli(args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const inv = buildCliInvocation(args, { cliEntry: resolveLocalSupabaseCli(cwd) });
    const child = spawn(inv.command, inv.args, {
      cwd,
      env,
      stdio: "inherit",
      shell: inv.shell,
    });
    child.on("error", (e) =>
      reject(
        new StepError(
          `Não consegui executar o CLI do Supabase (${e.message}). Rode "npm install" na raiz do repositório ou use --migrations-via-api.`,
        ),
      ),
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** true/false segundo `git check-ignore`; null se o git não estiver disponível. */
export function defaultIsGitIgnored(rootDir, relPath) {
  const result = spawnSync("git", ["check-ignore", "-q", "--", relPath], { cwd: rootDir });
  if (result.error || (result.status !== 0 && result.status !== 1)) return null;
  return result.status === 0;
}

function defaultDeps() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  return {
    rootDir,
    env: process.env,
    fetch: globalThis.fetch,
    runCli: defaultRunCli,
    readText: (file) => readFile(file, "utf8"),
    writeText: async (file, content) => {
      await writeFile(file, content, { encoding: "utf8", mode: 0o600 });
      await chmod(file, 0o600);
    },
    fileExists: async (file) => {
      try {
        await stat(file);
        return true;
      } catch {
        return false;
      }
    },
    listDir: (dir) => readdir(dir),
    withTempFile: async (name, content, fn) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "supabase-setup-"));
      const file = path.join(dir, name);
      try {
        await writeFile(file, content, { encoding: "utf8", mode: 0o600 });
        return await fn(file);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    isGitIgnored: (relPath) => defaultIsGitIgnored(rootDir, relPath),
    gitRepoName: () => {
      const r = spawnSync("git", ["remote", "get-url", "origin"], {
        cwd: rootDir,
        encoding: "utf8",
      });
      return r.status === 0 ? repoNameFromRemoteUrl(r.stdout) : null;
    },
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  };
}

// -----------------------------------------------------------------------------
// Programa principal
// -----------------------------------------------------------------------------

const HELP = `Configura o Supabase Cloud (e, opcionalmente, a Vercel) para este app.

Uso:
  node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app [opções]

Variáveis obrigatórias (exceto na simulação):
  SUPABASE_ACCESS_TOKEN   Personal Access Token (${LINKS.supabaseTokens})
  SUPABASE_PROJECT_REF    ref do projeto (20 letras; Project Settings > General)
  SUPABASE_DB_PASSWORD    senha do banco definida ao criar o projeto (dispensável com --migrations-via-api)

O token precisa das permissões listadas em scripts/deploy/README.md (tokens escopados).

Opções:
  --site-url=<https://...>  URL pública do site (obrigatória)
  --dry-run                 simula: nada é alterado (com token, só faz leituras)
  --write-env[=<arquivo>]   grava as variáveis num .env* ignorado pelo git (padrão ${DEFAULT_ENV_FILE})
  --vercel                  cadastra as variáveis na Vercel (VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT)
  --redirect-url=<url>      Redirect URL extra (repetível), ex.: https://*-sua-conta.vercel.app/**
  --migrations-via-api      aplica as migrations por HTTPS em vez de "supabase db push" (rede sem acesso
                            TCP ao Postgres, ex.: sessão na nuvem atrás de proxy)
  --with-demo-seed          aplica o seed.sql inteiro (contas fictícias, senha pública) — nunca em produção
  --auto-confirm-email      contas novas entram sem confirmar o e-mail (demo sem SMTP próprio: o SMTP
                            padrão do Supabase só entrega para o time do projeto)
  --help                    esta ajuda

Guia completo: scripts/deploy/README.md`;

/**
 * Executa o fluxo completo. Devolve o código de saída (0 = sucesso).
 * @param {string[]} argv
 * @param {Partial<ReturnType<typeof defaultDeps>>} overrides
 */
export async function main(argv = process.argv.slice(2), overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const { rootDir, env } = deps;
  const redact = createRedactor();
  const out = (line = "") => deps.stdout(redact(line));
  const err = (line = "") => deps.stderr(redact(line));

  const args = parseArgs(argv);
  if (args.help) {
    out(HELP);
    return 0;
  }

  let packageName = "";
  try {
    packageName = JSON.parse(await deps.readText(path.join(rootDir, "package.json"))).name ?? "";
  } catch {
    // sem package.json legível: VERCEL_PROJECT passa a ser necessário para --vercel
  }

  const { errors, warnings, config } = buildConfig(args, env, { packageName });
  redact.add(config.token, config.dbPassword, config.vercelToken, config.smtp?.pass);
  for (const { key } of OPTIONAL_PASSTHROUGH_VARS) redact.add(env[key]);
  redact.add(env.CRON_SECRET);

  if (errors.length) {
    err("Não dá para continuar:");
    for (const e of errors) err(`  - ${e}`);
    err("");
    err("Ajuda: node scripts/deploy/setup-supabase-cloud.mjs --help");
    return 2;
  }

  const offline = config.dryRun && (!config.hasToken || config.refIsPlaceholder);
  const networkHint =
    (env.HTTPS_PROXY || env.https_proxy) && env.NODE_USE_ENV_PROXY !== "1"
      ? " Há HTTPS_PROXY no ambiente: rode com NODE_USE_ENV_PROXY=1 (Node 22.21+) para o fetch do Node usar o proxy."
      : "";
  const supaErr = (e, what) => describeSupabaseError(e, what, { networkHint });
  const vercelErr = (e, what) => describeVercelError(e, what, { networkHint });
  const done = [];
  const pending = [];
  let failed = false;

  // ---------------------------------------------------------------- arquivos locais
  // Tudo o que vem do repositório é lido e validado ANTES de qualquer chamada remota.
  let local;
  try {
    local = await loadLocalInputs(deps, config);
  } catch (e) {
    err(`Erro ao ler os arquivos do repositório: ${e.message}`);
    return 1;
  }

  // ---------------------------------------------------------------- plano
  out("Configuração do Supabase Cloud");
  out("==============================");
  out(
    config.dryRun
      ? `Modo: SIMULAÇÃO (--dry-run) — nada será alterado${offline ? " e nenhuma chamada de rede será feita" : "; só leituras (GET e SQL somente leitura) para conferir o acesso"}.`
      : "Modo: PARA VALER — o projeto do Supabase será alterado.",
  );
  out(
    `Projeto: ${config.ref}${config.refIsPlaceholder ? " (placeholder)" : ""} — ${config.supabaseUrl}`,
  );
  out(`Site: ${config.siteUrl}`);
  out(`Token: ${config.hasToken ? maskSecret(config.token) : "(ausente)"}`);
  for (const w of warnings) out(`AVISO: ${w}`);
  if (config.withDemoSeed) {
    out("");
    out("!!! ATENÇÃO: --with-demo-seed aplica contas FICTÍCIAS com senha PÚBLICA no projeto. !!!");
    out("!!! Use somente num projeto de DEMONSTRAÇÃO. Nunca num site aberto ao público.      !!!");
  }
  out("");
  out("Plano:");
  out("  1. Conferir o projeto (acesso, região e status) na API de gerenciamento");
  out(
    config.migrationsViaApi
      ? `  2. Aplicar as migrations pendentes por HTTPS (${local.migrations.length} no repositório), registrando no histórico do CLI`
      : "  2. Ligar o CLI ao projeto e aplicar as migrations (supabase link + supabase db push)",
  );
  out(
    config.withDemoSeed
      ? "  3. Aplicar o seed.sql INTEIRO (referência + DEMONSTRAÇÃO fictícia)"
      : `  3. Aplicar os dados de referência do seed.sql (${local.seed.counts.areas} áreas de pesquisa, ${local.seed.counts.categories} categorias do fórum)`,
  );
  out(
    `  4. Configurar o Auth: site_url, Redirect URLs, confirmação de e-mail, senha mínima ${local.passwordMinLength}, ${EMAIL_TEMPLATE_TYPES.length} modelos de e-mail${config.smtp ? ", SMTP próprio" : ""}`,
  );
  out(`  5. Conferir o bucket "${STORAGE_BUCKET}"`);
  out("  6. Obter as chaves da API (publishable/secret)");
  out(
    `  7. ${config.writeEnv ? `Gravar as variáveis em ${local.envFile.rel}` : "Arquivo de variáveis: pulado (use --write-env para gravar)"}`,
  );
  out(
    `  8. ${config.vercel ? (config.vercelToken ? `Cadastrar as variáveis no projeto "${config.vercelProject}" da Vercel` : "Vercel: imprimir a lista para cadastro manual (sem VERCEL_TOKEN)") : "Vercel: pulado (use --vercel)"}`,
  );
  out("  9. Checklist final");

  const request = createRequester({ fetchImpl: deps.fetch, sleep: deps.sleep });
  const supabase = createSupabaseApi({ request, token: config.token, ref: config.ref });

  const step = (n, title) => {
    out("");
    out(`[${n}/9] ${title}`);
  };

  const state = {
    project: null,
    keys: { publishable: null, secret: null, source: null },
    appEnv: null,
    cronSecret: null,
    envWritten: false,
    vercelDone: false,
    demoApplied: false,
  };

  try {
    // ------------------------------------------------------------ 1. projeto
    step(1, "Projeto");
    if (offline) {
      out("  (simulação offline) GET /v1/projects/{ref} seria chamado aqui.");
    } else {
      let project;
      try {
        ({ data: project } = await supabase.getProject());
      } catch (e) {
        throw new StepError(supaErr(e, "Não consegui acessar o projeto"));
      }
      state.project = project;
      out(
        `  Nome: ${project?.name ?? "?"} | região: ${project?.region ?? "?"} | status: ${project?.status ?? "?"}`,
      );
      if (project?.database?.version) out(`  Postgres: ${project.database.version}`);
      if (project?.region && project.region !== "sa-east-1") {
        out(
          "  Obs.: a região não é São Paulo (sa-east-1); funciona, só com mais latência para o Brasil.",
        );
      }
      const status = project?.status;
      if (status === "INACTIVE" || status === "PAUSING") {
        throw new StepError(
          `O projeto está pausado (${status}). Restaure-o em ${LINKS.supabaseDashboard}/${config.ref} e rode o script de novo.`,
        );
      }
      if (
        ["COMING_UP", "RESTORING", "RESTARTING", "UPGRADING", "RESIZING", "GOING_DOWN"].includes(
          status,
        )
      ) {
        throw new StepError(
          `O projeto ainda está em ${status}. Espere ficar "Healthy" no painel e rode de novo.`,
        );
      }
      if (["INIT_FAILED", "RESTORE_FAILED", "PAUSE_FAILED", "REMOVED"].includes(status)) {
        throw new StepError(
          `O projeto está em ${status}; resolva no painel do Supabase antes de continuar.`,
        );
      }
      if (status && status !== "ACTIVE_HEALTHY")
        out(`  AVISO: status ${status}; seguindo mesmo assim.`);
      done.push(
        `Projeto conferido: ${project?.name ?? config.ref} (${project?.region ?? "região ?"})`,
      );
    }

    // ------------------------------------------------------------ 2. migrations
    const cliEnv = {
      ...env,
      SUPABASE_ACCESS_TOKEN: config.token,
      SUPABASE_DB_PASSWORD: config.dbPassword,
    };

    // Aplica SQL pela API; se o endpoint (beta) sumir, usa `supabase db query --linked`
    // (só quando o CLI foi ligado ao projeto, isto é, fora do modo --migrations-via-api).
    const applySql = async (sql, label, { idempotent }) => {
      try {
        await supabase.runQuery(sql, { idempotent });
        return;
      } catch (e) {
        if (config.migrationsViaApi || ![404, 405, 410].includes(e?.status)) {
          throw new StepError(supaErr(e, `Falha ao aplicar ${label}`));
        }
      }
      out(
        "  O endpoint /database/query não respondeu; tentando pelo CLI (supabase db query --linked)...",
      );
      const code = await deps.withTempFile("query.sql", sql, (file) =>
        deps.runCli(["db", "query", "--linked", "--file", file], { cwd: rootDir, env: cliEnv }),
      );
      if (code !== 0) throw new StepError(`Falha ao aplicar ${label} pelo CLI (código ${code}).`);
    };
    // Na simulação, SELECTs vão pelo endpoint somente leitura.
    const selectRows = async (sql) => {
      const { data } = config.dryRun
        ? await supabase.runReadOnlyQuery(sql)
        : await supabase.runQuery(sql, { idempotent: true });
      return Array.isArray(data) ? data : [];
    };

    if (config.migrationsViaApi) {
      step(2, "Migrations (por HTTPS, sem o CLI)");
      let applied = [];
      if (offline) {
        out(
          `  (simulação offline) ${local.migrations.length} migrations locais; seriam aplicadas as que faltam no histórico do banco.`,
        );
      } else {
        try {
          const [row] = await selectRows(MIGRATION_HISTORY_EXISTS_SQL);
          if (row?.present === true || row?.present === "t") {
            applied = (await selectRows(MIGRATION_HISTORY_SQL)).map((r) => String(r.version));
          }
        } catch (e) {
          if (!config.dryRun) {
            throw new StepError(supaErr(e, "Não consegui ler o histórico de migrations"));
          }
          out(`  AVISO (simulação): ${supaErr(e, "histórico de migrations não lido")}`);
        }
        const plan = planMigrations(
          local.migrations.map((m) => m.file),
          applied,
        );
        if (plan.error) throw new StepError(plan.error);
        out(`  Já aplicadas: ${applied.length}. Pendentes: ${plan.pending.length}.`);
        for (const m of plan.pending) {
          const content = local.migrations.find((x) => x.file === m.file).content;
          const query = buildMigrationQuery(content, m);
          if (config.dryRun) {
            out(`  (simulação) ${m.file} (${Buffer.byteLength(content)} bytes)`);
            continue;
          }
          out(`  Aplicando ${m.file}...`);
          try {
            await supabase.runQuery(query, { idempotent: false });
          } catch (e) {
            // 4xx: o Postgres recusou e a transação foi desfeita. Sem resposta (rede/timeout) ou 5xx:
            // não dá para saber; como a migration e o registro no histórico vão juntos, rodar de
            // novo é seguro (o histórico diz se ela entrou).
            const certain = e?.status >= 400 && e?.status < 500;
            throw new StepError(
              `${supaErr(e, `Falha na migration ${m.file}`)} ${
                certain
                  ? "Nada desta migration ficou aplicado (transação desfeita); corrija e rode de novo."
                  : "Sem confirmação da API: ela pode ter sido aplicada ou não (migration e histórico vão juntos, na mesma transação). Rode o script de novo: ele relê o histórico e só aplica o que falta."
              }`,
            );
          }
        }
        if (!config.dryRun) {
          done.push(
            `Migrations aplicadas por HTTPS (${plan.pending.length} novas, ${applied.length} já existiam)`,
          );
        }
      }
    } else {
      step(2, "Migrations (CLI do Supabase)");
      const linkArgs = ["link", "--project-ref", config.ref];
      const pushArgs = ["db", "push", "--linked", "--yes"];
      out(`  $ npx supabase ${linkArgs.join(" ")}`);
      out(`  $ npx supabase ${pushArgs.join(" ")}`);
      out(
        "    (SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD vão pelo ambiente, não pela linha de comando)",
      );
      const tcpHint =
        " Se o erro foi de conexão com o banco (rede que só libera HTTPS), rode de novo com --migrations-via-api.";
      if (config.dryRun) {
        out("  (simulação) comandos não executados.");
      } else {
        const linkCode = await deps.runCli(linkArgs, { cwd: rootDir, env: cliEnv });
        if (linkCode !== 0) {
          throw new StepError(
            `"supabase link" falhou (código ${linkCode}). Confira o token, o ref e a senha do banco (Project Settings > Database > Reset password, se precisar).${tcpHint}`,
          );
        }
        const pushCode = await deps.runCli(pushArgs, { cwd: rootDir, env: cliEnv });
        if (pushCode !== 0) {
          throw new StepError(
            `"supabase db push" falhou (código ${pushCode}). Leia a saída acima; se o banco remoto já tiver migrations fora do histórico, veja "supabase migration list".${tcpHint}`,
          );
        }
        done.push("Migrations aplicadas (supabase db push)");
      }
    }

    // ------------------------------------------------------------ 3. dados
    step(3, config.withDemoSeed ? "Seed completo (DEMONSTRAÇÃO)" : "Dados de referência");
    if (config.dryRun) {
      out(
        `  (simulação) seria aplicado via POST /v1/projects/{ref}/database/query: ${local.seed.counts.areas} áreas + ${local.seed.counts.categories} categorias (${Buffer.byteLength(local.seed.referenceSql)} bytes, todos os INSERTs com ON CONFLICT).`,
      );
      if (config.withDemoSeed) {
        out(
          `  (simulação) e o seed.sql inteiro (${Buffer.byteLength(local.seedSql)} bytes), se o usuário de demonstração ${local.seed.demoMarkerUserId} ainda não existir.`,
        );
      }
    } else {
      await applySql(local.seed.referenceSql, "os dados de referência", { idempotent: true });
      if (config.withDemoSeed) {
        out("  !!! Aplicando o seed de DEMONSTRAÇÃO (contas fictícias, senha pública). !!!");
        let present = false;
        if (local.seed.demoMarkerUserId) {
          try {
            const rows = await selectRows(
              `select exists(select 1 from auth.users where id = '${local.seed.demoMarkerUserId}') as present;`,
            );
            present = rows[0]?.present === true || rows[0]?.present === "t";
          } catch (e) {
            throw new StepError(
              describeSupabaseError(
                e,
                "Não consegui verificar se o seed de demonstração já existe",
              ),
            );
          }
        }
        if (present) {
          out(
            "  O seed de demonstração já estava aplicado; nada a fazer (ele não pode ser reaplicado).",
          );
        } else {
          await applySql(local.seedSql, "o seed de demonstração", { idempotent: false });
          state.demoApplied = true;
          done.push("Seed de DEMONSTRAÇÃO aplicado (contas fictícias)");
        }
      }
      try {
        const [row] = await selectRows(
          "select (select count(*) from public.research_areas)::int as areas, (select count(*) from public.forum_categories)::int as categories;",
        );
        const areas = Number(row?.areas);
        const categories = Number(row?.categories);
        out(`  No banco: ${areas} áreas de pesquisa, ${categories} categorias do fórum.`);
        if (areas < local.seed.counts.areas || categories < local.seed.counts.categories) {
          out("  AVISO: menos linhas do que o esperado; confira o SQL Editor.");
        }
      } catch {
        out("  (não consegui contar as linhas para conferir; siga adiante)");
      }
      done.push(
        `Dados de referência aplicados (${local.seed.counts.areas} áreas, ${local.seed.counts.categories} categorias)`,
      );
    }

    // ------------------------------------------------------------ 4. auth
    step(4, "Auth");
    let currentAllowList = "";
    if (!offline) {
      try {
        const { data } = await supabase.getAuthConfig();
        currentAllowList = data?.uri_allow_list ?? "";
        out(`  site_url atual: ${data?.site_url ?? "(vazio)"}`);
        out(`  Redirect URLs atuais: ${currentAllowList || "(nenhuma)"}`);
      } catch (e) {
        throw new StepError(supaErr(e, "Não consegui ler a configuração do Auth"));
      }
    }
    const authPayload = buildAuthConfigPayload({
      siteUrl: config.siteUrl,
      currentAllowList,
      extraRedirectUrls: config.redirectUrls,
      templates: local.templates,
      passwordMinLength: local.passwordMinLength,
      smtp: config.smtp,
      autoConfirmEmail: config.autoConfirmEmail,
    });
    out(
      `  PATCH /v1/projects/{ref}/config/auth${config.dryRun ? " (simulação, não enviado)" : ""}:`,
    );
    for (const line of summarizeAuthPayload(authPayload)) out(`    ${line}`);
    if (!config.dryRun) {
      try {
        const { data } = await supabase.updateAuthConfig(authPayload);
        if (data?.site_url && data.site_url !== config.siteUrl) {
          out(`  AVISO: a API devolveu site_url=${data.site_url}; confira no painel.`);
        }
      } catch (e) {
        throw new StepError(supaErr(e, "Não consegui atualizar o Auth"));
      }
      done.push(
        `Auth configurado: site_url, Redirect URLs, confirmação de e-mail ligada, senha mínima ${authPayload.password_min_length}, ${EMAIL_TEMPLATE_TYPES.length} modelos pt-BR${config.smtp ? ", SMTP próprio" : ""}`,
      );
    }

    // ------------------------------------------------------------ 5. storage
    step(5, `Bucket "${STORAGE_BUCKET}"`);
    if (offline) {
      out("  (simulação offline) GET /v1/projects/{ref}/storage/buckets seria chamado aqui.");
    } else {
      let bucket = null;
      try {
        const { data } = await supabase.listBuckets();
        bucket = (Array.isArray(data) ? data : []).find(
          (b) => b?.id === STORAGE_BUCKET || b?.name === STORAGE_BUCKET,
        );
      } catch (e) {
        throw new StepError(supaErr(e, "Não consegui listar os buckets"));
      }
      if (bucket) {
        out(`  OK: bucket existe (público: ${bucket.public ? "sim" : "não"}).`);
        if (!bucket.public)
          out("  AVISO: o app espera o bucket público (leitura pela URL pública).");
        done.push(`Bucket "${STORAGE_BUCKET}" conferido`);
      } else if (config.dryRun) {
        out(
          "  Ainda não existe; a migration de storage cria o bucket quando as migrations forem aplicadas.",
        );
      } else if (local.bucketInsert) {
        out("  Não encontrado; aplicando o INSERT da migration de storage...");
        await applySql(local.bucketInsert, `o bucket ${STORAGE_BUCKET}`, { idempotent: true });
        done.push(`Bucket "${STORAGE_BUCKET}" criado`);
      } else {
        out(
          "  AVISO: bucket não encontrado e não achei o INSERT nas migrations. Crie-o em Storage no painel.",
        );
        pending.push(`Criar o bucket público "${STORAGE_BUCKET}" (Storage no painel)`);
      }
    }

    // ------------------------------------------------------------ 6. chaves
    step(6, "Chaves da API");
    if (offline) {
      out("  (simulação offline) GET /v1/projects/{ref}/api-keys?reveal=true seria chamado aqui.");
    } else {
      let keys;
      try {
        ({ data: keys } = await supabase.getApiKeys({ reveal: !config.dryRun }));
      } catch (e) {
        throw new StepError(supaErr(e, "Não consegui ler as chaves da API"));
      }
      let picked = pickApiKeys(keys, { requireRevealed: !config.dryRun });
      const missing = [!picked.publishable && "publishable", !picked.secret && "secret"].filter(
        Boolean,
      );
      if (missing.length && config.dryRun) {
        out(
          `  (simulação) faltam chaves ${missing.join(" e ")}; seriam criadas via POST /v1/projects/{ref}/api-keys.`,
        );
      } else if (missing.length) {
        for (const type of missing) {
          try {
            const { data } = await supabase.createApiKey(
              type,
              type === "publishable" ? "app_publishable" : "app_secret",
            );
            if (data?.api_key) {
              redact.add(data.api_key);
              picked = { ...picked, [type]: data.api_key };
              out(`  Chave ${type} criada.`);
            }
          } catch (e) {
            out(`  AVISO: ${supaErr(e, `não consegui criar a chave ${type}`)}`);
          }
        }
      }
      redact.add(picked.publishable, picked.secret, picked.legacyAnon, picked.legacyServiceRole);
      const publishable = picked.publishable ?? picked.legacyAnon;
      const secret = picked.secret ?? picked.legacyServiceRole;
      state.keys = {
        publishable,
        secret,
        source: picked.publishable && picked.secret ? "novas" : "legadas (anon/service_role)",
      };
      out(`  Publishable: ${publishable ? maskSecret(publishable) : "(não encontrada)"}`);
      out(`  Secret: ${secret ? maskSecret(secret) : "(não encontrada)"}`);
      if (!config.dryRun) {
        if (!publishable || !secret) {
          throw new StepError(
            "Não encontrei chaves da API. Crie uma publishable e uma secret em Project Settings > API Keys e rode de novo.",
          );
        }
        if (!(picked.publishable && picked.secret)) {
          out(
            "  AVISO: usando chaves legadas; o Supabase vai desativá-las até o fim de 2026. Crie chaves novas no painel.",
          );
        }
        done.push(`Chaves da API obtidas (${state.keys.source})`);
      }
    }

    // ------------------------------------------------------------ 7. arquivo .env
    step(7, "Variáveis do app");
    const existingEnvText =
      local.envFile && (await deps.fileExists(local.envFile.abs))
        ? await deps.readText(local.envFile.abs)
        : "";
    const cron = resolveCronSecret(env, parseEnvText(existingEnvText), deps.randomHex);
    redact.add(cron.value);
    state.cronSecret = cron;
    state.appEnv = {
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        state.keys.publishable ?? "sb_publishable_(obtida_na_execucao_real)",
      SUPABASE_SECRET_KEY: state.keys.secret ?? "sb_secret_(obtida_na_execucao_real)",
      NEXT_PUBLIC_SITE_URL: config.siteUrl,
      CRON_SECRET: cron.value,
    };
    for (const [key, value] of Object.entries(state.appEnv)) {
      const shown =
        key === "NEXT_PUBLIC_SUPABASE_URL" || key === "NEXT_PUBLIC_SITE_URL"
          ? value
          : maskSecret(value);
      out(`  ${key}=${shown}`);
    }
    out(
      `  (CRON_SECRET: ${cron.source === "gerado" ? "novo, 32 bytes aleatórios" : `reaproveitado do ${cron.source}`})`,
    );
    if (config.writeEnv) {
      if (local.envFile.autoloadedByNext) {
        out(
          `  AVISO: o Next.js carrega ${local.envFile.base} sozinho; builds locais (ex.: next build/E2E) passarão a usar o Supabase Cloud. Prefira ${DEFAULT_ENV_FILE}.`,
        );
      }
      if (config.dryRun) {
        out(`  (simulação) ${local.envFile.rel} não foi gravado.`);
      } else {
        await deps.writeText(
          local.envFile.abs,
          buildEnvFile(state.appEnv, existingEnvText, { generatedAt: deps.now() }),
        );
        state.envWritten = true;
        out(`  Gravado em ${local.envFile.rel} (permissão 600, ignorado pelo git).`);
        done.push(`Variáveis gravadas em ${local.envFile.rel}`);
      }
    } else if (!config.dryRun && cron.source === "gerado") {
      out(
        "  AVISO: o CRON_SECRET gerado não foi salvo em lugar nenhum; use --write-env para guardá-lo.",
      );
    }

    // ------------------------------------------------------------ 8. vercel
    step(8, "Vercel");
    const vercelVars = buildVercelEnvVars(state.appEnv, env);
    // Só segredos entram no redator (URLs públicas continuam legíveis na saída).
    for (const v of vercelVars) if (v.type === "sensitive") redact.add(v.value);
    if (config.vercel && config.vercelToken) {
      if (!config.vercelProject) {
        throw new StepError("Defina VERCEL_PROJECT com o nome ou id do projeto na Vercel.");
      }
      const vercel = createVercelApi({
        request,
        token: config.vercelToken,
        team: config.vercelTeam,
      });
      // Sem VERCEL_PROJECT: tenta o nome do package.json e, se não existir (404), o nome do
      // repositório, que é o que a Vercel sugere ao importar do GitHub.
      const candidates = [
        ...new Set(
          [
            config.vercelProject,
            ...(config.vercelProjectExplicit ? [] : [deps.gitRepoName?.() ?? null]),
          ].filter(Boolean),
        ),
      ];
      let vercelProject = null;
      let lastError = null;
      for (const name of candidates) {
        try {
          const { data } = await vercel.getProject(name);
          vercelProject = name;
          out(`  Projeto Vercel: ${data?.name ?? name} (${data?.id ?? "?"})`);
          break;
        } catch (e) {
          lastError = e;
          if (e?.status !== 404) break;
        }
      }
      if (!vercelProject) {
        throw new StepError(
          `${vercelErr(lastError, "Não consegui acessar o projeto na Vercel")} (tentei: ${candidates.join(", ")})`,
        );
      }
      out(
        `  POST /v10/projects/{idOrName}/env?upsert=true${config.dryRun ? " (simulação, não enviado)" : ""}:`,
      );
      for (const v of vercelVars) {
        out(
          `    ${v.key} [${v.type === "sensitive" ? "Secret" : "Config"}; ${v.target.join(", ")}] = ${v.type === "sensitive" || v.key.includes("KEY") ? maskSecret(v.value) : v.value}`,
        );
      }
      if (!config.dryRun) {
        let result;
        try {
          ({ data: result } = await vercel.upsertEnv(vercelProject, vercelVars));
        } catch (e) {
          throw new StepError(vercelErr(e, "Não consegui gravar as variáveis na Vercel"));
        }
        const failures = Array.isArray(result?.failed) ? result.failed : [];
        if (failures.length) {
          for (const f of failures) {
            const key = f?.error?.key ?? f?.error?.envVarKey ?? "?";
            out(`  ERRO em ${key}: ${f?.error?.code ?? ""} ${f?.error?.message ?? ""}`.trimEnd());
          }
          throw new StepError(
            `${failures.length} variável(is) não foram gravadas na Vercel (veja acima).`,
          );
        }
        state.vercelDone = true;
        done.push(`Variáveis cadastradas na Vercel (${vercelVars.length}, produção e preview)`);
        out(
          "  Para publicar com as variáveis novas, faça um novo deploy (as NEXT_PUBLIC_* entram no build):",
        );
        out("    - Vercel > projeto > Deployments > ... no último deploy > Redeploy; ou");
        out("    - git push na branch de produção; ou");
        out('    - npx vercel deploy --prod --token "$VERCEL_TOKEN"');
      }
    } else {
      out(
        config.vercel
          ? "  Sem VERCEL_TOKEN: cadastre à mão (Settings > Environment Variables):"
          : "  Pulado. Para cadastrar à mão (Settings > Environment Variables):",
      );
      for (const v of vercelVars) {
        out(`    ${v.key} [${v.type === "sensitive" ? "Secret" : "Config"}; Production e Preview]`);
      }
      if (state.envWritten) out(`  Os valores estão em ${local.envFile.rel}.`);
      pending.push("Cadastrar as variáveis na Vercel (lista acima) e fazer um novo deploy");
    }
  } catch (e) {
    failed = true;
    pending.unshift(
      "Corrigir o erro indicado e rodar o script de novo (os passos já feitos são refeitos sem duplicar nada)",
    );
    err("");
    err(`ERRO: ${e instanceof StepError ? e.message : (e?.stack ?? e)}`);
    err("O script pode ser rodado de novo com segurança: os passos são idempotentes.");
  }

  // ---------------------------------------------------------------- 9. checklist
  step(9, "Checklist");
  if (config.dryRun) {
    out(
      failed
        ? "  Simulação interrompida pelo erro acima (nada foi alterado). Corrija e simule de novo antes de rodar para valer."
        : "  Simulação concluída: nada foi alterado. Rode sem --dry-run para aplicar.",
    );
  }
  if (done.length) {
    out("  Feito:");
    for (const d of done) out(`    [x] ${d}`);
  }
  out("  Falta:");
  for (const p of pending) out(`    [ ] ${p}`);
  if (!config.smtp) {
    out(
      "    [ ] SMTP próprio (Authentication > Emails > SMTP Settings ou SMTP_* neste script): sem ele o Supabase só entrega e-mails para membros do time do projeto (cerca de 2 por hora) — pessoas de fora não recebem a confirmação de cadastro.",
    );
  }
  out("    [ ] Primeira administradora: crie sua conta no site e rode no SQL Editor:");
  out("          update public.profiles set role = 'admin'");
  out("          where id = (select id from auth.users where email = 'voce@exemplo.com');");
  out(
    "    [ ] (Opcional) Previews da Vercel: rode de novo com --redirect-url=https://*-<sua-conta>.vercel.app/**",
  );
  out(
    `    [ ] (Opcional) Google: Authentication > Sign In / Providers > Google (Client ID/Secret) e callback https://${config.ref}.supabase.co/auth/v1/callback no Google Cloud; depois NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true na Vercel.`,
  );
  out(
    "    [ ] (Opcional) Resend com domínio verificado para o Boletim chegar a todas as inscritas (RESEND_API_KEY e NEWSLETTER_FROM).",
  );
  out("    [ ] Rodar Advisors > Security e Performance no painel do Supabase.");
  if (config.withDemoSeed || state.demoApplied) {
    out(
      "    [ ] Este projeto tem contas de DEMONSTRAÇÃO com senha pública: não divulgue como produção.",
    );
  }

  if (failed) return 1;
  return 0;
}

class StepError extends Error {}

/** Lê e valida tudo o que vem do repositório (config.toml, modelos, seed, migration de storage). */
async function loadLocalInputs(deps, config) {
  const { rootDir } = deps;
  const supabaseDir = path.join(rootDir, "supabase");

  const toml = await deps.readText(path.join(supabaseDir, "config.toml"));
  const authEmail = parseAuthEmailConfig(toml);
  if (authEmail.missing.length) {
    throw new Error(
      `config.toml sem subject/content_path para: ${authEmail.missing.join(", ")} ([auth.email.template.<tipo>]).`,
    );
  }
  const templates = {};
  for (const type of EMAIL_TEMPLATE_TYPES) {
    const { subject, contentPath } = authEmail.templates[type];
    let content = null;
    for (const candidate of templatePathCandidates(rootDir, contentPath)) {
      if (await deps.fileExists(candidate)) {
        content = await deps.readText(candidate);
        break;
      }
    }
    if (!content?.trim())
      throw new Error(`Modelo de e-mail não encontrado ou vazio: ${contentPath}`);
    templates[type] = { subject, content };
  }

  const seedSql = await deps.readText(path.join(supabaseDir, "seed.sql"));
  const seed = extractSeedSections(seedSql);

  const migrationsDir = path.join(supabaseDir, "migrations");
  const migrations = [];
  for (const file of (await deps.listDir(migrationsDir)).sort()) {
    if (!parseMigrationFileName(file)) continue;
    migrations.push({ file, content: await deps.readText(path.join(migrationsDir, file)) });
  }
  if (!migrations.length) throw new Error("Nenhuma migration encontrada em supabase/migrations.");
  if (config.migrationsViaApi) {
    // Valida já (antes de qualquer chamada remota) que todas podem ir por HTTPS.
    for (const m of migrations) buildMigrationQuery(m.content, parseMigrationFileName(m.file));
  }
  let bucketInsert = null;
  for (const m of migrations) {
    bucketInsert = extractBucketInsert(m.content);
    if (bucketInsert) break;
  }

  let envFile = null;
  if (config.writeEnv) {
    envFile = resolveEnvFilePath(rootDir, config.writeEnv);
    const ignored = deps.isGitIgnored(envFile.rel);
    if (ignored === false) {
      throw new Error(
        `${envFile.rel} NÃO está no .gitignore; escolha outro nome (ex.: ${DEFAULT_ENV_FILE}).`,
      );
    }
  }

  return {
    migrations,
    templates,
    passwordMinLength: authEmail.passwordMinLength,
    seedSql,
    seed,
    bucketInsert,
    envFile,
  };
}

// `import.meta.main` (Node 22.18+/24.2+) é o jeito confiável. No Node mais antigo, compara caminhos
// reais: o Node resolve symlinks do script principal (pasta via symlink, /tmp no macOS) e no Windows a
// letra do drive pode vir em caixa diferente; sem isso o script terminaria em silêncio sem fazer nada.
const isEntryPoint = (() => {
  if (typeof import.meta.main === "boolean") return import.meta.main;
  try {
    if (!process.argv[1]) return false;
    const a = realpathSync(path.resolve(process.argv[1]));
    const b = realpathSync(fileURLToPath(import.meta.url));
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
})();

if (isEntryPoint) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}
