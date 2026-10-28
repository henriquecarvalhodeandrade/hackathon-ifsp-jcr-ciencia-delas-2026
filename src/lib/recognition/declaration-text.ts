/**
 * Texto da declaração de participação e da linha sugerida para o currículo (puro, testado).
 *
 * Regras de honestidade (docs/15-reconhecimento-da-mentoria.md):
 *   - declara PARTICIPAÇÃO numa mentoria pela plataforma — não é certificado, não fala em
 *     horas (a plataforma não as registra), não promete aproveitamento acadêmico;
 *   - período em meses (aceite → conclusão), temas = os temas em que a mentora orienta;
 *   - nada de logos ou selos de instituições: só a Artemis.
 */
import { MENTORSHIP_TOPICS } from "@/lib/constants";
import { verificationUrl } from "./code";

export const PLATFORM_NAME = "Artemis";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export interface MonthYear {
  year: number;
  /** 1–12 */
  month: number;
}

/**
 * Mês e ano de uma data do banco. Datas puras ("2026-08-01", do tipo `date`) são lidas como
 * estão — sem passar por `new Date()`, que as trataria como meia-noite UTC e, no fuso de São
 * Paulo, voltaria um dia (e às vezes um mês).
 */
export function toMonthYear(value: string | Date | null | undefined): MonthYear | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})/.exec(value);
    if (!match) return null;
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return year && month ? { year, month } : null;
}

/** "agosto de 2026". */
export function formatMonthYear(value: string | Date | null | undefined): string {
  const my = toMonthYear(value);
  return my ? `${MONTHS[my.month - 1]} de ${my.year}` : "";
}

function sameMonth(a: MonthYear, b: MonthYear): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Período no texto da declaração: "entre agosto de 2026 e outubro de 2026" (ou "em outubro de
 * 2026" quando começou e terminou no mesmo mês).
 */
export function formatDeclarationPeriod(start: string | null, end: string | null): string {
  const a = toMonthYear(start);
  const b = toMonthYear(end) ?? a;
  if (!a || !b) return "";
  if (sameMonth(a, b)) return `em ${formatMonthYear(end ?? start)}`;
  return `entre ${formatMonthYear(start)} e ${formatMonthYear(end)}`;
}

/** Período compacto: "agosto a outubro de 2026", "novembro de 2025 a fevereiro de 2026". */
export function formatPeriodRange(start: string | null, end: string | null): string {
  const a = toMonthYear(start);
  const b = toMonthYear(end) ?? a;
  if (!a || !b) return "";
  if (sameMonth(a, b)) return `${MONTHS[b.month - 1]} de ${b.year}`;
  if (a.year === b.year) return `${MONTHS[a.month - 1]} a ${MONTHS[b.month - 1]} de ${b.year}`;
  return `${MONTHS[a.month - 1]} de ${a.year} a ${MONTHS[b.month - 1]} de ${b.year}`;
}

/** Rótulos dos temas (slugs de MENTORSHIP_TOPICS); slugs desconhecidos ficam de fora. */
export function themeLabels(slugs: readonly string[] | null | undefined): string[] {
  const topics = MENTORSHIP_TOPICS as Record<string, string>;
  return (slugs ?? []).flatMap((slug) => (topics[slug] ? [topics[slug]] : []));
}

/** "A, B e C" (lista em português). */
export function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(items);
}

/** Primeira letra minúscula ("Bolsas e editais" → "bolsas e editais"), para o meio da frase. */
function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1) : text;
}

export interface DeclarationData {
  menteeName: string;
  mentorName: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** Rótulos dos temas (já traduzidos). */
  themes: readonly string[];
}

/**
 * Temas no meio da frase, separados por ponto e vírgula: vários rótulos já têm "e" ("Bolsas e
 * editais"), e uma lista com vírgulas e "e" ficaria ambígua.
 */
export function formatThemesInline(themes: readonly string[]): string {
  return themes.map(lowerFirst).join("; ");
}

/** O texto principal da declaração (uma frase). */
export function buildDeclarationText(data: DeclarationData): string {
  const period = formatDeclarationPeriod(data.periodStart, data.periodEnd);
  const themes = data.themes.length ? `, com os temas: ${formatThemesInline(data.themes)}` : "";
  return (
    `A plataforma ${PLATFORM_NAME} declara que ${data.mentorName} participou como mentora e ` +
    `${data.menteeName} como mentoranda de uma mentoria entre pesquisadoras realizada pela ` +
    `plataforma${period ? ` ${period}` : ""}${themes}.`
  );
}

export const DECLARATION_DISCLAIMER =
  "Declaração de participação registrada na plataforma Artemis, projeto criado no Hackathon IFSP Câmpus Jacareí 2026. Não substitui certificado institucional: o aproveitamento como atividade complementar ou de extensão depende das regras de cada instituição. A Artemis não tem vínculo com o CNPq nem com a Plataforma Lattes.";

/** Linha sugerida para o currículo (Lattes, LinkedIn, relatório institucional). */
export function buildCvLine(input: {
  role: "mentee" | "mentor";
  periodStart: string | null;
  periodEnd: string | null;
  siteUrl: string;
  code: string;
}): string {
  const role = input.role === "mentor" ? "como mentora" : "como mentoranda";
  const period = formatPeriodRange(input.periodStart, input.periodEnd);
  return (
    `Mentoria entre pesquisadoras (${role}), plataforma ${PLATFORM_NAME}` +
    `${period ? `, ${period}` : ""}. Verificação: ${verificationUrl(input.siteUrl, input.code)}`
  );
}

/** "localhost:3000/verificar" ou "artemis.app/verificar" — o endereço curto impresso. */
export function displayHost(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
