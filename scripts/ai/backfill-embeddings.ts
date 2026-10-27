/**
 * Gera (ou atualiza) os embeddings de TODOS os perfis com onboarding concluído e
 * consentimento de IA que ainda não têm embedding ou cujo texto de pesquisa mudou.
 *
 * Uso (na raiz do projeto):
 *   npx tsx scripts/ai/backfill-embeddings.ts             # gera o que falta
 *   npx tsx scripts/ai/backfill-embeddings.ts --dry-run   # só mostra o que faria
 *   npx tsx scripts/ai/backfill-embeddings.ts --force     # recalcula todos
 *   Opções: --limit=N (máx. de perfis) · --batch=N (textos por chamada, padrão 20)
 *           --rpm=N (textos por minuto, padrão 90) · --no-prune (não apaga embeddings órfãos)
 *
 * Precisa de: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (service role) e GEMINI_API_KEY,
 * lidos do ambiente ou do .env.local. Usa a chave secreta porque precisa ler/gravar o
 * embedding de várias pessoas — rode só na sua máquina ou em CI, nunca no navegador.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { embedWithConfig } from "../../src/lib/ai/engine";
import type { EmbeddingKind } from "../../src/lib/ai/providers/types";
import { env, getEmbeddingConfig, isAdminConfigured } from "../../src/lib/env";
import {
  buildProfileText,
  embeddingKindFor,
  profileEmbeddingHash,
} from "../../src/lib/matching/profile-text";

// ---------------------------------------------------------------------------
// Ambiente e argumentos
// ---------------------------------------------------------------------------

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  // loadEnvFile não sobrescreve variáveis que já existem no ambiente.
  if (existsSync(path)) process.loadEnvFile(path);
}

interface Args {
  dryRun: boolean;
  force: boolean;
  prune: boolean;
  limit: number;
  batch: number;
  rpm: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const num = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(get(name) ?? fallback);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
  };
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    prune: !argv.includes("--no-prune"),
    limit: num("limit", Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER),
    batch: num("batch", 20, 1, 100),
    rpm: num("rpm", 90, 1, 1000),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Leitura paginada (PostgREST devolve no máximo 1000 linhas por vez)
// ---------------------------------------------------------------------------

const PAGE = 1000;

async function fetchAll<T>(
  label: string,
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(`Erro lendo ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

interface ProfileRow {
  id: string;
  full_name: string;
  headline: string | null;
  career_stage: string | null;
  keywords: string[];
  mentorship_topics: string[];
  mentoring_goals: string | null;
  mentoring_offer: string | null;
  is_mentor: boolean;
  ai_consent: boolean;
  onboarded_at: string | null;
}

interface WorkItem {
  profileId: string;
  text: string;
  kind: EmbeddingKind;
  hash: string;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!isAdminConfigured()) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY (no ambiente ou no .env.local).",
    );
    process.exit(1);
  }
  const embedding = getEmbeddingConfig();
  if (!embedding) {
    console.error(
      "Sem GEMINI_API_KEY (ou AI_PROVIDER=none): não há como gerar embeddings. O matching continua funcionando só com heurísticas.",
    );
    process.exit(1);
  }

  const admin = createClient<Database>(env.supabaseUrl!, env.supabaseSecretKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`Modelo de embeddings: ${embedding.model} (${embedding.dimensions} dimensões)`);

  const [areas, profiles, links, existing] = await Promise.all([
    fetchAll("research_areas", (from, to) =>
      admin.from("research_areas").select("id, name").order("id").range(from, to),
    ),
    fetchAll("profiles", (from, to) =>
      admin
        .from("profiles")
        .select(
          "id, full_name, headline, career_stage, keywords, mentorship_topics, mentoring_goals, mentoring_offer, is_mentor, ai_consent, onboarded_at",
        )
        .order("id")
        .range(from, to),
    ),
    fetchAll("profile_research_areas", (from, to) =>
      admin
        .from("profile_research_areas")
        .select("profile_id, area_id")
        .order("profile_id")
        .order("area_id")
        .range(from, to),
    ),
    fetchAll("profile_embeddings", (from, to) =>
      admin
        .from("profile_embeddings")
        .select("profile_id, content_hash, model")
        .order("profile_id")
        .range(from, to),
    ),
  ]);

  const areaName = new Map(areas.map((a) => [Number(a.id), a.name as string]));
  const areasByProfile = new Map<string, string[]>();
  for (const link of links) {
    const name = areaName.get(Number(link.area_id));
    if (!name) continue;
    const list = areasByProfile.get(link.profile_id) ?? [];
    list.push(name);
    areasByProfile.set(link.profile_id, list);
  }
  const existingByProfile = new Map(existing.map((e) => [e.profile_id, e]));

  // 1. O que precisa ser (re)gerado
  const eligible = (profiles as ProfileRow[]).filter((p) => p.onboarded_at && p.ai_consent);
  const work: WorkItem[] = [];
  let unchanged = 0;
  let empty = 0;
  for (const profile of eligible) {
    const text = buildProfileText(profile, areasByProfile.get(profile.id) ?? []);
    if (!text.trim()) {
      empty++;
      continue;
    }
    const kind = embeddingKindFor(profile);
    const hash = await profileEmbeddingHash(text, kind, embedding.model);
    const current = existingByProfile.get(profile.id);
    if (!args.force && current?.content_hash === hash && current.model === embedding.model) {
      unchanged++;
      continue;
    }
    work.push({ profileId: profile.id, text, kind, hash });
  }
  const todo = work.slice(0, args.limit);

  // 2. Embeddings órfãos (sem consentimento ou sem onboarding) — LGPD: apagar.
  const eligibleIds = new Set(eligible.map((p) => p.id));
  const orphans = existing.map((e) => e.profile_id).filter((id) => !eligibleIds.has(id));

  console.log(
    [
      `Perfis: ${profiles.length} · elegíveis (onboarding + consentimento): ${eligible.length}`,
      `Sem mudança: ${unchanged} · sem texto: ${empty} · a gerar: ${todo.length}${work.length > todo.length ? ` (de ${work.length}, --limit)` : ""}`,
      `Embeddings órfãos: ${orphans.length}${args.prune ? "" : " (mantidos: --no-prune)"}`,
    ].join("\n"),
  );

  if (args.dryRun) {
    console.log("--dry-run: nada foi alterado.");
    return;
  }

  if (args.prune && orphans.length > 0) {
    const { error } = await admin.from("profile_embeddings").delete().in("profile_id", orphans);
    if (error) console.warn(`Não foi possível apagar órfãos: ${error.message}`);
    else console.log(`Apagados ${orphans.length} embedding(s) órfão(s).`);
  }

  // 3. Geração em lotes, respeitando ~rpm textos por minuto (conservador para o plano gratuito).
  const msPerText = 60_000 / args.rpm;
  let done = 0;
  let failed = 0;
  for (const kind of ["document", "query"] as const) {
    const items = todo.filter((w) => w.kind === kind);
    for (let i = 0; i < items.length; i += args.batch) {
      const chunk = items.slice(i, i + args.batch);
      const startedAt = Date.now();
      try {
        const { vectors, model } = await embedWithConfig(
          embedding,
          chunk.map((c) => c.text),
          kind,
        );
        const rows = chunk.map((c, idx) => ({
          profile_id: c.profileId,
          embedding: JSON.stringify(vectors[idx]),
          content_hash: c.hash,
          model,
        }));
        const { error } = await admin
          .from("profile_embeddings")
          .upsert(rows, { onConflict: "profile_id" });
        if (error) throw new Error(`upsert: ${error.message}`);
        done += chunk.length;
        console.log(
          `  ✓ ${done}/${todo.length} (${kind === "document" ? "mentoras" : "mentorandas"})`,
        );
      } catch (error) {
        failed += chunk.length;
        console.warn(
          `  ✗ lote de ${chunk.length} falhou: ${error instanceof Error ? error.message.slice(0, 200) : "erro"}`,
        );
      }
      const minInterval = chunk.length * msPerText;
      const elapsed = Date.now() - startedAt;
      const isLast = done + failed >= todo.length;
      if (!isLast && elapsed < minInterval) await sleep(minInterval - elapsed);
    }
  }

  console.log(`Concluído: ${done} gerado(s), ${failed} com falha.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
