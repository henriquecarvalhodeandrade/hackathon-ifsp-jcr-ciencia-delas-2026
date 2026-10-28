/**
 * Impacto agregado da mentoria (puro, testado): lê o JSON de `get_mentorship_impact()` e aplica
 * DE NOVO a supressão (defesa em profundidade — mesmo que o banco mandasse números a mais, a
 * interface não os mostraria):
 *   - nenhum resultado com menos de K_MIN (5) retornos de mentorandas;
 *   - opção marcada por menos de CELL_MIN (3) pessoas aparece como "menos de 3".
 */
import { z } from "zod";
import { formatNumber } from "@/lib/utils";
import { MENTEE_OUTCOMES, outcomeImpactLabel } from "./outcomes";

export const K_MIN = 5;
export const CELL_MIN = 3;
export const SUPPRESSED_LABEL = "menos de 3";

const count = z.coerce.number().int().min(0).catch(0);

const impactSchema = z.object({
  completed: count,
  mentee_feedback: count,
  outcomes: z
    .array(z.object({ slug: z.string(), count: z.number().int().min(0).nullable().catch(null) }))
    .nullable()
    .catch(null),
  helpfulness_avg: z.coerce.number().min(1).max(5).nullable().catch(null),
  declarations_issued: count,
  k_min: z.coerce.number().int().min(K_MIN).catch(K_MIN),
  is_demo: z.boolean().catch(false),
});

export interface ImpactOutcome {
  slug: string;
  label: string;
  /** null = suprimido ("menos de 3"). */
  count: number | null;
  /** 0–100, parte de quem respondeu; null quando suprimido. */
  percent: number | null;
}

export interface ImpactData {
  completed: number;
  menteeFeedback: number;
  declarationsIssued: number;
  /** Mínimo de retornos para mostrar resultados (o maior entre o do banco e K_MIN). */
  kMin: number;
  /** true quando há retornos suficientes para mostrar opções e média. */
  allowed: boolean;
  outcomes: ImpactOutcome[];
  helpfulnessAvg: number | null;
  isDemo: boolean;
}

/** null quando o JSON não tem o formato esperado (a seção some em vez de mostrar lixo). */
export function parseImpact(json: unknown): ImpactData | null {
  const parsed = impactSchema.safeParse(json);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const kMin = Math.max(K_MIN, raw.k_min);
  const allowed = raw.mentee_feedback >= kMin && raw.outcomes !== null;
  const bySlug = new Map((raw.outcomes ?? []).map((o) => [o.slug, o.count]));

  const outcomes: ImpactOutcome[] = allowed
    ? MENTEE_OUTCOMES.map(({ slug }) => {
        const value = bySlug.get(slug) ?? null;
        const shown = value !== null && value >= CELL_MIN ? value : null;
        return {
          slug,
          label: outcomeImpactLabel(slug) ?? slug,
          count: shown,
          percent: shown === null ? null : sharePercent(shown, raw.mentee_feedback),
        };
      })
    : [];

  return {
    completed: raw.completed,
    menteeFeedback: raw.mentee_feedback,
    declarationsIssued: raw.declarations_issued,
    kMin,
    allowed,
    outcomes,
    helpfulnessAvg: allowed ? raw.helpfulness_avg : null,
    isDemo: raw.is_demo,
  };
}

/** Porcentagem inteira (0–100) de `part` em `total`. */
export function sharePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

/** "80% (4 de 5)" ou "menos de 3". */
export function outcomeValueLabel(outcome: ImpactOutcome, total: number): string {
  if (outcome.count === null || outcome.percent === null) return SUPPRESSED_LABEL;
  return `${formatNumber(outcome.percent)}% (${formatNumber(outcome.count)} de ${formatNumber(total)})`;
}

/** "4,6". */
export function formatAverage(value: number): string {
  return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Quantos retornos ainda faltam para os resultados aparecerem. */
export function missingForResults(data: Pick<ImpactData, "menteeFeedback" | "kMin">): number {
  return Math.max(0, data.kMin - data.menteeFeedback);
}
