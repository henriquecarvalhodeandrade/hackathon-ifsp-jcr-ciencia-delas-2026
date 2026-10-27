/**
 * Calendário das edições (puro, testável).
 *
 * Regra: a edição gerada no instante `now` cobre os 7 dias anteriores (janela móvel) e recebe o
 * rótulo da semana ISO da VÉSPERA, no fuso de São Paulo. Assim o cron de segunda-feira 09:00 (BRT)
 * gera a edição da semana que acabou de terminar (igual ao seed: período segunda→domingo), e
 * qualquer execução repetida na mesma semana reaproveita o mesmo slug (idempotente).
 */

export const NEWSLETTER_TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ZonedDate {
  year: number;
  month: number; // 1–12
  day: number;
}

export interface IsoWeek {
  isoYear: number;
  isoWeek: number;
}

export interface EditionWeek extends IsoWeek {
  /** "2026-s44" — mesmo formato do seed (to_char IYYY-"s"IW). */
  slug: string;
  /** "Boletim Delas — semana 44 de 2026". */
  title: string;
  /** Datas (YYYY-MM-DD, fuso de São Paulo) gravadas em period_start/period_end. */
  periodStart: string;
  periodEnd: string;
  /** Janela exata usada nas consultas: [windowStart, windowEnd). */
  windowStart: Date;
  windowEnd: Date;
}

/** Ano/mês/dia de um instante no fuso indicado. */
export function zonedDate(date: Date, timeZone: string = NEWSLETTER_TIME_ZONE): ZonedDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function toYmd({ year, month, day }: ZonedDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Semana ISO 8601 (segunda-feira começa a semana; a semana 1 contém a primeira quinta-feira). */
export function isoWeekOf({ year, month, day }: ZonedDate): IsoWeek {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7; // segunda = 0
  date.setUTCDate(date.getUTCDate() - weekday + 3); // quinta-feira da mesma semana
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const isoWeek = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { isoYear, isoWeek };
}

export function editionSlug({ isoYear, isoWeek }: IsoWeek): string {
  return `${isoYear}-s${String(isoWeek).padStart(2, "0")}`;
}

export function editionTitle({ isoYear, isoWeek }: IsoWeek): string {
  return `Boletim Delas — semana ${isoWeek} de ${isoYear}`;
}

/** Calcula slug, título, período e janela da edição gerada em `now`. */
export function getEditionWeek(now: Date = new Date()): EditionWeek {
  const windowEnd = new Date(now.getTime());
  const windowStart = new Date(now.getTime() - 7 * DAY_MS);
  const eve = new Date(now.getTime() - DAY_MS);
  const week = isoWeekOf(zonedDate(eve));
  return {
    ...week,
    slug: editionSlug(week),
    title: editionTitle(week),
    periodStart: toYmd(zonedDate(windowStart)),
    periodEnd: toYmd(zonedDate(eve)),
    windowStart,
    windowEnd,
  };
}

/**
 * Período legível: "19 a 25 de out. de 2026", "28 de set. a 4 de out. de 2026".
 * Recebe datas YYYY-MM-DD (colunas `date`), sem conversão de fuso.
 */
export function formatEditionPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  };
  const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(date);
  if (!start || !end) {
    return fmt(parse((start ?? end)!), { day: "numeric", month: "short", year: "numeric" });
  }
  const a = parse(start);
  const b = parse(end);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) {
    return `${fmt(a, { day: "numeric", month: "short", year: "numeric" })} a ${fmt(b, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (a.getUTCMonth() !== b.getUTCMonth()) {
    return `${fmt(a, { day: "numeric", month: "short" })} a ${fmt(b, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return `${a.getUTCDate()} a ${fmt(b, { day: "numeric", month: "short", year: "numeric" })}`;
}
