import { useId } from "react";
import { cn, formatNumber } from "@/lib/utils";

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export type MeterTone = "primary" | "secondary" | "accent";

/* accent usa accent-strong: o âmbar 400 sobre o trilho claro fica abaixo de 3:1 (WCAG 1.4.11). */
const barTone: Record<MeterTone, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent-strong",
};

export interface ProgressMeterProps extends React.ComponentProps<"div"> {
  /** 0–100 */
  value: number;
  label: React.ReactNode;
  /** Texto à direita (padrão "NN%"). */
  valueLabel?: string;
  tone?: MeterTone;
  size?: "sm" | "md";
}

/** Barra de progresso/medida (ex.: perfil 80% completo). role="meter" com valor anunciado. */
export function ProgressMeter({
  value,
  label,
  valueLabel,
  tone = "primary",
  size = "md",
  className,
  ...props
}: ProgressMeterProps) {
  const v = clamp(value);
  const labelId = useId();
  const text = valueLabel ?? `${formatNumber(v)}%`;
  return (
    <div className={cn("grid gap-1.5", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id={labelId} className="font-medium text-fg">
          {label}
        </span>
        <span className="font-semibold text-fg-muted tabular">{text}</span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={text}
        className={cn(
          "overflow-hidden rounded-pill bg-surface-2 ring-1 ring-border ring-inset",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-500 ease-out-soft",
            barTone[tone],
          )}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

/** Rótulo qualitativo da compatibilidade de mentoria. */
export function scoreLabel(score: number): string {
  if (score >= 80) return "Afinidade muito alta";
  if (score >= 60) return "Boa afinidade";
  if (score >= 40) return "Afinidade moderada";
  return "Afinidade inicial";
}

export interface ScoreMeterProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** 0–100 */
  value: number;
  /** Rótulo curto exibido abaixo do número no tamanho lg (padrão "afinidade"). */
  caption?: string;
  /** Mostra o rótulo qualitativo ao lado (ex.: "Boa afinidade"). */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  /** Nome acessível, ex.: "Compatibilidade com Ana Souza". */
  label?: string;
}

const ringSizes = { sm: 56, md: 76, lg: 104 } as const;

/**
 * Medidor circular (órbita) para a compatibilidade mentora↔mentoranda.
 * A estrela âmbar marca o ponto alcançado na órbita.
 */
export function ScoreMeter({
  value,
  caption = "afinidade",
  showLabel = false,
  size = "md",
  label = "Compatibilidade",
  className,
  ...props
}: ScoreMeterProps) {
  const v = clamp(value);
  const px = ringSizes[size];
  const stroke = size === "sm" ? 5 : 6;
  const r = 50 - stroke / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const angle = (v / 100) * 2 * Math.PI - Math.PI / 2;
  const starX = 50 + r * Math.cos(angle);
  const starY = 50 + r * Math.sin(angle);
  const qualitative = scoreLabel(v);

  return (
    <div className={cn("inline-flex items-center gap-3", className)} {...props}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={`${v}% — ${qualitative}`}
        className="relative shrink-0"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 100 100" className="size-full -rotate-0" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={stroke}
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="1.5 5"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * circumference} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
          {v > 0 && (
            <circle
              cx={starX}
              cy={starY}
              r={stroke * 0.9}
              fill="var(--color-accent)"
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          )}
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden="true"
        >
          <span
            className={cn(
              "font-display leading-none font-semibold tracking-[-0.03em] text-fg tabular",
              size === "sm" ? "text-base" : size === "md" ? "text-xl" : "text-3xl",
            )}
          >
            {v}
            <span className="text-[0.6em] text-fg-muted">%</span>
          </span>
          {size === "lg" && (
            <span className="mt-1 text-[0.625rem] font-semibold tracking-wide text-fg-subtle uppercase">
              {caption}
            </span>
          )}
        </div>
      </div>
      {showLabel && <span className="text-sm font-semibold text-fg">{qualitative}</span>}
    </div>
  );
}
