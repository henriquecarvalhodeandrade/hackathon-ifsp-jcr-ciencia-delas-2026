/**
 * Regras de apresentação do feed (puras, sem rede nem banco — cobertas por testes): rótulos,
 * abas, cursor da paginação, textos de contagem e o ajuste de quebras de linha do Markdown.
 */
import { CAREER_STAGES, type CareerStage } from "@/lib/constants";
import { pluralize } from "@/lib/utils";
import { POST_KINDS, isPostKind, type PostKind } from "./schema";

// ---------------------------------------------------------------------------
// Tipos de publicação
// ---------------------------------------------------------------------------

export const POST_KIND_LABELS: Record<PostKind, string> = {
  update: "Atualização",
  project: "Projeto",
  achievement: "Conquista",
  publication: "Publicação",
  event: "Evento",
};

export const POST_KIND_OPTIONS = POST_KINDS.map((value) => ({
  value,
  label: POST_KIND_LABELS[value],
}));

export function postKindLabel(kind: string): string {
  return isPostKind(kind) ? POST_KIND_LABELS[kind] : POST_KIND_LABELS.update;
}

/** Subconjunto das variantes de <Badge> (mantém este módulo sem dependência de UI). */
export type KindTone = "neutral" | "primary" | "secondary" | "accent" | "info";

/** O âmbar (accent) fica só para conquistas: é onde há algo para celebrar (docs/02 §1). */
const KIND_TONE: Record<PostKind, KindTone> = {
  update: "neutral",
  project: "primary",
  achievement: "accent",
  publication: "secondary",
  event: "info",
};

export function postKindTone(kind: string): KindTone {
  return isPostKind(kind) ? KIND_TONE[kind] : "neutral";
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

/** Tipos de item do portfólio (enum `portfolio_kind`, docs/18 §2.2). */
const PORTFOLIO_KIND_LABELS: Record<string, string> = {
  article: "Artigo",
  project: "Projeto",
  presentation: "Apresentação",
  poster: "Pôster",
  thesis: "Tese ou dissertação",
  award: "Prêmio",
  course: "Curso",
  other: "Outro",
};

export function portfolioKindLabel(kind: string): string {
  return PORTFOLIO_KIND_LABELS[kind] ?? "Portfólio";
}

// ---------------------------------------------------------------------------
// Abas (?aba=)
// ---------------------------------------------------------------------------

export const FEED_TABS = ["todas", "seguindo"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export const FEED_TAB_LABELS: Record<FeedTab, string> = {
  todas: "Todas",
  seguindo: "Seguindo",
};

type ParamValue = string | string[] | undefined;

function first(value: ParamValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Aba pedida na URL; qualquer outro valor cai em "todas" (o padrão). */
export function parseFeedTab(value: ParamValue): FeedTab {
  const v = first(value);
  return (FEED_TABS as readonly string[]).includes(v) ? (v as FeedTab) : "todas";
}

// ---------------------------------------------------------------------------
// Paginação por cursor (?antes=<created_at>)
// ---------------------------------------------------------------------------

export const FEED_PAGE_SIZE = 20;

/**
 * Data/hora ISO 8601 com fuso: "2026-10-28T12:34:56.123456Z" ou "…+00:00". Guardamos o texto
 * exato que o PostgREST devolve (microssegundos inclusive): passar por `Date` cortaria para
 * milissegundos e o `lt` pularia publicações do mesmo milissegundo.
 */
const CURSOR_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/;

/** Cursor vindo da URL; null quando ausente ou inválido (aí mostramos as mais recentes). */
export function parseCursor(raw: ParamValue): string | null {
  const value = first(raw).trim();
  if (!value || value.length > 40 || !CURSOR_PATTERN.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/** created_at do banco → valor do cursor ("+00:00" vira "Z", mais limpo na URL). */
export function toCursor(createdAt: string): string {
  return createdAt.replace(/\+00(?::?00)?$/, "Z");
}

/** Link do feed preservando a aba (a padrão "todas" não entra na URL). */
export function feedHref({
  tab = "todas",
  before,
}: { tab?: FeedTab; before?: string | null } = {}) {
  const params = new URLSearchParams();
  if (tab !== "todas") params.set("aba", tab);
  if (before) params.set("antes", before);
  const query = params.toString();
  return query ? `/feed?${query}` : "/feed";
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Monta a página a partir de `pageSize + 1` linhas (ordem created_at desc). Havendo a linha
 * extra, existe mais e o cursor é o created_at da última mostrada.
 *
 * Empate na borda (a última mostrada e a extra com o MESMO created_at — ex.: linhas de seed
 * gravadas no mesmo `now()`): o `lt` da próxima página pularia as empatadas. Por isso quem
 * consulta busca o grupo inteiro daquele instante (`tied`) e ele entra todo nesta página.
 */
export function paginate<T extends { created_at: string }>(
  rows: readonly T[],
  pageSize: number,
  tied?: readonly T[],
): Page<T> {
  if (rows.length <= pageSize) return { items: [...rows], nextCursor: null };
  const items = rows.slice(0, pageSize);
  const boundary = items[items.length - 1]!.created_at;
  if (tied && tied.length > 0) {
    const seen = new Set<unknown>();
    const merged: T[] = [];
    for (const row of [...items.filter((r) => r.created_at !== boundary), ...tied]) {
      const key = (row as { id?: unknown }).id ?? row;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    return { items: merged, nextCursor: toCursor(boundary) };
  }
  return { items, nextCursor: toCursor(boundary) };
}

/** created_at da borda quando há empate entre a última linha da página e a extra. */
export function boundaryTie(
  rows: readonly { created_at: string }[],
  pageSize: number,
): string | null {
  if (rows.length <= pageSize) return null;
  const last = rows[pageSize - 1]!.created_at;
  return rows[pageSize]!.created_at === last ? last : null;
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** Editada = atualizada mais de 1 s depois de criada (o insert grava os dois no mesmo instante). */
export function isEdited(createdAt: string, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 1000;
}

export function likesLabel(count: number): string {
  return pluralize(count, "curtida");
}

export function commentsLabel(count: number): string {
  return pluralize(count, "comentário", "comentários");
}

export function careerStageLabel(stage: string | null | undefined): string | null {
  return stage && stage in CAREER_STAGES ? CAREER_STAGES[stage as CareerStage].label : null;
}

/**
 * Quebras de linha simples viram quebras de verdade. No Markdown, um Enter sozinho junta as
 * linhas no mesmo parágrafo — num feed, quem escreve espera ver a linha nova. Acrescentamos dois
 * espaços (quebra "dura" do CommonMark) no fim das linhas seguidas de outra linha com texto,
 * sem mexer em blocos de código cercados (``` ou ~~~).
 */
export function preserveLineBreaks(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let fence: { char: string; size: number } | null = null;
  return lines
    .map((line, index) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        const char = marker[1]![0]!;
        const size = marker[1]!.length;
        if (!fence) fence = { char, size };
        else if (char === fence.char && size >= fence.size && !line.trim().slice(size).trim()) {
          fence = null;
        }
        return line;
      }
      if (fence) return line;
      const next = lines[index + 1];
      if (next === undefined || !line.trim() || !next.trim()) return line;
      if (/ {2,}$|\\$/.test(line)) return line;
      return `${line}  `;
    })
    .join("\n");
}
