import { z } from "zod";
import { pluralize } from "@/lib/utils";

/**
 * Formato de `newsletter_editions.content` (CONTRACT §9, revisto na integração) — leitura
 * tolerante e helpers puros.
 *
 * Privacidade: edições publicadas ficam no arquivo PÚBLICO (anon lê o jsonb pela API), então o
 * conteúdo só leva dados que já são públicos. Mentoras entram como AGREGADO
 * (`mentor_summary`: quantas e de quais áreas), nunca por nome; `mentors` fica sempre vazio
 * (mantido por compatibilidade) e nomes de edições antigas são descartados na leitura.
 *
 * Campos extras opcionais (aditivos ao contrato): `papers[].area_id` e `papers[].area`
 * (nome da área), usados para filtrar inscritas por área e para exibir o selo da área.
 */

export interface NewsletterPaper {
  id: string;
  title: string;
  authors: string[];
  votes: number;
  plain_summary: string | null;
  url: string;
  area_id?: number | null;
  area?: string | null;
}

export interface NewsletterThread {
  id: string;
  title: string;
  category: string;
  replies: number;
  url: string;
}

/** Novas mentoras da semana, só em agregado (nunca nomes). */
export interface NewsletterMentorSummary {
  total: number;
  /** Nomes das áreas de pesquisa delas, das mais frequentes para as menos (no máximo 8). */
  areas: string[];
}

export interface NewsletterStats {
  new_members: number;
  new_papers: number;
  mentorships: number;
}

export interface NewsletterContent {
  papers: NewsletterPaper[];
  threads: NewsletterThread[];
  /** Sempre vazio (compatibilidade com o formato antigo, que trazia nomes). */
  mentors: [];
  mentor_summary: NewsletterMentorSummary;
  stats: NewsletterStats;
}

/** Máximo de áreas listadas no resumo de mentoras. */
export const MENTOR_SUMMARY_MAX_AREAS = 8;

const count = z.coerce.number().int().min(0).catch(0);
const text = (max: number) => z.string().trim().min(1).max(max);

const paperSchema = z.object({
  id: text(64),
  title: text(400),
  authors: z.array(z.string().trim().min(1).max(200)).max(60).catch([]).default([]),
  votes: count.default(0),
  plain_summary: z.string().trim().max(2000).nullable().catch(null).default(null),
  url: z.string().optional(),
  area_id: z.number().int().nullable().optional().catch(null),
  area: z.string().trim().max(160).nullable().optional().catch(null),
});

const threadSchema = z.object({
  id: text(64),
  title: text(400),
  category: z.string().trim().max(160).catch("").default(""),
  replies: count.default(0),
  url: z.string().optional(),
});

const mentorSummarySchema = z.object({
  total: count,
  areas: z
    .array(z.string())
    .catch([])
    .transform((areas) => {
      const clean = areas.map((a) => a.trim()).filter((a) => a.length > 0 && a.length <= 160);
      return [...new Set(clean)].slice(0, MENTOR_SUMMARY_MAX_AREAS);
    }),
});

const statsSchema = z
  .object({
    new_members: count.default(0),
    new_papers: count.default(0),
    mentorships: count.default(0),
  })
  .catch({ new_members: 0, new_papers: 0, mentorships: 0 });

/** Aceita só caminhos internos ("/papers/..."), nunca "//host" nem URLs absolutas/javascript:. */
export function safeInternalPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~%/?=&#+]*$/.test(v) || v.length > 300) return fallback;
  return v;
}

function parseList<T>(raw: unknown, schema: z.ZodType<T>, max = 20): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw.slice(0, max)) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Lê o jsonb da edição sem nunca quebrar a página (itens inválidos são descartados). */
export function parseEditionContent(raw: unknown): NewsletterContent {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const papers = parseList(obj.papers, paperSchema).map((p) => ({
    ...p,
    url: safeInternalPath(p.url, `/papers/${encodeURIComponent(p.id)}`),
  }));
  const threads = parseList(obj.threads, threadSchema).map((t) => ({
    ...t,
    url: safeInternalPath(t.url, `/forum/t/${encodeURIComponent(t.id)}`),
  }));
  const stats = statsSchema.parse(obj.stats ?? {});
  return { papers, threads, mentors: [], mentor_summary: parseMentorSummary(obj), stats };
}

/**
 * Resumo de mentoras. Edições antigas traziam `mentors` com nomes: viram só a contagem (os
 * nomes nunca são lidos).
 */
function parseMentorSummary(obj: Record<string, unknown>): NewsletterMentorSummary {
  const parsed = mentorSummarySchema.safeParse(obj.mentor_summary);
  if (parsed.success) return parsed.data;
  const legacy = Array.isArray(obj.mentors)
    ? obj.mentors.filter((m) => m !== null && typeof m === "object").length
    : 0;
  return { total: Math.min(legacy, 1_000), areas: [] };
}

/** Agrega as novas mentoras (só áreas; nada que identifique alguém). */
export function summarizeMentors(
  mentors: ReadonlyArray<{ areas: readonly string[] }>,
): NewsletterMentorSummary {
  const frequency = new Map<string, number>();
  for (const mentor of mentors) {
    for (const area of new Set(mentor.areas.map((a) => a.trim()).filter(Boolean))) {
      frequency.set(area, (frequency.get(area) ?? 0) + 1);
    }
  }
  const areas = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, MENTOR_SUMMARY_MAX_AREAS)
    .map(([area]) => area);
  return { total: mentors.length, areas };
}

export function isEditionEmpty(content: NewsletterContent): boolean {
  const { stats } = content;
  return (
    content.papers.length === 0 &&
    content.threads.length === 0 &&
    content.mentor_summary.total === 0 &&
    stats.new_members === 0 &&
    stats.new_papers === 0 &&
    stats.mentorships === 0
  );
}

/** Abertura padrão (quando a IA está desligada ou falha): só usa números reais da edição. */
export function fallbackIntro(content: NewsletterContent): string {
  const { papers, threads, mentor_summary: mentors, stats } = content;
  const parts: string[] = [];
  if (papers.length) parts.push(`destacou ${pluralize(papers.length, "paper")} na Vitrine`);
  if (threads.length) parts.push(`movimentou ${pluralize(threads.length, "conversa")} no fórum`);
  if (stats.new_members) {
    parts.push(
      `deu as boas-vindas a ${pluralize(stats.new_members, "nova integrante", "novas integrantes")}`,
    );
  }
  if (mentors.total) {
    parts.push(`ganhou ${pluralize(mentors.total, "nova mentora", "novas mentoras")}`);
  }
  if (stats.mentorships) {
    parts.push(`começou ${pluralize(stats.mentorships, "nova mentoria", "novas mentorias")}`);
  }

  if (parts.length === 0) {
    return mentors.total
      ? "Semana tranquila por aqui, mas a rede segue de portas abertas: conheça mentoras com vagas e aproveite para indicar um paper ou puxar uma conversa no fórum."
      : "Semana tranquila por aqui, mas a ciência delas não para. Que tal indicar um paper de uma pesquisadora que você admira ou puxar uma conversa no fórum?";
  }

  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return `Nesta semana, a comunidade ${list}. Confira os destaques abaixo e compartilhe com quem também faz ciência.`;
}
