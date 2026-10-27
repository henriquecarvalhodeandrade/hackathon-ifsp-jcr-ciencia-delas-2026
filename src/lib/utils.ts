import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge configurado com os tokens do design system, para que classes
 * customizadas (text-display, rounded-card, shadow-raised...) sejam mescladas
 * corretamente em vez de confundidas com cores.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display"],
      radius: ["badge", "control", "card", "dialog", "pill"],
      shadow: ["card", "raised", "overlay"],
      font: ["display", "sans", "serif", "mono"],
      animate: ["fade-in", "pop-in", "slide-in-right", "twinkle"],
      ease: ["out-soft"],
    },
  },
});

/** Junta classes condicionalmente e resolve conflitos do Tailwind (a última vence). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const LOCALE = "pt-BR";
const TIME_ZONE = "America/Sao_Paulo";

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/**
 * Data em pt-BR no fuso de São Paulo. Padrão: "27 de out. de 2026".
 * Passe opções do Intl para outros formatos, ex.: { dateStyle: "long" } → "27 de outubro de 2026".
 */
export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(value);
  if (!isValidDate(d)) return "";
  const opts: Intl.DateTimeFormatOptions = options ?? { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts }).format(d);
}

/** Data e hora curtas: "27/10/2026, 14:05". */
export function formatDateTime(value: DateInput): string {
  return formatDate(value, { dateStyle: "short", timeStyle: "short" });
}

/** Valor ISO para o atributo dateTime de <time>. */
export function toIsoString(value: DateInput): string {
  const d = toDate(value);
  return isValidDate(d) ? d.toISOString() : "";
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

/**
 * Tempo relativo em pt-BR: "agora mesmo", "há 5 minutos", "ontem", "em 2 dias".
 * `now` pode ser injetado (útil em testes).
 */
export function formatRelativeTime(value: DateInput, now: DateInput = Date.now()): string {
  const d = toDate(value);
  if (!isValidDate(d)) return "";
  const diffSeconds = Math.round((d.getTime() - toDate(now).getTime()) / 1000);
  if (Math.abs(diffSeconds) < 45) return "agora mesmo";
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return rtf.format(Math.round(diffSeconds / 60), "minute");
}

/** Número em pt-BR: 12345 → "12.345". Use { notation: "compact" } para "12 mil". */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE, options).format(value);
}

/** Número compacto: 1520 → "1,5 mil". */
export function formatCompactNumber(value: number): string {
  return formatNumber(value, { notation: "compact", maximumFractionDigits: 1 });
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von"]);

/** Iniciais para avatar: "Ana Maria da Silva" → "AS". Ignora partículas (da, de, dos...). */
export function initials(name: string | null | undefined, max = 2): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((p) => p && !NAME_PARTICLES.has(p.toLowerCase()));
  if (parts.length === 0) return "?";
  const picked = parts.length <= max ? parts : [...parts.slice(0, max - 1), parts[parts.length - 1]];
  return picked
    .map((p) => p[0]!.toLocaleUpperCase(LOCALE))
    .join("")
    .slice(0, max);
}

/** Remove acentos/diacríticos: "Ciência" → "Ciencia". */
export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Slug para URLs: "Ciência & Inovação!" → "ciencia-inovacao". */
export function slugify(text: string): string {
  return removeAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Corta o texto em `n` caracteres (sem quebrar palavra quando possível) e adiciona "…". */
export function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  const slice = text.slice(0, Math.max(0, n - 1));
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > n * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Plural simples em pt-BR com o número formatado.
 * pluralize(1, "voto") → "1 voto" · pluralize(3, "voto") → "3 votos"
 * pluralize(2, "pesquisadora", "pesquisadoras") · pluralize(0, "papel", "papéis") → "0 papéis"
 * Use { withCount: false } para só a palavra.
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  options: { withCount?: boolean } = {},
): string {
  const { withCount = true } = options;
  const word = Math.abs(count) === 1 ? singular : (plural ?? `${singular}s`);
  return withCount ? `${formatNumber(count)} ${word}` : word;
}

/** Hash determinístico (FNV-1a + finalizador) — usado para escolher cores de avatar. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // finalizador (murmur3) para espalhar bem os bits baixos — usados com módulo
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Verdadeiro para URLs absolutas http(s) ou relativas ao protocolo ("//host/...") — saem do site. */
export function isExternalUrl(href: string | undefined | null): boolean {
  return Boolean(href && /^(https?:)?\/\//i.test(href.trim()));
}
