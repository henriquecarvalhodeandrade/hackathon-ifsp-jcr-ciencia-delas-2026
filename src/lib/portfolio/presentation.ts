/**
 * Portfólio: tipos de item, limites, ordenação e textos (módulo puro, coberto por testes).
 * Os limites espelham os CHECKs de `portfolio_items` (docs/18 §2.2).
 */

export const PORTFOLIO_KINDS = [
  "article",
  "project",
  "presentation",
  "poster",
  "thesis",
  "award",
  "course",
  "other",
] as const;
export type PortfolioKind = (typeof PORTFOLIO_KINDS)[number];

export const PORTFOLIO_KIND_LABELS: Record<PortfolioKind, string> = {
  article: "Artigo",
  project: "Projeto",
  presentation: "Apresentação",
  poster: "Pôster",
  thesis: "TCC, dissertação ou tese",
  award: "Prêmio",
  course: "Curso",
  other: "Outro",
};

export const PORTFOLIO_KIND_OPTIONS = PORTFOLIO_KINDS.map((value) => ({
  value,
  label: PORTFOLIO_KIND_LABELS[value],
}));

export function isPortfolioKind(value: unknown): value is PortfolioKind {
  return typeof value === "string" && (PORTFOLIO_KINDS as readonly string[]).includes(value);
}

export function portfolioKindLabel(kind: string | null | undefined): string {
  return isPortfolioKind(kind) ? PORTFOLIO_KIND_LABELS[kind] : PORTFOLIO_KIND_LABELS.other;
}

export const PORTFOLIO_LIMITS = {
  titleMin: 3,
  titleMax: 200,
  descriptionMax: 2000,
  urlMax: 500,
  venueMax: 160,
  yearMin: 1950,
  yearMax: 2100,
  tagsMax: 8,
  tagMax: 40,
  /** Itens por pessoa (CD066). */
  itemsMax: 50,
} as const;

// ---------------------------------------------------------------------------
// Ordenação: destacados primeiro, depois ano (mais recente; sem ano no fim), depois criação.
// ---------------------------------------------------------------------------

export interface SortablePortfolioItem {
  id: string;
  pinned: boolean;
  year: number | null;
  created_at: string;
}

export function comparePortfolioItems(a: SortablePortfolioItem, b: SortablePortfolioItem): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  }
  const byCreated = Date.parse(b.created_at) - Date.parse(a.created_at);
  if (byCreated !== 0 && Number.isFinite(byCreated)) return byCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Cópia ordenada (não altera a lista recebida). */
export function sortPortfolioItems<T extends SortablePortfolioItem>(items: readonly T[]): T[] {
  return [...items].sort(comparePortfolioItems);
}

// ---------------------------------------------------------------------------
// Compartilhar no feed
// ---------------------------------------------------------------------------

/** Tipos de publicação do feed (posts.kind, docs/18 §2.4). */
export type FeedPostKind = "update" | "project" | "achievement" | "publication" | "event";

const POST_KIND_BY_PORTFOLIO_KIND: Record<PortfolioKind, FeedPostKind> = {
  article: "publication",
  thesis: "publication",
  poster: "publication",
  presentation: "publication",
  award: "achievement",
  course: "achievement",
  project: "project",
  other: "update",
};

export function postKindForPortfolio(kind: string): FeedPostKind {
  return isPortfolioKind(kind) ? POST_KIND_BY_PORTFOLIO_KIND[kind] : "update";
}

/** Texto da publicação automática: "Adicionei ao meu portfólio: <título>". */
export function portfolioPostBody(title: string): string {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean ? `Adicionei ao meu portfólio: ${clean}` : "Adicionei um item ao meu portfólio.";
}

// ---------------------------------------------------------------------------
// Textos do cartão
// ---------------------------------------------------------------------------

/** "Revista X · 2025" (só o que existir). */
export function portfolioMeta(item: { venue: string | null; year: number | null }): string {
  return [item.venue?.trim() || null, item.year ? String(item.year) : null]
    .filter(Boolean)
    .join(" · ");
}

/** Domínio do link para mostrar ao lado do botão (sem "www."). */
export function linkHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Avisos após uma ação (?aviso=) — só chaves conhecidas, nunca texto vindo da URL.
// ---------------------------------------------------------------------------

export const PORTFOLIO_NOTICE_KEYS = [
  "adicionado",
  "compartilhado",
  "sem-feed",
  "atualizado",
  "apagado",
] as const;
export type PortfolioNoticeKey = (typeof PORTFOLIO_NOTICE_KEYS)[number];

export interface PortfolioNotice {
  variant: "success" | "info" | "warning";
  title: string;
  body: string;
}

const NOTICES: Record<PortfolioNoticeKey, PortfolioNotice> = {
  adicionado: {
    variant: "success",
    title: "Item adicionado ao portfólio",
    body: "Ele já aparece no seu perfil para as membras da Artemis.",
  },
  compartilhado: {
    variant: "success",
    title: "Item adicionado e compartilhado no feed",
    body: "Ele aparece no seu perfil e numa publicação no feed, para quem segue você.",
  },
  "sem-feed": {
    variant: "warning",
    title: "Item adicionado, mas não compartilhado no feed",
    body: "O item está no seu portfólio, mas não conseguimos criar a publicação agora. Você pode compartilhá-lo pelo feed mais tarde.",
  },
  atualizado: {
    variant: "success",
    title: "Item atualizado",
    body: "As mudanças já aparecem no seu perfil.",
  },
  apagado: {
    variant: "info",
    title: "Item apagado",
    body: "Ele saiu do seu portfólio e do seu perfil.",
  },
};

export function parsePortfolioNotice(value: unknown): PortfolioNotice | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (PORTFOLIO_NOTICE_KEYS as readonly string[]).includes(v)
    ? NOTICES[v as PortfolioNoticeKey]
    : null;
}
