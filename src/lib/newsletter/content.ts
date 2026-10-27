import { z } from "zod";
import { pluralize } from "@/lib/utils";

/**
 * Formato de `newsletter_editions.content` (CONTRACT §9) — leitura tolerante e helpers puros.
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

export interface NewsletterMentor {
  id: string;
  full_name: string;
  headline: string | null;
  url: string;
}

export interface NewsletterStats {
  new_members: number;
  new_papers: number;
  mentorships: number;
}

export interface NewsletterContent {
  papers: NewsletterPaper[];
  threads: NewsletterThread[];
  mentors: NewsletterMentor[];
  stats: NewsletterStats;
}

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

const mentorSchema = z.object({
  id: text(64),
  full_name: text(200),
  headline: z.string().trim().max(300).nullable().catch(null).default(null),
  url: z.string().optional(),
});

const statsSchema = z
  .object({ new_members: count.default(0), new_papers: count.default(0), mentorships: count.default(0) })
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
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const papers = parseList(obj.papers, paperSchema).map((p) => ({
    ...p,
    url: safeInternalPath(p.url, `/papers/${encodeURIComponent(p.id)}`),
  }));
  const threads = parseList(obj.threads, threadSchema).map((t) => ({
    ...t,
    url: safeInternalPath(t.url, `/forum/t/${encodeURIComponent(t.id)}`),
  }));
  const mentors = parseList(obj.mentors, mentorSchema).map((m) => ({
    ...m,
    url: safeInternalPath(m.url, `/pesquisadoras/${encodeURIComponent(m.id)}`),
  }));
  const stats = statsSchema.parse(obj.stats ?? {});
  return { papers, threads, mentors, stats };
}

export function isEditionEmpty(content: NewsletterContent): boolean {
  const { stats } = content;
  return (
    content.papers.length === 0 &&
    content.threads.length === 0 &&
    content.mentors.length === 0 &&
    stats.new_members === 0 &&
    stats.new_papers === 0 &&
    stats.mentorships === 0
  );
}

/** Abertura padrão (quando a IA está desligada ou falha): só usa números reais da edição. */
export function fallbackIntro(content: NewsletterContent): string {
  const { papers, threads, mentors, stats } = content;
  const parts: string[] = [];
  if (papers.length) parts.push(`destacou ${pluralize(papers.length, "paper")} na Vitrine`);
  if (threads.length) parts.push(`movimentou ${pluralize(threads.length, "conversa")} no fórum`);
  if (stats.new_members) {
    parts.push(`deu as boas-vindas a ${pluralize(stats.new_members, "nova integrante", "novas integrantes")}`);
  }
  if (stats.mentorships) {
    parts.push(`começou ${pluralize(stats.mentorships, "nova mentoria", "novas mentorias")}`);
  }

  if (parts.length === 0) {
    return mentors.length
      ? "Semana tranquila por aqui, mas a rede segue de portas abertas: conheça mentoras com vagas e aproveite para indicar um paper ou puxar uma conversa no fórum."
      : "Semana tranquila por aqui, mas a ciência delas não para. Que tal indicar um paper de uma pesquisadora que você admira ou puxar uma conversa no fórum?";
  }

  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return `Nesta semana, a comunidade ${list}. Confira os destaques abaixo e compartilhe com quem também faz ciência.`;
}

/** Ids de papers citados na edição (para descobrir as áreas no envio). */
export function editionPaperIds(content: NewsletterContent): string[] {
  return content.papers.map((p) => p.id);
}
