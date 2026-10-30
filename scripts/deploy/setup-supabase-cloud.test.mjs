// Testes do script de deploy do Supabase Cloud.
// Rodar: node --test scripts/deploy/*.test.mjs
// (O vitest.config.ts do app só inclui src/**; aqui usamos o node:test embutido no Node 22.)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EMAIL_TEMPLATE_TYPES,
  HttpError,
  assertIdempotentInserts,
  buildAuthConfigPayload,
  buildConfig,
  buildEnvFile,
  buildVercelEnvVars,
  createRedactor,
  createRequester,
  extractBucketInsert,
  extractSeedSections,
  formatEnvValue,
  looksRevealed,
  main,
  maskSecret,
  mergeAllowList,
  normalizeProjectRef,
  normalizeSiteUrl,
  parseArgs,
  parseAuthEmailConfig,
  parseEnvText,
  parseTomlSections,
  parseTomlValue,
  pickApiKeys,
  resolveCronSecret,
  resolveEnvFilePath,
  summarizeAuthPayload,
  withoutEmailTemplates,
  isEmailTemplateRefusal,
  templatePathCandidates,
  validateRedirectUrl,
  vercelTeamQuery,
  buildMigrationQuery,
  dollarQuote,
  parseMigrationFileName,
  planMigrations,
  MIGRATION_HISTORY_EXISTS_SQL,
  MIGRATION_HISTORY_SQL,
  buildCliInvocation,
  describeSupabaseError,
  missingPermissions,
  resolveLocalSupabaseCli,
  repoNameFromRemoteUrl,
  DEMO_ACCOUNTS_SQL,
  DEMO_EMAIL_DOMAIN,
  DEMO_STAFF_ACCOUNTS,
  DEMO_STAFF_SESSIONS_SQL,
  LOCAL_ONLY_ENV_KEYS,
  assertSafeDemoPassword,
  buildDemoPasswordRotationQuery,
  defaultRandomToken,
  demoStaffEnvValues,
  planDemoPasswordRotation,
} from "./setup-supabase-cloud.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepo = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// Valores falsos, mas com o formato dos reais.
const REF = "abcdefghijklmnopqrst";
// Montados em tempo de execução para nenhum literal parecer um token real (secret scanning do GitHub).
const fake = (...parts) => parts.join("");
const TOKEN = fake("sb", "p_", "FAKE0test0only0", "x".repeat(25));
const DB_PASSWORD = "senha-super-secreta-do-banco-123";
const PUBLISHABLE = fake("sb_", "publishable_", "FAKE0test0only0", "p".repeat(16));
const SECRET = fake("sb_", "secret_", "FAKE0test0only0", "s".repeat(16));
const LEGACY_ANON = fake("ey", "J", "FAKE0legacy0anon0", "a".repeat(20));
const LEGACY_SERVICE = fake("ey", "J", "FAKE0legacy0service0", "r".repeat(20));
const VERCEL_TOKEN = fake("FAKE0vercel0token0", "v".repeat(16));
const GEMINI = fake("FAKE0gemini0key0", "g".repeat(16));
const CRON = "c".repeat(64);
const SITE = "https://artemis.vercel.app";

const SECRETS = [TOKEN, DB_PASSWORD, SECRET, PUBLISHABLE, VERCEL_TOKEN, GEMINI, CRON];

const REVEALED_KEYS = [
  { name: "anon", type: "legacy", api_key: LEGACY_ANON },
  { name: "service_role", type: "legacy", api_key: LEGACY_SERVICE },
  { name: "default", type: "publishable", api_key: PUBLISHABLE, id: "k1" },
  { name: "default", type: "secret", api_key: SECRET, id: "k2" },
];
const MASKED_KEYS = REVEALED_KEYS.map((k) =>
  k.type === "secret" ? { ...k, api_key: "sb_secret_ZyXw••••••••" } : k,
);

// -----------------------------------------------------------------------------
// Infra de teste: fetch simulado + dependências injetadas
// -----------------------------------------------------------------------------

function json(status, body) {
  return { status, json: body };
}

function createFetchMock(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({
      method,
      host: u.host,
      path: u.pathname,
      search: u.search,
      body,
      headers: init.headers,
    });
    const key = `${method} ${u.host}${u.pathname}`;
    const handler = routes[key];
    if (!handler) {
      return new Response(JSON.stringify({ message: `rota não simulada: ${key}` }), {
        status: 599,
      });
    }
    const { status = 200, json: payload } =
      typeof handler === "function" ? handler({ url: u, body, calls }) : handler;
    return new Response(payload === undefined ? null : JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

// Contas fictícias do seed (ids e e-mails reais do supabase/seed.sql): equipe + duas personas.
const DEMO_ROWS = [
  { id: "d0000000-0000-4000-8000-000000000001", email: `admin@${DEMO_EMAIL_DOMAIN}` },
  { id: "d1000000-0000-4000-8000-000000000001", email: `marina@${DEMO_EMAIL_DOMAIN}` },
  { id: "d0000000-0000-4000-8000-000000000002", email: `moderacao@${DEMO_EMAIL_DOMAIN}` },
  { id: "d2000000-0000-4000-8000-000000000001", email: `larissa@${DEMO_EMAIL_DOMAIN}` },
];
const isRotationQuery = (q) => /update auth\.users/.test(q) && /encrypted_password/.test(q);
/** Pares (id, senha) do VALUES da troca de senhas. */
const rotationPairs = (q) =>
  [...q.matchAll(/\('([0-9a-f-]{36})'::uuid, '([^']*)'\)/g)].map(([, id, password]) => ({
    id,
    password,
  }));

/**
 * SQL simulado: contas de demonstração (`demoRows`), troca de senhas (devolve os ids enviados),
 * sessões da equipe, presença do seed (`present`) e contagem dos dados de referência.
 */
function queryRoute({ present = false, demoRows = DEMO_ROWS, override } = {}) {
  return (ctx) => {
    const q = ctx.body.query;
    const custom = override?.(ctx);
    if (custom) return custom;
    if (q === DEMO_ACCOUNTS_SQL) return json(201, demoRows);
    if (isRotationQuery(q))
      return json(
        201,
        rotationPairs(q).map(({ id }) => ({ id })),
      );
    if (q === DEMO_STAFF_SESSIONS_SQL) return json(201, []);
    if (/count\(\*\)/.test(q)) return json(201, [{ areas: 64, categories: 8 }]);
    if (/select exists/.test(q)) return json(201, [{ present }]);
    return json(201, []);
  };
}

function supabaseRoutes(overrides = {}) {
  const base = `api.supabase.com/v1/projects/${REF}`;
  return {
    [`GET ${base}`]: json(200, {
      ref: REF,
      name: "artemis",
      region: "sa-east-1",
      status: "ACTIVE_HEALTHY",
      database: { version: "17.4.1" },
    }),
    [`POST ${base}/database/query`]: queryRoute(),
    [`GET ${base}/config/auth`]: json(200, {
      site_url: "http://localhost:3000",
      uri_allow_list: "http://localhost:3000/**,https://antigo.exemplo.dev/**",
    }),
    [`PATCH ${base}/config/auth`]: ({ body }) => json(200, body),
    [`GET ${base}/storage/buckets`]: json(200, [
      { id: "avatars", name: "avatars", public: true, owner: "", created_at: "", updated_at: "" },
    ]),
    [`GET ${base}/api-keys`]: ({ url }) =>
      json(200, url.searchParams.get("reveal") === "true" ? REVEALED_KEYS : MASKED_KEYS),
    ...overrides,
  };
}

function vercelRoutes(overrides = {}) {
  return {
    "GET api.vercel.com/v9/projects/artemis-web": json(200, { id: "prj_123", name: "artemis-web" }),
    "POST api.vercel.com/v10/projects/artemis-web/env": ({ body }) =>
      json(201, { created: body, failed: [] }),
    ...overrides,
  };
}

const isEnvPath = (file) => path.basename(file).startsWith(".env");

function makeDeps({
  env = {},
  routes = supabaseRoutes(),
  cliCodes = {},
  files = {},
  gitIgnored = true,
} = {}) {
  const stdout = [];
  const stderr = [];
  const writes = [];
  const cliCalls = [];
  const tempFiles = [];
  // Senhas falsas, distintas e no formato base64url; ficam registradas para os testes procurarem
  // vazamentos.
  const passwords = [];
  const { fetch, calls } = createFetchMock(routes);
  const deps = {
    rootDir: ROOT,
    env: { ...env },
    fetch,
    runCli: async (args, opts) => {
      cliCalls.push({ args, env: opts.env, cwd: opts.cwd });
      return cliCodes[args.slice(0, 2).join(" ")] ?? 0;
    },
    readText: async (file) => (file in files ? files[file] : readFile(file, "utf8")),
    writeText: async (file, content) => {
      writes.push({ file, content });
      // Como num disco de verdade: a próxima leitura vê o que foi gravado.
      if (isEnvPath(file)) files[file] = content;
    },
    fileExists: async (file) => (isEnvPath(file) ? file in files : existsSync(file)),
    listDir: (dir) => readdir(dir),
    withTempFile: async (name, content, fn) => {
      tempFiles.push(content);
      return fn(`/tmp/simulado/${name}`);
    },
    isGitIgnored: () => gitIgnored,
    randomHex: (bytes) => "c".repeat(bytes * 2),
    randomToken: (bytes) => {
      assert.equal(bytes, 24);
      const value = fake(
        "FAKE0demo0pw0",
        String(passwords.length + 1).padStart(3, "0"),
        "Q_-z9".repeat(4),
      );
      passwords.push(value);
      return value;
    },
    sleep: async () => {},
    now: () => new Date("2026-10-28T12:00:00Z"),
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  };
  const output = () => [...stdout, ...stderr].join("\n");
  return { deps, stdout, stderr, writes, cliCalls, calls, output, passwords, tempFiles };
}

const fullEnv = (extra = {}) => ({
  SUPABASE_ACCESS_TOKEN: TOKEN,
  SUPABASE_PROJECT_REF: REF,
  SUPABASE_DB_PASSWORD: DB_PASSWORD,
  ...extra,
});

function assertNoSecrets(text) {
  for (const s of SECRETS)
    assert.ok(!text.includes(s), `a saída vazou um segredo: ${maskSecret(s)}`);
}

// -----------------------------------------------------------------------------
// Funções puras
// -----------------------------------------------------------------------------

describe("parseArgs", () => {
  test("lê flags com = e com espaço", () => {
    const a = parseArgs([
      "--site-url",
      SITE,
      "--dry-run",
      "--with-demo-seed",
      "--write-env=.env.cloud",
      "--vercel",
      "--redirect-url=https://*-time.vercel.app/**",
    ]);
    assert.equal(a.siteUrl, SITE);
    assert.equal(a.dryRun, true);
    assert.equal(a.withDemoSeed, true);
    assert.equal(a.writeEnv, ".env.cloud");
    assert.equal(a.vercel, true);
    assert.deepEqual(a.redirectUrls, ["https://*-time.vercel.app/**"]);
    assert.deepEqual(a.errors, []);
  });

  test("--write-env sem valor usa .env.cloud; flag desconhecida vira erro", () => {
    const a = parseArgs(["--write-env", "--vercel", "--quebrado"]);
    assert.equal(a.writeEnv, ".env.cloud");
    assert.equal(a.vercel, true);
    assert.match(a.errors[0], /desconhecida: --quebrado/);
  });
});

describe("validação de entradas", () => {
  test("normalizeSiteUrl exige https e tira a barra final", () => {
    assert.equal(normalizeSiteUrl("https://artemis.vercel.app/"), SITE);
    assert.equal(normalizeSiteUrl("https://exemplo.dev/app/"), "https://exemplo.dev/app");
    assert.throws(() => normalizeSiteUrl("http://artemis.vercel.app"), /https:\/\//);
    // Exceção só para desenvolvimento local (app na máquina, banco na nuvem).
    assert.equal(normalizeSiteUrl("http://localhost:3000/"), "http://localhost:3000");
    assert.equal(normalizeSiteUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    assert.throws(() => normalizeSiteUrl("http://localhost.evil.dev"), /https:\/\//);
    assert.throws(() => normalizeSiteUrl("https://a.dev/?x=1"), /query/);
    assert.throws(() => normalizeSiteUrl("nao é url"), /inválida/);
    assert.throws(() => normalizeSiteUrl(undefined), /--site-url/);
  });

  test("validateRedirectUrl aceita curingas e recusa vírgula", () => {
    assert.equal(
      validateRedirectUrl("https://*-time.vercel.app/**"),
      "https://*-time.vercel.app/**",
    );
    assert.throws(() => validateRedirectUrl("https://a.dev,https://b.dev"));
    assert.throws(() => validateRedirectUrl("ftp://a.dev"));
  });

  test("normalizeProjectRef aceita a URL do projeto", () => {
    assert.equal(normalizeProjectRef(`https://${REF}.supabase.co`), REF);
    assert.equal(normalizeProjectRef(` ${REF} `), REF);
  });

  test("buildConfig: execução real exige token, ref e senha", () => {
    const { errors } = buildConfig(parseArgs([`--site-url=${SITE}`]), {});
    assert.equal(errors.length, 3);
    assert.match(errors.join("\n"), /SUPABASE_ACCESS_TOKEN/);
    assert.match(errors.join("\n"), /SUPABASE_PROJECT_REF/);
    assert.match(errors.join("\n"), /SUPABASE_DB_PASSWORD/);
  });

  test("buildConfig: na simulação a falta de credenciais vira aviso", () => {
    const { errors, warnings, config } = buildConfig(
      parseArgs([`--site-url=${SITE}`, "--dry-run"]),
      {},
    );
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 3);
    assert.equal(config.refIsPlaceholder, true);
  });

  test("buildConfig: com --migrations-via-api a senha do banco é dispensável", () => {
    const { errors } = buildConfig(parseArgs([`--site-url=${SITE}`, "--migrations-via-api"]), {
      SUPABASE_ACCESS_TOKEN: TOKEN,
      SUPABASE_PROJECT_REF: REF,
    });
    assert.deepEqual(errors, []);
  });

  test("buildConfig: ref inválido, SMTP incompleto e --vercel sem token", () => {
    const { errors, warnings } = buildConfig(parseArgs([`--site-url=${SITE}`, "--vercel"]), {
      ...fullEnv({ SUPABASE_PROJECT_REF: "Projeto-Errado" }),
      SMTP_HOST: "smtp.resend.com",
    });
    assert.match(errors.join("\n"), /20 letras/);
    assert.match(errors.join("\n"), /SMTP próprio incompleto/);
    assert.match(warnings.join("\n"), /VERCEL_TOKEN/);
  });

  test("resolveEnvFilePath só aceita .env* dentro do repositório", () => {
    assert.equal(resolveEnvFilePath(ROOT, ".env.cloud").rel, ".env.cloud");
    assert.equal(resolveEnvFilePath(ROOT, ".env.production.local").autoloadedByNext, true);
    assert.equal(resolveEnvFilePath(ROOT, ".env.cloud").autoloadedByNext, false);
    assert.throws(() => resolveEnvFilePath(ROOT, ".env.example"), /ignorado pelo git/);
    assert.throws(() => resolveEnvFilePath(ROOT, "segredos.txt"), /\.env\*/);
    assert.throws(() => resolveEnvFilePath(ROOT, "../.env.cloud"), /dentro do repositório/);
  });
});

describe("config.toml", () => {
  test("parseTomlValue: escapes, literais, booleanos, números e comentário", () => {
    assert.equal(parseTomlValue('"Olá \\"mundo\\" \\u00e9"'), 'Olá "mundo" é');
    assert.equal(parseTomlValue("'C:\\caminho'"), "C:\\caminho");
    assert.equal(parseTomlValue('"com # dentro" # comentário'), "com # dentro");
    assert.equal(parseTomlValue("true"), true);
    assert.equal(parseTomlValue("1_000 # mil"), 1000);
  });

  test("parseTomlSections ignora seções comentadas e junta arrays multilinha", () => {
    const sections = parseTomlSections(
      [
        "# [auth.email.template.invite]",
        '# subject = "não"',
        "[auth]",
        "minimum_password_length = 10",
        "lista = [",
        '  "a",',
        "]",
        "[auth.email.template.invite]",
        'subject = "Convite"',
      ].join("\n"),
    );
    assert.equal(sections.get("auth").get("minimum_password_length"), 10);
    assert.match(sections.get("auth").get("lista"), /^\[.*\]$/);
    assert.equal(sections.get("auth.email.template.invite").get("subject"), "Convite");
  });

  test("parseAuthEmailConfig lê os 5 modelos do config.toml real", () => {
    const { templates, missing, passwordMinLength } = parseAuthEmailConfig(
      readRepo("supabase/config.toml"),
    );
    assert.deepEqual(missing, []);
    assert.deepEqual(Object.keys(templates).sort(), [...EMAIL_TEMPLATE_TYPES].sort());
    assert.ok(passwordMinLength >= 8);
    for (const type of EMAIL_TEMPLATE_TYPES) {
      assert.ok(templates[type].subject.length > 5, `assunto de ${type}`);
      const found = templatePathCandidates(ROOT, templates[type].contentPath).some((p) =>
        existsSync(p),
      );
      assert.ok(found, `arquivo do modelo ${type} existe`);
    }
  });

  test("parseAuthEmailConfig aponta modelos faltando e nunca baixa a senha mínima de 8", () => {
    const { missing, passwordMinLength } = parseAuthEmailConfig(
      [
        "[auth]",
        "minimum_password_length = 6",
        "[auth.email.template.confirmation]",
        'subject = "x"',
      ].join("\n"),
    );
    assert.deepEqual(missing, EMAIL_TEMPLATE_TYPES);
    assert.equal(passwordMinLength, 8);
  });
});

describe("seed.sql", () => {
  test("extrai só os dados de referência do seed real", () => {
    const seed = readRepo("supabase/seed.sql");
    const { referenceSql, demoSql, counts, demoMarkerUserId } = extractSeedSections(seed);
    assert.match(referenceSql, /^-- -+\n-- 1\. Áreas de pesquisa/);
    assert.match(referenceSql, /insert into public\.research_areas/);
    assert.match(referenceSql, /insert into public\.forum_categories/);
    assert.doesNotMatch(referenceSql, /auth\.users|DEMONSTRAÇÃO|2a\. Contas/);
    assert.match(referenceSql, /on conflict \(slug\) do nothing;\n$/);
    assert.match(demoSql, /^-- =+\n-- 2\. DEMONSTRAÇÃO/);
    assert.match(demoSql, /insert into auth\.users/);
    assert.equal(counts.areas, 64);
    assert.equal(counts.categories, 8);
    assert.match(
      demoMarkerUserId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    assert.ok(seed.includes(referenceSql.trim()), "o trecho extraído é literal do arquivo");
  });

  test("falha sem os marcadores ou com INSERT não idempotente", () => {
    assert.throws(() => extractSeedSections("select 1;"), /marcadores/);
    const semConflict = [
      "-- 1. Áreas de pesquisa",
      "insert into public.research_areas (slug) values ('a');",
      "-- 1b. Categorias do fórum",
      "insert into public.forum_categories (slug) values ('b') on conflict do nothing;",
      "-- 2. DEMONSTRAÇÃO (fictício)",
    ].join("\n");
    assert.throws(() => extractSeedSections(semConflict), /sem ON CONFLICT/);
    assert.throws(() => assertIdempotentInserts("-- insert into x\nselect 1;"), /nenhum INSERT/);
  });

  test("encontra o INSERT do bucket na migration de storage", () => {
    const dir = path.join(ROOT, "supabase", "migrations");
    const file = readFileSync(
      path.join(
        dir,
        readdirSyncSorted(dir).find((f) => /storage/.test(f)),
      ),
      "utf8",
    );
    const insert = extractBucketInsert(file);
    assert.match(insert, /^insert into storage\.buckets/i);
    assert.match(insert, /'avatars'/);
    assert.match(insert, /on conflict \(id\) do nothing;$/);
    assert.equal(extractBucketInsert("select 1;"), null);
  });
});

function readdirSyncSorted(dir) {
  return readdirSync(dir).sort();
}

describe("Auth", () => {
  const templates = Object.fromEntries(
    EMAIL_TEMPLATE_TYPES.map((t) => [
      t,
      { subject: `Assunto ${t}`, content: `<p>${t} {{ .TokenHash }}</p>` },
    ]),
  );

  test("mergeAllowList mantém o que existe e não repete", () => {
    assert.equal(mergeAllowList("a/**, b/**", ["b/**", "c/**"]), "a/**,b/**,c/**");
    assert.equal(mergeAllowList(null, ["c/**"]), "c/**");
  });

  test("buildAuthConfigPayload usa os nomes de campo da API", () => {
    const p = buildAuthConfigPayload({
      siteUrl: SITE,
      currentAllowList: "http://localhost:3000/**",
      extraRedirectUrls: ["https://*-time.vercel.app/**"],
      templates,
      passwordMinLength: 8,
    });
    assert.equal(p.site_url, SITE);
    assert.equal(
      p.uri_allow_list,
      `http://localhost:3000/**,${SITE}/**,https://*-time.vercel.app/**`,
    );
    assert.equal(p.mailer_autoconfirm, false);
    assert.equal(p.password_min_length, 8);
    for (const t of EMAIL_TEMPLATE_TYPES) {
      assert.equal(p[`mailer_subjects_${t}`], `Assunto ${t}`);
      assert.equal(p[`mailer_templates_${t}_content`], templates[t].content);
    }
    assert.equal("smtp_host" in p, false);
  });

  test("--auto-confirm-email liga mailer_autoconfirm, avisa e recusa valor", () => {
    const a = parseArgs([`--site-url=${SITE}`, "--auto-confirm-email"]);
    assert.deepEqual(a.errors, []);
    assert.equal(a.autoConfirmEmail, true);
    const { config, warnings } = buildConfig(a, {});
    assert.equal(config.autoConfirmEmail, true);
    assert.ok(warnings.some((w) => w.includes("--auto-confirm-email")));
    const p = buildAuthConfigPayload({ siteUrl: SITE, templates, autoConfirmEmail: true });
    assert.equal(p.mailer_autoconfirm, true);
    assert.equal(parseArgs([`--site-url=${SITE}`]).autoConfirmEmail, false);
    assert.equal(parseArgs(["--auto-confirm-email=false"]).errors.length, 1);
  });

  test("withoutEmailTemplates tira só assuntos e modelos; isEmailTemplateRefusal reconhece a recusa", () => {
    const p = buildAuthConfigPayload({ siteUrl: SITE, templates, autoConfirmEmail: true });
    const stripped = withoutEmailTemplates(p);
    assert.ok(Object.keys(p).some((k) => k.startsWith("mailer_templates_")));
    assert.ok(!Object.keys(stripped).some((k) => k.startsWith("mailer_templates_")));
    assert.ok(!Object.keys(stripped).some((k) => k.startsWith("mailer_subjects_")));
    assert.equal(stripped.site_url, SITE);
    assert.equal(stripped.mailer_autoconfirm, true);
    assert.equal(stripped.password_min_length, p.password_min_length);
    const refusal = new HttpError({
      status: 400,
      data: {
        message:
          "Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.",
      },
      method: "PATCH",
      url: "https://api.supabase.com/v1/projects/x/config/auth",
    });
    assert.equal(isEmailTemplateRefusal(refusal), true);
    assert.equal(
      isEmailTemplateRefusal(
        new HttpError({ status: 400, data: { message: "outra coisa" }, method: "PATCH", url: "u" }),
      ),
      false,
    );
    assert.equal(isEmailTemplateRefusal(new Error("Email template")), false);
  });

  test("plano gratuito sem SMTP: Auth recusa os modelos → aplica o resto e segue (exit 0)", async () => {
    const base = `api.supabase.com/v1/projects/${REF}`;
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`PATCH ${base}/config/auth`]: ({ body }) =>
          Object.keys(body).some((k) => k.startsWith("mailer_templates_"))
            ? json(400, {
                message:
                  "Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.",
              })
            : json(200, body),
      }),
    });
    const code = await main(
      [`--site-url=${SITE}`, "--migrations-via-api", "--auto-confirm-email", "--write-env"],
      t.deps,
    );
    assert.equal(code, 0, t.output());
    const patches = t.calls.filter((c) => c.method === "PATCH" && c.path.endsWith("/config/auth"));
    assert.equal(patches.length, 2);
    assert.ok(Object.keys(patches[0].body).some((k) => k.startsWith("mailer_templates_")));
    const second = patches[1].body;
    assert.ok(
      !Object.keys(second).some((k) => k.startsWith("mailer_")) || second.mailer_autoconfirm,
    );
    assert.ok(!Object.keys(second).some((k) => k.startsWith("mailer_templates_")));
    assert.equal(second.site_url, SITE);
    assert.equal(second.mailer_autoconfirm, true);
    assert.match(t.output(), /plano gratuito, sem SMTP próprio/);
    assert.match(t.output(), /Modelos de e-mail em português/);
    assert.match(t.output(), /confirmação de e-mail desligada/);
  });

  test("com SMTP próprio, a recusa dos modelos continua sendo erro", async () => {
    const base = `api.supabase.com/v1/projects/${REF}`;
    const t = makeDeps({
      env: fullEnv({
        SMTP_HOST: "smtp.resend.com",
        SMTP_PORT: "465",
        SMTP_USER: "resend",
        SMTP_PASS: "re_senha_smtp_123456",
        SMTP_ADMIN_EMAIL: "nao-responda@artemis.dev",
      }),
      routes: supabaseRoutes({
        [`PATCH ${base}/config/auth`]: json(400, {
          message: "Email template modification is not available for free tier projects",
        }),
      }),
    });
    const code = await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps);
    assert.notEqual(code, 0);
    assert.equal(
      t.calls.filter((c) => c.method === "PATCH" && c.path.endsWith("/config/auth")).length,
      1,
    );
  });

  test("buildAuthConfigPayload com SMTP próprio; resumo mascara a senha", () => {
    const p = buildAuthConfigPayload({
      siteUrl: SITE,
      templates,
      smtp: {
        host: "smtp.resend.com",
        port: "465",
        user: "resend",
        pass: "re_senha_smtp_123456",
        adminEmail: "nao-responda@artemis.dev",
      },
    });
    assert.equal(p.smtp_port, "465");
    assert.equal(p.smtp_admin_email, "nao-responda@artemis.dev");
    const summary = summarizeAuthPayload(p).join("\n");
    assert.ok(!summary.includes("re_senha_smtp_123456"));
    assert.match(summary, /mailer_templates_confirmation_content: \(\d+ bytes de HTML\)/);
  });

  test("buildAuthConfigPayload recusa modelo vazio", () => {
    assert.throws(
      () =>
        buildAuthConfigPayload({
          siteUrl: SITE,
          templates: { ...templates, invite: { subject: "x", content: "" } },
        }),
      /invite/,
    );
  });
});

describe("segredos", () => {
  test("maskSecret nunca mostra o corpo do segredo", () => {
    assert.equal(maskSecret(SECRET), `sb_secret_****(${SECRET.length} caracteres)`);
    assert.equal(maskSecret(TOKEN).startsWith("sbp_****"), true);
    assert.equal(maskSecret(LEGACY_ANON).startsWith("eyJ****"), true);
    assert.equal(maskSecret(""), "(vazio)");
    for (const s of SECRETS) assert.ok(!maskSecret(s).includes(s.slice(-6)));
  });

  test("createRedactor troca segredos conhecidos em qualquer texto", () => {
    const redact = createRedactor();
    redact.add(SECRET, "curto");
    assert.equal(redact(`chave=${SECRET}!`), `chave=${maskSecret(SECRET)}!`);
    assert.equal(redact("curto"), "curto");
  });

  test("pickApiKeys prefere as novas, cai para as legadas e ignora mascaradas", () => {
    assert.deepEqual(pickApiKeys(REVEALED_KEYS), {
      publishable: PUBLISHABLE,
      secret: SECRET,
      legacyAnon: LEGACY_ANON,
      legacyServiceRole: LEGACY_SERVICE,
    });
    const legacyOnly = pickApiKeys(REVEALED_KEYS.filter((k) => k.type === "legacy"));
    assert.equal(legacyOnly.publishable, null);
    assert.equal(legacyOnly.legacyAnon, LEGACY_ANON);
    assert.equal(pickApiKeys(MASKED_KEYS, { requireRevealed: true }).secret, null);
    assert.equal(pickApiKeys(null).publishable, null);
    assert.equal(looksRevealed("sb_secret_ZyXw••••"), false);
  });
});

describe("arquivo .env", () => {
  test("buildEnvFile cria o arquivo com cabeçalho", () => {
    const text = buildEnvFile({ A: "1", B: "com espaço" }, "", {
      generatedAt: new Date("2026-10-28T00:00:00Z"),
    });
    assert.match(text, /^# Variáveis do Supabase Cloud/);
    assert.match(text, /\nA=1\nB="com espaço"\n$/);
  });

  test("buildEnvFile substitui as chaves gerenciadas e preserva o resto", () => {
    const existing =
      "# meu comentário\nGEMINI_API_KEY=minha\nexport NEXT_PUBLIC_SITE_URL=http://velho\n";
    const text = buildEnvFile({ NEXT_PUBLIC_SITE_URL: SITE, CRON_SECRET: CRON }, existing);
    assert.match(
      text,
      /# meu comentário\nGEMINI_API_KEY=minha\nNEXT_PUBLIC_SITE_URL=https:\/\/artemis\.vercel\.app\n/,
    );
    assert.match(text, new RegExp(`CRON_SECRET=${CRON}\\n$`));
    assert.equal(text.match(/NEXT_PUBLIC_SITE_URL=/g).length, 1);
  });

  test("parseEnvText lida com aspas, export e comentários", () => {
    const env = parseEnvText("export A=\"x y\"\nB='z'\nC=w # nota\n# D=1\n");
    assert.deepEqual(Object.fromEntries(env), { A: "x y", B: "z", C: "w" });
    assert.equal(formatEnvValue("https://a.dev/**"), "https://a.dev/**");
    assert.equal(formatEnvValue("Artemis <oi@a.dev>"), '"Artemis <oi@a.dev>"');
  });

  test("resolveCronSecret: ambiente > arquivo > gerado; ignora o placeholder do .env.example", () => {
    const gen = (n) => "g".repeat(n * 2);
    assert.equal(
      resolveCronSecret({ CRON_SECRET: "do-ambiente" }, new Map(), gen).source,
      "ambiente",
    );
    assert.equal(
      resolveCronSecret({}, new Map([["CRON_SECRET", "do-arquivo"]]), gen).value,
      "do-arquivo",
    );
    const generated = resolveCronSecret(
      { CRON_SECRET: "troque-por-uma-string-aleatoria-longa" },
      new Map(),
      gen,
    );
    assert.equal(generated.source, "gerado");
    assert.equal(generated.value.length, 64);
  });
});

describe("Vercel", () => {
  const appEnv = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    SUPABASE_SECRET_KEY: SECRET,
    NEXT_PUBLIC_SITE_URL: SITE,
    CRON_SECRET: CRON,
  };

  test("buildVercelEnvVars: tipos, alvos e chaves opcionais só se existirem", () => {
    const vars = buildVercelEnvVars(appEnv, { GEMINI_API_KEY: GEMINI, GROQ_API_KEY: "  " });
    assert.deepEqual(
      vars.map((v) => [v.key, v.type]),
      [
        ["NEXT_PUBLIC_SUPABASE_URL", "encrypted"],
        ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "encrypted"],
        ["SUPABASE_SECRET_KEY", "sensitive"],
        ["NEXT_PUBLIC_SITE_URL", "encrypted"],
        ["CRON_SECRET", "sensitive"],
        ["GEMINI_API_KEY", "sensitive"],
      ],
    );
    for (const v of vars) assert.deepEqual(v.target, ["production", "preview"]);
  });

  test("vercelTeamQuery distingue id e slug", () => {
    assert.equal(vercelTeamQuery("team_abc"), "teamId=team_abc");
    assert.equal(vercelTeamQuery("meu-time"), "slug=meu-time");
    assert.equal(vercelTeamQuery(""), "");
  });
});

describe("HTTP", () => {
  test("repete após 429 e devolve o JSON", async () => {
    let n = 0;
    const request = createRequester({
      fetchImpl: async () =>
        ++n === 1
          ? new Response("{}", { status: 429 })
          : new Response('{"ok":true}', { status: 200 }),
      sleep: async () => {},
    });
    const { data } = await request("https://api.supabase.com/x", {
      method: "POST",
      idempotent: false,
    });
    assert.deepEqual(data, { ok: true });
    assert.equal(n, 2);
  });

  test("não repete POST não idempotente após 500", async () => {
    let n = 0;
    const request = createRequester({
      fetchImpl: async () => {
        n++;
        return new Response('{"message":"falhou"}', { status: 500 });
      },
      sleep: async () => {},
    });
    await assert.rejects(
      request("https://api.supabase.com/x", { method: "POST", idempotent: false }),
      (e) => {
        assert.ok(e instanceof HttpError);
        assert.equal(e.status, 500);
        assert.equal(e.detail, "falhou");
        return true;
      },
    );
    assert.equal(n, 1);
  });
});

// -----------------------------------------------------------------------------
// main() de ponta a ponta, com fetch e CLI simulados
// -----------------------------------------------------------------------------

describe("main", () => {
  test("--help", async () => {
    const t = makeDeps();
    assert.equal(await main(["--help"], t.deps), 0);
    assert.match(t.output(), /--site-url/);
  });

  test("erros de validação saem com código 2 sem rede nem CLI", async () => {
    const t = makeDeps();
    assert.equal(await main(["--site-url=http://inseguro.dev"], t.deps), 2);
    assert.match(t.output(), /https:\/\//);
    assert.equal(t.calls.length, 0);
    assert.equal(t.cliCalls.length, 0);
  });

  test("--dry-run sem credenciais roda offline", async () => {
    const t = makeDeps();
    const code = await main([`--site-url=${SITE}`, "--dry-run", "--write-env", "--vercel"], t.deps);
    assert.equal(code, 0, t.output());
    assert.equal(t.calls.length, 0);
    assert.equal(t.cliCalls.length, 0);
    assert.equal(t.writes.length, 0);
    assert.match(t.output(), /nenhuma chamada de rede/);
    assert.match(t.output(), /64 áreas \+ 8 categorias/);
    assert.match(t.output(), /Simulação concluída/);
  });

  test("--dry-run com token só faz leituras (GET) e não revela segredos", async () => {
    const t = makeDeps({
      env: fullEnv({ VERCEL_TOKEN, VERCEL_PROJECT: "artemis-web", GEMINI_API_KEY: GEMINI }),
      routes: { ...supabaseRoutes(), ...vercelRoutes() },
    });
    const code = await main([`--site-url=${SITE}`, "--dry-run", "--write-env", "--vercel"], t.deps);
    assert.equal(code, 0, t.output());
    assert.ok(t.calls.length > 0);
    assert.deepEqual([...new Set(t.calls.map((c) => c.method))], ["GET"]);
    const keysCall = t.calls.find((c) => c.path.endsWith("/api-keys"));
    assert.equal(keysCall.search, "?reveal=false");
    assert.equal(t.cliCalls.length, 0);
    assert.equal(t.writes.length, 0);
    assert.match(t.output(), /simulação, não enviado/);
    assertNoSecrets(t.output());
  });

  test("execução completa: CLI, SQL, Auth, bucket, chaves, .env e Vercel", async () => {
    const t = makeDeps({
      env: fullEnv({
        VERCEL_TOKEN,
        VERCEL_TEAM_ID: "team_abc",
        VERCEL_PROJECT: "artemis-web",
        GEMINI_API_KEY: GEMINI,
      }),
      routes: { ...supabaseRoutes(), ...vercelRoutes() },
    });
    const code = await main(
      [
        `--site-url=${SITE}/`,
        "--write-env=.env.cloud",
        "--vercel",
        "--redirect-url=https://*-time.vercel.app/**",
      ],
      t.deps,
    );
    assert.equal(code, 0, t.output());

    // CLI: link + db push, senha e token só pelo ambiente
    assert.deepEqual(
      t.cliCalls.map((c) => c.args),
      [
        ["link", "--project-ref", REF],
        ["db", "push", "--linked", "--yes"],
      ],
    );
    for (const c of t.cliCalls) {
      assert.equal(c.env.SUPABASE_ACCESS_TOKEN, TOKEN);
      assert.equal(c.env.SUPABASE_DB_PASSWORD, DB_PASSWORD);
      assert.ok(!c.args.join(" ").includes(DB_PASSWORD));
      assert.equal(c.cwd, ROOT);
    }

    // Ordem das chamadas à API
    const seq = t.calls.map((c) => `${c.method} ${c.host}${c.path}`);
    const base = `api.supabase.com/v1/projects/${REF}`;
    assert.equal(seq[0], `GET ${base}`);
    const idx = (s) => seq.indexOf(s);
    assert.ok(idx(`POST ${base}/database/query`) > 0);
    assert.ok(idx(`PATCH ${base}/config/auth`) > idx(`GET ${base}/config/auth`));
    assert.ok(idx(`GET ${base}/api-keys`) > idx(`GET ${base}/storage/buckets`));
    assert.ok(
      idx("POST api.vercel.com/v10/projects/artemis-web/env") > idx(`GET ${base}/api-keys`),
    );

    // Autenticação
    for (const c of t.calls.filter((c) => c.host === "api.supabase.com")) {
      assert.equal(c.headers.Authorization, `Bearer ${TOKEN}`);
    }

    // SQL de referência: só as seções 1 e 1b
    const queries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.match(queries[0], /insert into public\.research_areas/);
    assert.doesNotMatch(queries.join("\n"), /auth\.users \(/);

    // Auth
    const patch = t.calls.find((c) => c.method === "PATCH").body;
    assert.equal(patch.site_url, SITE);
    assert.equal(
      patch.uri_allow_list,
      `http://localhost:3000/**,https://antigo.exemplo.dev/**,${SITE}/**,https://*-time.vercel.app/**`,
    );
    assert.equal(patch.mailer_autoconfirm, false);
    assert.equal(patch.password_min_length, 8);
    const toml = parseAuthEmailConfig(readRepo("supabase/config.toml"));
    for (const type of EMAIL_TEMPLATE_TYPES) {
      assert.equal(patch[`mailer_subjects_${type}`], toml.templates[type].subject);
      const file = templatePathCandidates(ROOT, toml.templates[type].contentPath).find((p) =>
        existsSync(p),
      );
      assert.equal(patch[`mailer_templates_${type}_content`], readFileSync(file, "utf8"));
    }

    // Chaves reveladas
    assert.equal(t.calls.find((c) => c.path.endsWith("/api-keys")).search, "?reveal=true");

    // Arquivo .env
    assert.equal(t.writes.length, 1);
    assert.equal(t.writes[0].file, path.join(ROOT, ".env.cloud"));
    const written = parseEnvText(t.writes[0].content);
    assert.equal(written.get("NEXT_PUBLIC_SUPABASE_URL"), `https://${REF}.supabase.co`);
    assert.equal(written.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), PUBLISHABLE);
    assert.equal(written.get("SUPABASE_SECRET_KEY"), SECRET);
    assert.equal(written.get("NEXT_PUBLIC_SITE_URL"), SITE);
    assert.equal(written.get("CRON_SECRET"), CRON);

    // Vercel
    const envCall = t.calls.find((c) => c.path === "/v10/projects/artemis-web/env");
    assert.equal(envCall.search, "?upsert=true&teamId=team_abc");
    assert.equal(envCall.headers.Authorization, `Bearer ${VERCEL_TOKEN}`);
    const byKey = Object.fromEntries(envCall.body.map((v) => [v.key, v]));
    assert.equal(byKey.SUPABASE_SECRET_KEY.value, SECRET);
    assert.equal(byKey.SUPABASE_SECRET_KEY.type, "sensitive");
    assert.equal(byKey.NEXT_PUBLIC_SUPABASE_URL.type, "encrypted");
    assert.equal(byKey.GEMINI_API_KEY.value, GEMINI);
    assert.equal(byKey.CRON_SECRET.value, CRON);

    // Saída: checklist e nenhum segredo
    const out = t.output();
    assert.match(out, /\[x\] Migrations aplicadas/);
    assert.match(out, /\[x\] Variáveis cadastradas na Vercel/);
    assert.match(out, /Primeira administradora/);
    assert.match(out, /Redeploy/);
    assert.match(out, new RegExp(`https://${REF}\\.supabase\\.co/auth/v1/callback`));
    assertNoSecrets(out);
  });

  test("401 no projeto: mensagem amigável e nada é alterado", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}`]: json(401, { message: "Unauthorized" }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 1);
    assert.match(t.output(), /token do Supabase inválido ou expirado \(401\)/);
    assert.match(t.output(), /dashboard\/account\/tokens/);
    assert.equal(t.cliCalls.length, 0);
    assert.equal(t.calls.length, 1);
    assertNoSecrets(t.output());
  });

  test("404 no projeto aponta o ref", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}`]: json(404, { message: "Not found" }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 1);
    assert.match(t.output(), /projeto não encontrado \(404\).*SUPABASE_PROJECT_REF/);
  });

  test("projeto pausado: pede para restaurar", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}`]: json(200, {
          name: "x",
          region: "sa-east-1",
          status: "INACTIVE",
        }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 1);
    assert.match(t.output(), /pausado/);
    assert.equal(t.cliCalls.length, 0);
  });

  test("falha no supabase link interrompe antes do SQL", async () => {
    const t = makeDeps({ env: fullEnv(), cliCodes: { "link --project-ref": 1 } });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 1);
    assert.match(t.output(), /"supabase link" falhou/);
    assert.equal(t.cliCalls.length, 1);
    assert.equal(t.calls.filter((c) => c.method !== "GET").length, 0);
  });

  test("--with-demo-seed aplica o seed inteiro só se a demonstração ainda não existir", async () => {
    const t = makeDeps({ env: fullEnv() });
    assert.equal(
      await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
      0,
      t.output(),
    );
    const queries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.ok(queries.some((q) => q === readRepo("supabase/seed.sql")));
    // Depois do seed.sql, os seeds extras (supabase/seeds/*.sql), na ordem do config.toml.
    const extras = readdirSync(path.join(ROOT, "supabase", "seeds"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    assert.ok(extras.length > 0);
    const seedAt = queries.indexOf(readRepo("supabase/seed.sql"));
    const extraAt = extras.map((f) => queries.indexOf(readRepo(`supabase/seeds/${f}`)));
    assert.ok(
      extraAt.every((i) => i > seedAt),
      "seeds extras depois do seed.sql",
    );
    assert.deepEqual(
      [...extraAt].sort((a, b) => a - b),
      extraAt,
      "seeds extras em ordem alfabética",
    );
    assert.match(t.output(), /ATENÇÃO: --with-demo-seed/);
    assert.match(t.output(), /\[x\] Seed de DEMONSTRAÇÃO aplicado/);
    assert.match(t.output(), /\[x\] Seeds extras de DEMONSTRAÇÃO aplicados/);

    const again = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: queryRoute({ present: true }),
      }),
    });
    assert.equal(
      await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], again.deps),
      0,
      again.output(),
    );
    const queries2 = again.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.ok(!queries2.some((q) => q.includes("insert into auth.users")));
    assert.match(again.output(), /já estava aplicado/);
    // Os seeds extras são idempotentes: rodam de novo e repõem os dados do pitch.
    assert.ok(queries2.some((q) => q === readRepo("supabase/seeds/20_reconhecimento.sql")));
  });

  test("cria chaves novas quando o projeto só tem as legadas", async () => {
    const created = [];
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}/api-keys`]: json(
          200,
          REVEALED_KEYS.filter((k) => k.type === "legacy"),
        ),
        [`POST api.supabase.com/v1/projects/${REF}/api-keys`]: ({ body, url }) => {
          created.push({ ...body, reveal: url.searchParams.get("reveal") });
          return json(201, {
            ...body,
            api_key: body.type === "publishable" ? PUBLISHABLE : SECRET,
          });
        },
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--write-env"], t.deps), 0, t.output());
    assert.deepEqual(
      created.map((c) => [c.type, c.reveal]),
      [
        ["publishable", "true"],
        ["secret", "true"],
      ],
    );
    const written = parseEnvText(t.writes[0].content);
    assert.equal(written.get("SUPABASE_SECRET_KEY"), SECRET);
    assertNoSecrets(t.output());
  });

  test("cai para as chaves legadas se não conseguir criar as novas", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}/api-keys`]: json(
          200,
          REVEALED_KEYS.filter((k) => k.type === "legacy"),
        ),
        [`POST api.supabase.com/v1/projects/${REF}/api-keys`]: json(403, { message: "Forbidden" }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--write-env"], t.deps), 0, t.output());
    const written = parseEnvText(t.writes[0].content);
    assert.equal(written.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), LEGACY_ANON);
    assert.equal(written.get("SUPABASE_SECRET_KEY"), LEGACY_SERVICE);
    assert.match(t.output(), /chaves legadas/);
    assert.ok(!t.output().includes(LEGACY_SERVICE));
  });

  test("bucket ausente: aplica o INSERT da migration de storage", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}/storage/buckets`]: json(200, []),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 0, t.output());
    const queries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.ok(queries.some((q) => /^insert into storage\.buckets/i.test(q)));
    assert.match(t.output(), /\[x\] Bucket "avatars" criado/);
  });

  test("endpoint de SQL indisponível: usa supabase db query --linked", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: json(404, {
          message: "Not Found",
        }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`], t.deps), 0, t.output());
    assert.deepEqual(t.cliCalls[2].args, [
      "db",
      "query",
      "--linked",
      "--file",
      "/tmp/simulado/query.sql",
    ]);
  });

  test("Vercel com variáveis recusadas: erro sem vazar valores", async () => {
    const t = makeDeps({
      env: fullEnv({ VERCEL_TOKEN, VERCEL_PROJECT: "artemis-web" }),
      routes: {
        ...supabaseRoutes(),
        ...vercelRoutes({
          "POST api.vercel.com/v10/projects/artemis-web/env": json(201, {
            created: [],
            failed: [
              {
                error: {
                  code: "ENV_CONFLICT",
                  message: "conflito",
                  key: "CRON_SECRET",
                  value: CRON,
                },
              },
            ],
          }),
        }),
      },
    });
    assert.equal(await main([`--site-url=${SITE}`, "--vercel"], t.deps), 1);
    assert.match(t.output(), /ERRO em CRON_SECRET: ENV_CONFLICT conflito/);
    assertNoSecrets(t.output());
  });

  test("Vercel 404: orienta a importar o repositório", async () => {
    const t = makeDeps({
      env: fullEnv({ VERCEL_TOKEN, VERCEL_PROJECT: "artemis-web" }),
      routes: {
        ...supabaseRoutes(),
        ...vercelRoutes({
          "GET api.vercel.com/v9/projects/artemis-web": json(404, {
            error: { message: "not found" },
          }),
        }),
      },
    });
    assert.equal(await main([`--site-url=${SITE}`, "--vercel"], t.deps), 1);
    assert.match(t.output(), /vercel\.com\/new/);
  });

  test("--vercel sem token imprime a lista manual", async () => {
    const t = makeDeps({ env: fullEnv() });
    assert.equal(
      await main([`--site-url=${SITE}`, "--vercel", "--write-env"], t.deps),
      0,
      t.output(),
    );
    assert.match(t.output(), /cadastre à mão/);
    assert.match(t.output(), /SUPABASE_SECRET_KEY \[Secret; Production e Preview\]/);
    assert.match(t.output(), /Os valores estão em \.env\.cloud/);
    assert.equal(t.calls.filter((c) => c.host === "api.vercel.com").length, 0);
  });

  test("arquivo .env fora do .gitignore: recusa antes de qualquer chamada", async () => {
    const t = makeDeps({ env: fullEnv(), gitIgnored: false });
    assert.equal(await main([`--site-url=${SITE}`, "--write-env=.env.cloud"], t.deps), 1);
    assert.match(t.output(), /NÃO está no \.gitignore/);
    assert.equal(t.calls.length, 0);
  });

  test("reaproveita o CRON_SECRET e as outras linhas de um .env existente", async () => {
    const envPath = path.join(ROOT, ".env.cloud");
    const t = makeDeps({
      env: fullEnv(),
      files: { [envPath]: "CRON_SECRET=segredo-que-ja-existia-0123456789\nOUTRA=1\n" },
    });
    assert.equal(await main([`--site-url=${SITE}`, "--write-env"], t.deps), 0, t.output());
    const written = parseEnvText(t.writes[0].content);
    assert.equal(written.get("CRON_SECRET"), "segredo-que-ja-existia-0123456789");
    assert.equal(written.get("OUTRA"), "1");
    assert.ok(!t.output().includes("segredo-que-ja-existia-0123456789"));
  });
});

// -----------------------------------------------------------------------------
// --migrations-via-api (rede que só libera HTTPS)
// -----------------------------------------------------------------------------

const LOCAL_MIGRATIONS = readdirSync(path.join(ROOT, "supabase", "migrations"))
  .filter((f) => /^[0-9]+_.*\.sql$/.test(f))
  .sort();

/** Rota de SQL que simula o histórico do CLI (supabase_migrations.schema_migrations). */
function historyRoute(initialVersions, { tableExists = true, failOn } = {}) {
  const versions = [...initialVersions];
  return ({ body }) => {
    const q = body.query;
    if (q === MIGRATION_HISTORY_EXISTS_SQL) return json(201, [{ present: tableExists }]);
    if (q === MIGRATION_HISTORY_SQL)
      return json(
        201,
        versions.map((version) => ({ version })),
      );
    if (failOn && q.includes(failOn)) return json(400, { message: "syntax error at or near x" });
    const recorded = q.match(
      /insert into supabase_migrations\.schema_migrations .* values \('(\d+)'/,
    );
    if (recorded) versions.push(recorded[1]);
    if (/count\(\*\)/.test(q)) return json(201, [{ areas: 64, categories: 8 }]);
    return json(201, []);
  };
}

describe("migrations por HTTPS: funções puras", () => {
  test("parseMigrationFileName segue o padrão do CLI", () => {
    assert.deepEqual(parseMigrationFileName("20261027120000_extensions.sql"), {
      file: "20261027120000_extensions.sql",
      version: "20261027120000",
      name: "extensions",
    });
    assert.equal(parseMigrationFileName("README.md"), null);
    assert.equal(parseMigrationFileName("sem_versao.sql"), null);
  });

  test("planMigrations: pendentes em ordem, sem as já aplicadas", () => {
    const files = ["3_c.sql", "1_a.sql", "2_b.sql", "notas.txt"];
    assert.deepEqual(
      planMigrations(files, []).pending.map((m) => m.version),
      ["1", "2", "3"],
    );
    assert.deepEqual(
      planMigrations(files, ["1", "2"]).pending.map((m) => m.file),
      ["3_c.sql"],
    );
    assert.deepEqual(planMigrations(files, ["1", "2", "3"]).pending, []);
  });

  test("planMigrations recusa histórico divergente, como o db push", () => {
    assert.match(
      planMigrations(["1_a.sql"], ["1", "9"]).error,
      /não existem em supabase\/migrations: 9/,
    );
    assert.match(
      planMigrations(["1_a.sql", "2_b.sql", "3_c.sql"], ["1", "3"]).error,
      /anteriores à última aplicada \(3\): 2_b\.sql/,
    );
  });

  test("buildMigrationQuery: arquivo + registro no histórico numa só consulta", () => {
    const content = "create table public.t (id int);\n-- fim";
    const q = buildMigrationQuery(content, { version: "20261028130000", name: "artemis_brand's" });
    assert.ok(q.startsWith(content));
    assert.match(q, /\n;\ncreate schema if not exists supabase_migrations;/);
    assert.match(q, /add column if not exists statements text\[\];/);
    assert.match(
      q,
      /insert into supabase_migrations\.schema_migrations \(version, name, statements\) values \('20261028130000', 'artemis_brand''s', array\[\$migration\$create table/,
    );
    assert.doesNotMatch(q, /^\s*(begin|commit)\s*;/im);
  });

  test("dollarQuote escolhe uma etiqueta ausente do conteúdo", () => {
    assert.equal(dollarQuote("x"), "$migration$x$migration$");
    assert.equal(dollarQuote("a $migration$ b"), "$migration_1$a $migration$ b$migration_1$");
  });

  test("buildMigrationQuery recusa BEGIN/COMMIT próprios e versão inválida", () => {
    assert.throws(
      () => buildMigrationQuery("begin;\ncreate table x();\ncommit;", { version: "1", name: "x" }),
      /própria transação/,
    );
    assert.throws(() => buildMigrationQuery("select 1;", { version: "1a", name: "x" }), /inválida/);
    // "begin" dentro de corpo plpgsql não conta
    assert.doesNotThrow(() =>
      buildMigrationQuery(
        "create function f() returns void language plpgsql as $$\nbegin\n  null;\nend;\n$$;",
        {
          version: "1",
          name: "f",
        },
      ),
    );
  });

  test("todas as migrations do repositório podem ir por HTTPS", () => {
    for (const file of LOCAL_MIGRATIONS) {
      const content = readRepo(`supabase/migrations/${file}`);
      assert.doesNotThrow(() => buildMigrationQuery(content, parseMigrationFileName(file)), file);
    }
  });
});

describe("main --migrations-via-api", () => {
  test("projeto novo: aplica todas as migrations por HTTPS, sem o CLI, e registra o histórico", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: historyRoute([], {
          tableExists: false,
        }),
      }),
    });
    const code = await main([`--site-url=${SITE}`, "--migrations-via-api", "--write-env"], t.deps);
    assert.equal(code, 0, t.output());
    assert.equal(t.cliCalls.length, 0);
    const queries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.equal(queries[0], MIGRATION_HISTORY_EXISTS_SQL);
    const migrationQueries = queries.filter((q) =>
      q.includes("insert into supabase_migrations.schema_migrations"),
    );
    assert.equal(migrationQueries.length, LOCAL_MIGRATIONS.length);
    LOCAL_MIGRATIONS.forEach((file, i) => {
      const { version } = parseMigrationFileName(file);
      assert.ok(
        migrationQueries[i].startsWith(readRepo(`supabase/migrations/${file}`).trimEnd()),
        file,
      );
      assert.match(migrationQueries[i], new RegExp(`values \\('${version}'`));
    });
    // Dados de referência só depois de todas as migrations
    const firstReference = queries.findIndex((q) =>
      q.includes("insert into public.research_areas"),
    );
    const lastMigration = queries.lastIndexOf(migrationQueries.at(-1));
    assert.ok(firstReference > lastMigration);
    assert.match(t.output(), /\[x\] Migrations aplicadas por HTTPS \(\d+ novas, 0 já existiam\)/);
    assertNoSecrets(t.output());
  });

  test("reexecução: só aplica as pendentes", async () => {
    const applied = LOCAL_MIGRATIONS.slice(0, -1).map((f) => parseMigrationFileName(f).version);
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: historyRoute(applied),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps), 0, t.output());
    const migrationQueries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query)
      .filter((q) => q.includes("insert into supabase_migrations.schema_migrations"));
    assert.equal(migrationQueries.length, 1);
    assert.match(
      migrationQueries[0],
      new RegExp(parseMigrationFileName(LOCAL_MIGRATIONS.at(-1)).version),
    );
    assert.match(t.output(), /Já aplicadas: \d+\. Pendentes: 1\./);
  });

  test("erro numa migration interrompe com mensagem clara e não segue para o Auth", async () => {
    const failing = LOCAL_MIGRATIONS[1];
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: historyRoute([], {
          failOn: readRepo(`supabase/migrations/${failing}`).slice(0, 200),
        }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps), 1);
    assert.match(
      t.output(),
      new RegExp(`Falha na migration ${failing.replace(".", "\\.")}.*400.*transação desfeita`),
    );
    assert.equal(t.calls.filter((c) => c.method === "PATCH").length, 0);
  });

  test("histórico divergente: para antes de aplicar qualquer coisa", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: historyRoute([
          "99990101000000",
        ]),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps), 1);
    assert.match(t.output(), /não existem em supabase\/migrations: 99990101000000/);
    const queries = t.calls
      .filter((c) => c.path.endsWith("/database/query"))
      .map((c) => c.body.query);
    assert.deepEqual(queries, [MIGRATION_HISTORY_EXISTS_SQL, MIGRATION_HISTORY_SQL]);
  });

  test("--dry-run com token lê o histórico pelo endpoint somente leitura e não altera nada", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query/read-only`]: historyRoute([]),
      }),
    });
    assert.equal(
      await main([`--site-url=${SITE}`, "--migrations-via-api", "--dry-run"], t.deps),
      0,
      t.output(),
    );
    const posts = t.calls.filter((c) => c.method !== "GET");
    assert.ok(posts.length > 0);
    for (const c of posts) assert.equal(c.path, `/v1/projects/${REF}/database/query/read-only`);
    assert.match(
      t.output(),
      new RegExp(`\\(simulação\\) ${LOCAL_MIGRATIONS[0].replace(".", "\\.")}`),
    );
    assert.equal(t.writes.length, 0);
  });

  test("falha de rede atrás de proxy sugere NODE_USE_ENV_PROXY=1", async () => {
    const t = makeDeps({ env: fullEnv({ HTTPS_PROXY: "http://127.0.0.1:9999" }) });
    t.deps.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    assert.equal(await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps), 1);
    assert.match(t.output(), /falha de rede.*NODE_USE_ENV_PROXY=1/);
  });
});

// -----------------------------------------------------------------------------
// Revisão: flags booleanas, tokens escopados, CLI multiplataforma e ponto de entrada
// -----------------------------------------------------------------------------

describe("revisão", () => {
  test("flags booleanas recusam valor (--with-demo-seed=false não liga o seed de demonstração)", () => {
    const a = parseArgs([`--site-url=${SITE}`, "--with-demo-seed=false", "--dry-run=0"]);
    assert.equal(a.withDemoSeed, false);
    assert.equal(a.dryRun, false);
    assert.equal(a.errors.length, 2);
    assert.match(a.errors[0], /--with-demo-seed não aceita valor/);
  });

  test("main: --with-demo-seed=false sai com código 2 sem rede nem CLI", async () => {
    const t = makeDeps({ env: fullEnv() });
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed=false"], t.deps), 2);
    assert.equal(t.calls.length, 0);
    assert.equal(t.cliCalls.length, 0);
  });

  test("403 de token escopado lista as permissões que faltam", () => {
    assert.deepEqual(missingPermissions({ missing_permissions: ["api_keys_secrets_read"] }), [
      "api_keys_secrets_read",
    ]);
    assert.deepEqual(
      missingPermissions({ error: { missing_permissions: [{ name: "auth_config_write" }] } }),
      ["auth_config_write"],
    );
    assert.deepEqual(missingPermissions({ message: "Forbidden" }), []);
    const msg = describeSupabaseError(
      new HttpError({
        status: 403,
        data: { message: "Forbidden", missing_permissions: ["database_write"] },
        method: "POST",
        url: "https://api.supabase.com/v1/projects/x/database/query",
      }),
      "Falha",
    );
    assert.match(msg, /403.*Faltam no token: database_write.*README/);
  });

  test("main: 403 ao revelar as chaves aponta as permissões do token", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`GET api.supabase.com/v1/projects/${REF}/api-keys`]: json(403, {
          message: "Forbidden",
          missing_permissions: ["secrets:read"],
        }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--write-env"], t.deps), 1);
    assert.match(
      t.output(),
      /chaves da API: sem permissão \(403\)\. Faltam no token: secrets:read/,
    );
    assert.equal(t.writes.length, 0);
    assertNoSecrets(t.output());
  });

  test("buildCliInvocation: CLI do projeto via node, sem shell, em qualquer sistema", () => {
    const entry = path.join(
      "C:\\Users\\Maria Silva\\app",
      "node_modules",
      "supabase",
      "dist",
      "supabase.js",
    );
    for (const platform of ["linux", "darwin", "win32"]) {
      const inv = buildCliInvocation(["db", "query", "--file", "C:\\Users\\Maria Silva\\q.sql"], {
        platform,
        cliEntry: entry,
        execPath: "/usr/bin/node",
      });
      assert.equal(inv.command, "/usr/bin/node");
      assert.equal(inv.shell, false);
      assert.deepEqual(inv.args, [entry, "db", "query", "--file", "C:\\Users\\Maria Silva\\q.sql"]);
    }
  });

  test("buildCliInvocation: sem o CLI local, npx (no Windows com aspas para o cmd.exe)", () => {
    assert.deepEqual(buildCliInvocation(["link", "--project-ref", REF], { platform: "linux" }), {
      command: "npx",
      args: ["supabase", "link", "--project-ref", REF],
      shell: false,
    });
    const win = buildCliInvocation(
      ["db", "query", "--linked", "--file", "C:\\Users\\Maria Silva\\q.sql"],
      {
        platform: "win32",
      },
    );
    assert.equal(win.shell, true);
    assert.deepEqual(win.args, []);
    assert.equal(
      win.command,
      'npx.cmd supabase db query --linked --file "C:\\Users\\Maria Silva\\q.sql"',
    );
  });

  test("resolveLocalSupabaseCli acha o launcher do pacote supabase instalado", () => {
    const entry = resolveLocalSupabaseCli(ROOT);
    if (!existsSync(path.join(ROOT, "node_modules", "supabase", "package.json"))) {
      assert.equal(entry, null);
      return;
    }
    assert.ok(entry && existsSync(entry), String(entry));
    assert.equal(resolveLocalSupabaseCli(path.join(os.tmpdir(), "nao-existe-xyz")), null);
  });

  test("migration sem resposta da API (rede/timeout): não afirma que nada foi aplicado", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [`POST api.supabase.com/v1/projects/${REF}/database/query`]: historyRoute([], {
          tableExists: false,
        }),
      }),
    });
    const realFetch = t.deps.fetch;
    t.deps.fetch = async (url, init) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      if (String(body.query ?? "").includes("insert into supabase_migrations.schema_migrations")) {
        throw new TypeError("fetch failed");
      }
      return realFetch(url, init);
    };
    assert.equal(await main([`--site-url=${SITE}`, "--migrations-via-api"], t.deps), 1);
    assert.match(t.output(), /pode ter sido aplicada ou não/);
    assert.doesNotMatch(t.output(), /transação desfeita/);
  });

  test("o script roda quando chamado direto, inclusive por um caminho com symlink", () => {
    const script = fileURLToPath(new URL("./setup-supabase-cloud.mjs", import.meta.url));
    const run = (file) =>
      spawnSync(process.execPath, [file, "--help"], {
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });
    const direct = run(script);
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /--site-url/);
    if (process.platform === "win32") return;
    const dir = mkdtempSync(path.join(os.tmpdir(), "setup-link-"));
    try {
      const link = path.join(dir, "deploy");
      symlinkSync(path.dirname(script), link, "dir");
      const viaLink = run(path.join(link, "setup-supabase-cloud.mjs"));
      assert.equal(viaLink.status, 0, viaLink.stderr);
      assert.match(viaLink.stdout, /--site-url/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("repoNameFromRemoteUrl entende https e ssh", () => {
    assert.equal(
      repoNameFromRemoteUrl("https://github.com/dona/Hackathon-Repo.git\n"),
      "hackathon-repo",
    );
    assert.equal(repoNameFromRemoteUrl("git@github.com:dona/repo.git"), "repo");
    assert.equal(repoNameFromRemoteUrl("https://github.com/dona/repo/"), "repo");
    assert.equal(repoNameFromRemoteUrl(""), null);
  });

  test("Vercel sem VERCEL_PROJECT: tenta o nome do package.json e depois o do repositório", async () => {
    const t = makeDeps({
      env: fullEnv({ VERCEL_TOKEN }),
      routes: {
        ...supabaseRoutes(),
        "GET api.vercel.com/v9/projects/artemis": json(404, { error: { message: "not found" } }),
        "GET api.vercel.com/v9/projects/meu-repo": json(200, { id: "prj_9", name: "meu-repo" }),
        "POST api.vercel.com/v10/projects/meu-repo/env": ({ body }) =>
          json(201, { created: body, failed: [] }),
      },
    });
    t.deps.gitRepoName = () => "meu-repo";
    assert.equal(await main([`--site-url=${SITE}`, "--vercel"], t.deps), 0, t.output());
    assert.ok(t.calls.some((c) => c.method === "POST" && c.path === "/v10/projects/meu-repo/env"));

    const explicit = makeDeps({
      env: fullEnv({ VERCEL_TOKEN, VERCEL_PROJECT: "artemis" }),
      routes: {
        ...supabaseRoutes(),
        "GET api.vercel.com/v9/projects/artemis": json(404, { error: { message: "not found" } }),
      },
    });
    explicit.deps.gitRepoName = () => "meu-repo";
    assert.equal(await main([`--site-url=${SITE}`, "--vercel"], explicit.deps), 1);
    assert.match(explicit.output(), /tentei: artemis\)/);
  });
});

// -----------------------------------------------------------------------------
// --with-demo-seed: a senha pública do seed é trocada por senhas aleatórias
// -----------------------------------------------------------------------------

const QUERY_ROUTE = `POST api.supabase.com/v1/projects/${REF}/database/query`;
const ADMIN_ID = DEMO_ROWS.find((r) => r.email.startsWith("admin@")).id;
const MODERACAO_ID = DEMO_ROWS.find((r) => r.email.startsWith("moderacao@")).id;
const ROTATION_MESSAGE =
  "Senhas das contas de demonstração trocadas (4 contas); as da equipe (admin@ e moderacao@) estão em .env.cloud.";

const sqlQueries = (t) =>
  t.calls.filter((c) => c.path.endsWith("/database/query")).map((c) => c.body.query);

/** Nenhuma senha gerada na saída, nos arquivos temporários do CLI nem fora do SQL da troca. */
function assertPasswordsContained(t) {
  assert.ok(t.passwords.length > 0, "o teste precisa de senhas geradas");
  const text = t.output();
  for (const pw of t.passwords) {
    assert.ok(!text.includes(pw), "a saída vazou uma senha de demonstração");
    for (const content of t.tempFiles)
      assert.ok(!content.includes(pw), "senha num arquivo temporário");
    for (const c of t.cliCalls) {
      assert.ok(!JSON.stringify(c.args).includes(pw), "senha na linha de comando do CLI");
      assert.ok(!Object.values(c.env ?? {}).includes(pw), "senha no ambiente do CLI");
    }
    for (const c of t.calls) {
      if (!JSON.stringify(c.body ?? "").includes(pw)) continue;
      assert.equal(`${c.method} ${c.host}${c.path}`, QUERY_ROUTE, "senha fora do SQL da troca");
      assert.ok(isRotationQuery(c.body.query), "senha fora do SQL da troca");
    }
  }
}

describe("senhas das contas de demonstração: funções puras", () => {
  test("defaultRandomToken: node:crypto, base64url, 32 caracteres, nunca repete", () => {
    const values = new Set(Array.from({ length: 50 }, () => defaultRandomToken()));
    assert.equal(values.size, 50);
    for (const v of values) {
      assert.match(v, /^[A-Za-z0-9_-]{32}$/);
      assert.equal(assertSafeDemoPassword(v), v);
    }
  });

  test("assertSafeDemoPassword recusa o que não for base64url com 20+ caracteres, sem ecoar o valor", () => {
    const bad = [
      "x".repeat(19),
      `${"x".repeat(24)}'`,
      `${"x".repeat(24)}\\`,
      `$x$${"x".repeat(24)}`,
      `${"x".repeat(12)} ${"x".repeat(12)}`,
      `${"x".repeat(24)};--`,
      `${"x".repeat(24)}\n`,
      undefined,
      42,
    ];
    for (const value of bad) {
      assert.throws(
        () => assertSafeDemoPassword(value),
        (e) => {
          assert.match(e.message, /base64url/);
          if (typeof value === "string") assert.ok(!e.message.includes(value));
          return true;
        },
      );
    }
  });

  test("planDemoPasswordRotation: uma senha por conta, equipe separada, nada fora do domínio fictício", () => {
    let n = 0;
    const next = () => `FAKE0senha0${String(++n).padStart(2, "0")}${"k".repeat(12)}`;
    const plan = planDemoPasswordRotation(
      [...DEMO_ROWS, { id: DEMO_ROWS[0].id.toUpperCase(), email: DEMO_ROWS[0].email }],
      next,
    );
    assert.equal(plan.accounts.length, DEMO_ROWS.length, "id repetido só conta uma vez");
    assert.equal(new Set(plan.accounts.map((a) => a.password)).size, DEMO_ROWS.length);
    assert.deepEqual(
      plan.staff.map((s) => [s.envPrefix, s.account?.id]),
      [
        ["DEMO_ADMIN", ADMIN_ID],
        ["DEMO_MODERACAO", MODERACAO_ID],
      ],
    );
    assert.throws(
      () =>
        planDemoPasswordRotation(
          [{ id: "1'; drop table auth.users; --", email: DEMO_ROWS[0].email }],
          next,
        ),
      /id inválido/,
    );
    assert.throws(
      () => planDemoPasswordRotation([{ id: ADMIN_ID, email: "alguem@exemplo.com" }], next),
      /fora de @demo\.cienciadelas\.dev/,
    );
    assert.throws(
      () => planDemoPasswordRotation(DEMO_ROWS, () => "FAKE0senha0igual0xxxxxxxxx"),
      /repetiu/,
    );
    assert.throws(() => planDemoPasswordRotation(DEMO_ROWS, () => "curta"), /base64url/);
    assert.deepEqual(planDemoPasswordRotation(null, next).accounts, []);
  });

  test("buildDemoPasswordRotationQuery: um UPDATE só no domínio fictício, com bcrypt do pgcrypto", () => {
    const accounts = DEMO_ROWS.map((r, i) => ({
      id: r.id,
      password: `FAKE0senha0${i}${"m".repeat(16)}`,
    }));
    const q = buildDemoPasswordRotationQuery(accounts);
    assert.deepEqual(
      rotationPairs(q),
      accounts.map(({ id, password }) => ({ id, password })),
    );
    assert.match(q, /update auth\.users as u\n/);
    assert.match(
      q,
      /set encrypted_password = extensions\.crypt\(n\.senha, extensions\.gen_salt\('bf', 10\)\),/,
    );
    assert.match(q, /where u\.id = n\.id and lower\(u\.email\) like '%@demo\.cienciadelas\.dev'\n/);
    assert.match(q, /select id::text as id from trocadas order by id;\n$/);
    // Uma única instrução (tudo ou nada) e nenhum e-mail ou domínio além do fictício.
    assert.equal(q.split(";").length - 1, 1);
    assert.deepEqual([...new Set(q.match(/@[a-z0-9.-]+/g))], [`@${DEMO_EMAIL_DOMAIN}`]);
    assert.doesNotMatch(q, /delete|insert|drop/i);
  });

  test("buildDemoPasswordRotationQuery recusa id ou senha que poderiam escapar do literal", () => {
    const ok = { id: ADMIN_ID, password: `FAKE0senha0${"m".repeat(16)}` };
    assert.throws(() => buildDemoPasswordRotationQuery([]), /Nenhuma conta/);
    assert.throws(() => buildDemoPasswordRotationQuery([{ ...ok, id: `${ADMIN_ID}'` }]), /Id/);
    assert.throws(
      () => buildDemoPasswordRotationQuery([{ ...ok, id: ADMIN_ID.toUpperCase() }]),
      /Id/,
    );
    assert.throws(
      () =>
        buildDemoPasswordRotationQuery([{ ...ok, password: `${ok.password}'); drop table x; --` }]),
      /base64url/,
    );
    assert.throws(() => buildDemoPasswordRotationQuery([ok, ok]), /repetida/);
  });

  test("listagem e encerramento de sessões ficam no domínio fictício e nas duas contas da equipe", () => {
    assert.match(
      DEMO_ACCOUNTS_SQL,
      /^select id::text as id, lower\(email\) as email from auth\.users where lower\(email\) like '%@demo\.cienciadelas\.dev'/,
    );
    assert.doesNotMatch(DEMO_ACCOUNTS_SQL, /password/);
    assert.equal(
      DEMO_STAFF_SESSIONS_SQL,
      "delete from auth.sessions where user_id in (select id from auth.users where lower(email) in ('admin@demo.cienciadelas.dev', 'moderacao@demo.cienciadelas.dev'));",
    );
    assert.deepEqual(
      DEMO_STAFF_ACCOUNTS.map((s) => s.email),
      ["admin@demo.cienciadelas.dev", "moderacao@demo.cienciadelas.dev"],
    );
    // O seed cria essas contas com esse domínio (e o app usa o mesmo em src/lib/demo/personas.ts).
    const seed = readRepo("supabase/seed.sql");
    for (const { email } of DEMO_STAFF_ACCOUNTS) assert.ok(seed.includes(`'${email}'`), email);
    assert.match(
      readRepo("src/lib/demo/personas.ts"),
      /DEMO_EMAIL_DOMAIN = "demo\.cienciadelas\.dev"/,
    );
  });

  test("demoStaffEnvValues só entrega as contas confirmadas; a Vercel nunca recebe essas variáveis", () => {
    const staff = [
      {
        envPrefix: "DEMO_ADMIN",
        account: { id: ADMIN_ID, email: DEMO_ROWS[0].email, password: "FAKE0a".padEnd(24, "a") },
      },
      {
        envPrefix: "DEMO_MODERACAO",
        account: { id: MODERACAO_ID, email: "m", password: "FAKE0m".padEnd(24, "m") },
      },
    ];
    assert.deepEqual(Object.keys(demoStaffEnvValues(staff, new Set([ADMIN_ID]))), [
      "DEMO_ADMIN_EMAIL",
      "DEMO_ADMIN_PASSWORD",
    ]);
    assert.deepEqual(
      [...LOCAL_ONLY_ENV_KEYS],
      [
        "DEMO_ADMIN_EMAIL",
        "DEMO_ADMIN_PASSWORD",
        "DEMO_MODERACAO_EMAIL",
        "DEMO_MODERACAO_PASSWORD",
      ],
    );
    const vars = buildVercelEnvVars(
      {
        NEXT_PUBLIC_SITE_URL: SITE,
        ...demoStaffEnvValues(staff, new Set([ADMIN_ID, MODERACAO_ID])),
      },
      { DEMO_ADMIN_PASSWORD: "FAKE0do0ambiente0xxxxxxxx" },
    );
    assert.deepEqual(
      vars.map((v) => v.key),
      ["NEXT_PUBLIC_SITE_URL"],
    );
  });

  test("buildConfig: --with-demo-seed sem --write-env é recusado (também na simulação)", () => {
    for (const extra of [[], ["--dry-run"]]) {
      const { errors } = buildConfig(
        parseArgs([`--site-url=${SITE}`, "--with-demo-seed", ...extra]),
        fullEnv(),
      );
      assert.equal(errors.length, 1);
      assert.match(errors[0], /--with-demo-seed precisa de --write-env/);
      assert.match(errors[0], /admin@ e moderacao@/);
    }
    const { errors } = buildConfig(
      parseArgs([`--site-url=${SITE}`, "--with-demo-seed", "--write-env=.env.demo"]),
      fullEnv(),
    );
    assert.deepEqual(errors, []);
  });
});

describe("main --with-demo-seed: troca das senhas", () => {
  test("sem --write-env: recusa antes de qualquer chamada, sem gerar senha", async () => {
    const t = makeDeps({ env: fullEnv() });
    t.deps.randomToken = () => assert.fail("nenhuma senha deveria ser gerada");
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed"], t.deps), 2);
    assert.match(t.output(), /--with-demo-seed precisa de --write-env/);
    assert.equal(t.calls.length, 0);
    assert.equal(t.cliCalls.length, 0);
    assert.equal(t.writes.length, 0);
  });

  test("troca TODAS as senhas depois do seed, grava só as da equipe no arquivo e nunca na Vercel", async () => {
    const t = makeDeps({
      env: fullEnv({ VERCEL_TOKEN, VERCEL_PROJECT: "artemis-web" }),
      routes: { ...supabaseRoutes(), ...vercelRoutes() },
    });
    const code = await main(
      [`--site-url=${SITE}`, "--with-demo-seed", "--write-env", "--vercel"],
      t.deps,
    );
    assert.equal(code, 0, t.output());

    // Ordem: seed.sql e seeds extras -> lista das contas -> UPDATE -> sessões da equipe.
    const queries = sqlQueries(t);
    const seedAt = queries.indexOf(readRepo("supabase/seed.sql"));
    const lastExtraAt = queries.lastIndexOf(readRepo("supabase/seeds/40_trajetoria.sql"));
    const listAt = queries.indexOf(DEMO_ACCOUNTS_SQL);
    const rotationAt = queries.findIndex(isRotationQuery);
    const sessionsAt = queries.indexOf(DEMO_STAFF_SESSIONS_SQL);
    assert.ok(seedAt >= 0 && lastExtraAt > seedAt, "seeds aplicados");
    assert.ok(listAt > lastExtraAt, "lista depois dos seeds");
    assert.ok(rotationAt > listAt, "UPDATE depois da lista");
    assert.ok(sessionsAt > rotationAt, "sessões depois do UPDATE");
    assert.equal(queries.filter(isRotationQuery).length, 1, "um único UPDATE");
    assert.ok(
      t.calls.findIndex((c) => c.method === "PATCH") >
        t.calls.findIndex((c) => c.body?.query && isRotationQuery(c.body.query)),
    );

    // O UPDATE cobre exatamente as contas listadas, cada uma com uma senha nova.
    const pairs = rotationPairs(queries[rotationAt]);
    assert.deepEqual(pairs.map((p) => p.id).sort(), DEMO_ROWS.map((r) => r.id).sort());
    assert.deepEqual(pairs.map((p) => p.password).sort(), [...t.passwords].sort());
    assert.equal(new Set(t.passwords).size, DEMO_ROWS.length);
    const passwordOf = (id) => pairs.find((p) => p.id === id).password;

    // Arquivo: gravação de teste antes do seed (sem senha nenhuma), depois gravado logo depois da
    // troca (passo 3) e mantido no passo 7.
    assert.equal(t.writes.length, 3);
    assert.equal(t.writes[0].file, path.join(ROOT, ".env.cloud"));
    assert.equal(t.writes[0].content.trim(), "", "a gravação de teste não leva valores");
    for (const w of t.writes.slice(1)) {
      assert.equal(w.file, path.join(ROOT, ".env.cloud"));
      const written = parseEnvText(w.content);
      assert.equal(written.get("DEMO_ADMIN_EMAIL"), "admin@demo.cienciadelas.dev");
      assert.equal(written.get("DEMO_ADMIN_PASSWORD"), passwordOf(ADMIN_ID));
      assert.equal(written.get("DEMO_MODERACAO_EMAIL"), "moderacao@demo.cienciadelas.dev");
      assert.equal(written.get("DEMO_MODERACAO_PASSWORD"), passwordOf(MODERACAO_ID));
      assert.match(
        w.content,
        /# Senhas da equipe nas contas de demonstração .*NÃO cadastre na Vercel\.\n/,
      );
      // Personas: senha que ninguém recebe.
      for (const r of DEMO_ROWS.filter((r) => !/^(admin|moderacao)@/.test(r.email))) {
        assert.ok(!w.content.includes(passwordOf(r.id)));
      }
    }
    const finalFile = t.writes.at(-1).content;
    assert.equal(parseEnvText(finalFile).get("SUPABASE_SECRET_KEY"), SECRET);
    // O arquivo criado pela gravação de teste (vazio) ainda ganha o cabeçalho de segredos.
    assert.match(finalFile, /^# Variáveis do Supabase Cloud geradas por /);
    assert.match(finalFile, /contém SEGREDOS: não versione/);

    // Vercel: nada das contas da equipe.
    const envCall = t.calls.find((c) => c.path === "/v10/projects/artemis-web/env");
    assert.ok(envCall);
    for (const v of envCall.body) assert.ok(!LOCAL_ONLY_ENV_KEYS.has(v.key), v.key);
    for (const pw of t.passwords) assert.ok(!JSON.stringify(envCall.body).includes(pw));

    // Saída: a frase combinada, sem valores.
    const out = t.output();
    assert.ok(t.stdout.includes(`  ${ROTATION_MESSAGE}`), out);
    assert.match(out, /\[x\] Senhas das contas de demonstração trocadas \(4 contas\)/);
    assert.match(out, /\[x\] Sessões abertas de admin@ e moderacao@ encerradas/);
    assert.match(out, /DEMO_ADMIN_PASSWORD e DEMO_MODERACAO_PASSWORD de \.env\.cloud/);
    assert.doesNotMatch(out, /senha PÚBLICA/);
    assertPasswordsContained(t);
    assertNoSecrets(out);
  });

  test("reexecução com o seed já aplicado: troca as senhas de novo", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({ [QUERY_ROUTE]: queryRoute({ present: true }) }),
    });
    assert.equal(
      await main(
        [`--site-url=${SITE}`, "--with-demo-seed", "--write-env", "--migrations-via-api"],
        t.deps,
      ),
      0,
      t.output(),
    );
    const queries = sqlQueries(t);
    assert.ok(!queries.includes(readRepo("supabase/seed.sql")));
    assert.match(t.output(), /já estava aplicado/);
    assert.equal(queries.filter(isRotationQuery).length, 1);
    assert.ok(t.stdout.includes(`  ${ROTATION_MESSAGE}`));
    assert.equal(
      parseEnvText(t.writes.at(-1).content).get("DEMO_ADMIN_PASSWORD"),
      rotationPairs(queries.find(isRotationQuery)).find((p) => p.id === ADMIN_ID).password,
    );
    assertPasswordsContained(t);
  });

  test("reexecução com o arquivo de antes: as senhas da equipe são substituídas no lugar", async () => {
    const envFile = path.join(ROOT, ".env.cloud");
    const old = "FAKE0senha0antiga0xxxxxxxxxxxxx";
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({ [QUERY_ROUTE]: queryRoute({ present: true }) }),
      files: {
        [envFile]: `# arquivo de uma execução anterior\nCONTACT_EMAIL=equipe@exemplo.dev\nDEMO_ADMIN_EMAIL=admin@demo.cienciadelas.dev\nDEMO_ADMIN_PASSWORD=${old}\n`,
      },
    });
    assert.equal(
      await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
      0,
      t.output(),
    );
    // A gravação de teste devolve o mesmo conteúdo: nada se perde se o passo 3 falhar depois.
    assert.ok(t.writes[0].content.includes(`DEMO_ADMIN_PASSWORD=${old}`));
    const final = t.writes.at(-1).content;
    assert.ok(!final.includes(old), "a senha antiga sai do arquivo");
    assert.equal(final.match(/^DEMO_ADMIN_PASSWORD=/gm).length, 1);
    assert.equal(parseEnvText(final).get("CONTACT_EMAIL"), "equipe@exemplo.dev");
    assert.ok(t.passwords.includes(parseEnvText(final).get("DEMO_ADMIN_PASSWORD")));
    assertPasswordsContained(t);
  });

  test("--dry-run descreve a troca sem gerar nem mostrar senhas", async () => {
    for (const env of [{}, fullEnv()]) {
      const t = makeDeps({ env });
      t.deps.randomToken = () => assert.fail("a simulação não gera senhas");
      const code = await main(
        [`--site-url=${SITE}`, "--dry-run", "--with-demo-seed", "--write-env"],
        t.deps,
      );
      assert.equal(code, 0, t.output());
      assert.match(
        t.output(),
        /\(simulação\) por fim, a senha de cada conta @demo\.cienciadelas\.dev seria trocada por uma senha aleatória \(nenhuma é gerada na simulação\); as de admin@ e moderacao@ iriam só para \.env\.cloud/,
      );
      assert.doesNotMatch(t.output(), /Senhas das contas de demonstração trocadas/);
      assert.equal(t.writes.length, 0);
      assert.equal(t.calls.filter((c) => c.method !== "GET").length, 0);
    }
  });

  test("falha na troca: código 1, aviso claro, nada gravado e senha mascarada mesmo se a API ecoar o SQL", async () => {
    // 404: a troca nunca cai para o CLI (que gravaria o SQL num arquivo temporário).
    // 400: a mensagem do Postgres ecoa o começo do SQL, com a primeira senha.
    // 503: sem confirmação (depois das novas tentativas, sempre com o MESMO SQL).
    for (const status of [404, 400, 503]) {
      const t = makeDeps({
        env: fullEnv(),
        routes: supabaseRoutes({
          [QUERY_ROUTE]: queryRoute({
            override: ({ body }) =>
              isRotationQuery(body.query)
                ? json(status, { message: `erro perto de ${body.query.slice(0, 300)}` })
                : null,
          }),
        }),
      });
      assert.equal(
        await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
        1,
      );
      const out = t.output();
      assert.match(out, /Falha ao trocar as senhas das contas de demonstração/);
      assert.match(out, /podem continuar com a senha PÚBLICA do seed: rode o script de novo/);
      assert.match(out, /\[ \] Trocar as senhas das contas de DEMONSTRAÇÃO/);
      if (status === 400) {
        assert.match(out, /respondeu 400: erro perto de -- Troca as senhas/);
        assert.match(
          out,
          new RegExp(`::uuid, '\\*\\*\\*\\*\\(${t.passwords[0].length} caracteres\\)'`),
        );
      }
      if (status === 404) {
        assert.match(
          out,
          /o endpoint \/database\/query respondeu 404\. A troca de senhas não usa o CLI/,
        );
        assert.doesNotMatch(out, /projeto não encontrado/);
      }
      if (status === 503) {
        assert.match(out, /Sem confirmação da API: a troca pode ter sido feita ou não/);
        const sent = sqlQueries(t).filter(isRotationQuery);
        assert.equal(sent.length, 4, "1 envio + 3 novas tentativas");
        assert.equal(new Set(sent).size, 1, "as novas tentativas repetem as mesmas senhas");
      } else {
        assert.match(out, /Nenhuma senha foi trocada\./);
      }
      // Só a gravação de teste (antes do seed), sem nenhuma variável da equipe.
      assert.equal(t.writes.length, 1);
      assert.doesNotMatch(t.writes[0].content, /DEMO_/);
      assert.ok(!t.cliCalls.some((c) => c.args.includes("query")));
      assert.equal(t.tempFiles.length, 0);
      assert.equal(t.calls.filter((c) => c.method === "PATCH").length, 0, "para antes do Auth");
      assertPasswordsContained(t);
    }
  });

  test("seed extra com erro: as senhas são trocadas mesmo assim e os dois erros aparecem", async () => {
    const failing = readRepo("supabase/seeds/20_reconhecimento.sql");
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [QUERY_ROUTE]: queryRoute({
          override: ({ body }) =>
            body.query === failing ? json(400, { message: "erro no seed" }) : null,
        }),
      }),
    });
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps), 1);
    const queries = sqlQueries(t);
    assert.ok(queries.findIndex(isRotationQuery) > queries.indexOf(failing));
    assert.match(t.output(), /Falha ao aplicar o seed de demonstração 20_reconhecimento\.sql/);
    assert.ok(t.stdout.includes(`  ${ROTATION_MESSAGE}`));
    assert.equal(parseEnvText(t.writes.at(-1).content).has("DEMO_ADMIN_PASSWORD"), true);
    assertPasswordsContained(t);
  });

  test("sem as contas da equipe no banco: troca as personas e não grava nada da equipe", async () => {
    const personas = DEMO_ROWS.filter((r) => !/^(admin|moderacao)@/.test(r.email));
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({ [QUERY_ROUTE]: queryRoute({ demoRows: personas }) }),
    });
    assert.equal(
      await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
      0,
      t.output(),
    );
    assert.ok(t.stdout.includes("  Senhas das contas de demonstração trocadas (2 contas)."));
    assert.match(t.output(), /AVISO: a conta admin@demo\.cienciadelas\.dev não existe neste banco/);
    assert.ok(!sqlQueries(t).includes(DEMO_STAFF_SESSIONS_SQL));
    assert.equal(t.writes.length, 2, "gravação de teste + passo 7");
    assert.equal(parseEnvText(t.writes.at(-1).content).has("DEMO_ADMIN_PASSWORD"), false);
    assertPasswordsContained(t);
  });

  test("lista vazia com o seed no banco: falha fechada, nenhuma senha gerada", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({ [QUERY_ROUTE]: queryRoute({ present: true, demoRows: [] }) }),
    });
    t.deps.randomToken = () => assert.fail("sem contas, nenhuma senha");
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps), 1);
    const out = t.output();
    assert.match(out, /veio vazia, mas o seed de demonstração está no banco/);
    assert.match(out, /podem continuar com a senha PÚBLICA do seed/);
    assert.match(out, /\[ \] Trocar as senhas das contas de DEMONSTRAÇÃO/);
    assert.ok(!sqlQueries(t).some(isRotationQuery));
  });

  test("banco sem o seed (dados de referência falharam): nada a trocar, e o erro aparece", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [QUERY_ROUTE]: queryRoute({
          demoRows: [],
          override: ({ body }) =>
            /insert\s+into\s+public\.research_areas/i.test(body.query)
              ? json(400, { message: "erro nos dados de referência" })
              : null,
        }),
      }),
    });
    t.deps.randomToken = () => assert.fail("sem contas, nenhuma senha");
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps), 1);
    const out = t.output();
    assert.match(out, /Nenhuma conta @demo\.cienciadelas\.dev neste banco/);
    assert.match(out, /Falha ao aplicar os dados de referência/);
    assert.ok(!sqlQueries(t).includes(readRepo("supabase/seed.sql")));
    assert.ok(!sqlQueries(t).some(isRotationQuery));
  });

  test("sessões da equipe não encerradas: só avisa (as senhas já foram trocadas)", async () => {
    const t = makeDeps({
      env: fullEnv(),
      routes: supabaseRoutes({
        [QUERY_ROUTE]: queryRoute({
          override: ({ body }) =>
            body.query === DEMO_STAFF_SESSIONS_SQL
              ? json(403, { message: "permission denied" })
              : null,
        }),
      }),
    });
    assert.equal(
      await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
      0,
      t.output(),
    );
    assert.match(
      t.output(),
      /AVISO: não consegui encerrar as sessões abertas de admin@ e moderacao@/,
    );
    assert.match(t.output(), /\[ \] Encerrar as sessões abertas de admin@ e moderacao@/);
    assert.ok(t.stdout.includes(`  ${ROTATION_MESSAGE}`));
    assertPasswordsContained(t);
  });

  test("arquivo sem permissão de gravação: para antes do seed, sem trocar nem gerar senha", async () => {
    const t = makeDeps({ env: fullEnv() });
    t.deps.writeText = async () => {
      throw Object.assign(new Error("permissão negada"), { code: "EACCES" });
    };
    t.deps.randomToken = () => assert.fail("nenhuma senha deveria ser gerada");
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps), 1);
    const out = t.output();
    assert.match(
      out,
      /Não consegui gravar \.env\.cloud \(EACCES\), o arquivo que recebe as senhas novas de admin@ e moderacao@; parei antes do seed de demonstração/,
    );
    const queries = sqlQueries(t);
    assert.ok(!queries.includes(readRepo("supabase/seed.sql")), "seed não aplicado");
    assert.ok(!queries.includes(DEMO_ACCOUNTS_SQL));
    assert.ok(!queries.some(isRotationQuery));
  });

  test("arquivo não gravado depois da troca: erro claro, com como recuperar", async () => {
    const t = makeDeps({ env: fullEnv() });
    const write = t.deps.writeText;
    t.deps.writeText = async (file, content) => {
      if (content.includes("DEMO_ADMIN_PASSWORD")) {
        throw Object.assign(new Error("sem espaço"), { code: "ENOSPC" });
      }
      return write(file, content);
    };
    assert.equal(await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps), 1);
    const out = t.output();
    assert.match(
      out,
      /foram trocadas \(a senha pública não vale mais nelas\), mas não consegui gravar \.env\.cloud \(ENOSPC\): ninguém tem as senhas novas de admin@ e moderacao@\. Corrija o problema .* e rode o script de novo/,
    );
    assert.match(out, /\[ \] Gravar as senhas novas de admin@ e moderacao@/);
    assert.doesNotMatch(out, /\[ \] Trocar as senhas das contas de DEMONSTRAÇÃO/);
    // O checklist não manda procurar no arquivo uma senha que não foi gravada.
    assert.doesNotMatch(out, /Para entrar como admin@/);
    assertPasswordsContained(t);
  });

  test("eco do SQL cortado no meio de uma senha: nenhum pedaço dela aparece", async () => {
    // Senhas distintas e sem prefixo comum (as falsas do makeDeps compartilham um prefixo).
    const token = (i) => createHash("sha256").update(`senha-${i}`).digest("base64url").slice(0, 32);
    const prefix = "Failed to run sql query: ERROR:  42601: erro\nLINE 4: ";
    for (let cut = 140; cut <= 360; cut += 9) {
      let n = 0;
      const generated = [];
      const t = makeDeps({
        env: fullEnv(),
        routes: supabaseRoutes({
          [QUERY_ROUTE]: queryRoute({
            override: ({ body }) =>
              isRotationQuery(body.query)
                ? json(400, { message: `${prefix}${body.query.slice(0, cut)}` })
                : null,
          }),
        }),
      });
      t.deps.randomToken = () => {
        const v = token(++n);
        generated.push(v);
        return v;
      };
      assert.equal(
        await main([`--site-url=${SITE}`, "--with-demo-seed", "--write-env"], t.deps),
        1,
      );
      const out = t.output();
      assert.match(out, /respondeu 400: Failed to run sql query/);
      for (const pw of generated) {
        for (let i = 0; i + 6 <= pw.length; i++) {
          assert.ok(!out.includes(pw.slice(i, i + 6)), `corte ${cut}: pedaço de senha na saída`);
        }
      }
    }
  });
});

describe("createRedactor: pedaços de senhas geradas", () => {
  test("mascara o valor inteiro e pedaços dele, sem mexer no resto do texto", () => {
    const redact = createRedactor();
    const pw = "Zx9_kLmN0pQrStUvWxYz-AbCdEfGhIj";
    redact.addWithFragments(pw);
    assert.equal(redact(`a '${pw}' b`), `a '****(${pw.length} caracteres)' b`);
    // Cortado no fim (limite de 400 caracteres), no começo (contexto "...") e no meio.
    assert.equal(redact(`x '${pw.slice(0, 11)}`), "x '****(11 caracteres)");
    assert.equal(redact(`...${pw.slice(9)}', y`), `...****(${pw.length - 9} caracteres)', y`);
    assert.equal(redact(`(${pw.slice(5, 11)})`), "(****(6 caracteres))");
    // Grudado em outros caracteres do mesmo alfabeto: a janela de 6 ainda pega.
    assert.equal(redact(`abc${pw.slice(0, 8)}`), "****(11 caracteres)");
    // Menos de 6 caracteres não é mascarado (não revela nada útil) nem estraga o texto em volta.
    assert.equal(redact(`(${pw.slice(5, 10)})`), `(${pw.slice(5, 10)})`);
    // Texto comum continua igual (inclusive UUIDs e e-mails do domínio fictício).
    const plain =
      "update auth.users set x where id = 'd0000000-0000-4000-8000-000000000001' and admin@demo.cienciadelas.dev";
    assert.equal(redact(plain), plain);
    // add() continua mascarando só o valor inteiro.
    const only = createRedactor();
    only.add(pw);
    assert.equal(only(pw.slice(0, 11)), pw.slice(0, 11));
  });
});
