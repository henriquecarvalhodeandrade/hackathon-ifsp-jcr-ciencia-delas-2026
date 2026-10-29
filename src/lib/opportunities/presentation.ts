import {
  BR_STATES,
  MEETING_FORMATS,
  SITE,
  type BrState,
  type MeetingFormat,
} from "@/lib/constants";
import { pluralize } from "@/lib/utils";
import type { OpportunityStatus } from "./labels";

/**
 * Regras de apresentação das vagas (puras, testadas em presentation.test.ts): prazo no fuso de
 * São Paulo, vaga aberta ou encerrada e textos curtos dos cartões.
 *
 * O prazo é uma coluna `date` ("2026-11-15"), sem hora nem fuso. `new Date("2026-11-15")` é
 * meia-noite UTC — 21h do dia 14 em São Paulo —, então nada aqui passa a data por `new Date`
 * direto: comparamos as strings AAAA-MM-DD com "hoje em São Paulo" e formatamos a partir das partes.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "hoje" no fuso de São Paulo, no formato do Postgres (AAAA-MM-DD). */
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Data AAAA-MM-DD válida (existe no calendário)? */
export function isDateOnly(value: string | null | undefined): value is string {
  const match = DATE_ONLY.exec(value ?? "");
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Soma dias a uma data AAAA-MM-DD (aritmética em UTC, sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Soma anos (29/02 vira 01/03 em ano não bissexto, como o Date faz). */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

function dateOnlyToUtcNoon(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/**
 * "15 de nov." (no ano corrente) ou "15 de jan. de 2027". Com `long: true`, o mês por extenso e
 * sempre com o ano: "15 de novembro de 2026". Data inválida → "".
 */
export function formatDeadlineDate(
  date: string,
  options: { now?: Date; long?: boolean } = {},
): string {
  if (!isDateOnly(date)) return "";
  const { now = new Date(), long = false } = options;
  const sameYear = date.slice(0, 4) === todayInSaoPaulo(now).slice(0, 4);
  return new Intl.DateTimeFormat(SITE.locale, {
    timeZone: "UTC",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long || !sameYear ? { year: "numeric" } : {}),
  }).format(dateOnlyToUtcNoon(date));
}

// ---------------------------------------------------------------------------
// Aberta, encerrada ou fora do prazo
// ---------------------------------------------------------------------------

export interface OpportunityTiming {
  status: OpportunityStatus | string;
  deadline: string | null;
}

/** open = recebe candidaturas · closed = a dona encerrou · expired = o prazo passou. */
export type OpportunityState = "open" | "closed" | "expired";

export function opportunityState(
  opportunity: OpportunityTiming,
  now: Date = new Date(),
): OpportunityState {
  if (opportunity.status !== "open") return "closed";
  if (opportunity.deadline && opportunity.deadline < todayInSaoPaulo(now)) return "expired";
  return "open";
}

/** Recebe candidaturas agora (status aberto e prazo não vencido em São Paulo)? */
export function isOpportunityOpen(opportunity: OpportunityTiming, now: Date = new Date()): boolean {
  return opportunityState(opportunity, now) === "open";
}

/** Texto curto do prazo nos cartões: "Inscrições até 15 de nov." / "Encerrada". */
export function deadlineLabel(opportunity: OpportunityTiming, now: Date = new Date()): string {
  if (opportunityState(opportunity, now) !== "open") return "Encerrada";
  const { deadline } = opportunity;
  if (!deadline) return "Inscrições abertas";
  const today = todayInSaoPaulo(now);
  if (deadline === today) return "Inscrições até hoje";
  if (deadline === addDays(today, 1)) return "Inscrições até amanhã";
  return `Inscrições até ${formatDeadlineDate(deadline, { now })}`;
}

/** Selo de situação da vaga (lista "Vagas que publiquei" e detalhe). */
export const OPPORTUNITY_STATE_LABELS: Record<OpportunityState, string> = {
  open: "Aberta",
  closed: "Encerrada",
  expired: "Prazo encerrado",
};

// ---------------------------------------------------------------------------
// Textos dos cartões
// ---------------------------------------------------------------------------

export function modalityLabel(modality: string | null | undefined): string | null {
  return modality && modality in MEETING_FORMATS
    ? MEETING_FORMATS[modality as MeetingFormat]
    : null;
}

/** "São José dos Campos · SP" (só a UF se não houver cidade). */
export function locationLabel(city: string | null | undefined, state: string | null | undefined) {
  const uf = state && state in BR_STATES ? (state as BrState) : null;
  return [city?.trim() || null, uf].filter(Boolean).join(" · ");
}

export function weeklyHoursLabel(hours: number | null | undefined): string | null {
  return hours ? `${pluralize(hours, "hora", "horas")} por semana` : null;
}

export function vacanciesLabel(vacancies: number): string {
  return pluralize(vacancies, "vaga");
}

export function applicationCountLabel(count: number): string {
  return pluralize(count, "candidatura");
}

// ---------------------------------------------------------------------------
// Avisos após uma ação (?aviso=) — só chaves conhecidas, nunca texto vindo da URL.
// ---------------------------------------------------------------------------

export interface OpportunityNotice {
  variant: "success" | "info" | "warning";
  title: string;
  body?: string;
}

const NOTICES = {
  publicada: {
    variant: "success",
    title: "Vaga publicada!",
    body: "Ela já aparece no Explorar ICs. Você recebe uma notificação a cada candidatura.",
  },
  "publicada-feed": {
    variant: "success",
    title: "Vaga publicada e compartilhada no feed!",
    body: "Ela já aparece no Explorar ICs e no feed de quem acompanha você. Você recebe uma notificação a cada candidatura.",
  },
  "publicada-sem-feed": {
    variant: "warning",
    title: "Vaga publicada, mas não conseguimos compartilhá-la no feed.",
    body: "Ela já aparece no Explorar ICs. Se quiser, divulgue o link desta página no feed com suas palavras.",
  },
  atualizada: { variant: "success", title: "Alterações salvas." },
  "candidatura-enviada": {
    variant: "success",
    title: "Candidatura enviada!",
    body: "Você recebe uma notificação quando ela for analisada. Acompanhe tudo em Minhas candidaturas.",
  },
  removida: {
    variant: "success",
    title: "Vaga excluída.",
    body: "Ela e as candidaturas recebidas não aparecem mais na Artemis.",
  },
} as const satisfies Record<string, OpportunityNotice>;

export type OpportunityNoticeKey = keyof typeof NOTICES;

export function parseNotice(value: unknown): OpportunityNotice | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && Object.hasOwn(NOTICES, v)
    ? NOTICES[v as OpportunityNoticeKey]
    : null;
}
