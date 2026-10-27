import { TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface StatProps extends React.ComponentProps<"div"> {
  label: React.ReactNode;
  value: number | string;
  /** Variação, ex.: { value: 12, label: "na semana" } → "+12 na semana". */
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  /** Formata números grandes como "1,2 mil". */
  compact?: boolean;
}

/** Número em destaque + rótulo. Use em grupos (<StatGroup>) para métricas da comunidade. */
export function Stat({ label, value, trend, icon, compact, className, ...props }: StatProps) {
  const display =
    typeof value === "number"
      ? formatNumber(value, compact ? { notation: "compact", maximumFractionDigits: 1 } : undefined)
      : value;
  const up = trend && trend.value >= 0;
  return (
    <div className={cn("grid content-start gap-1", className)} {...props}>
      <p className="flex items-center gap-2 text-sm font-medium text-fg-muted [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {label}
      </p>
      <p className="tabular font-display text-4xl leading-none font-semibold tracking-[-0.03em] text-fg">{display}</p>
      {trend && (
        <p className={cn("flex items-center gap-1 text-sm font-semibold", up ? "text-success" : "text-danger")}>
          {up ? <TrendingUp aria-hidden="true" className="size-4" /> : <TrendingDown aria-hidden="true" className="size-4" />}
          <span>
            {up ? "+" : "−"}
            {formatNumber(Math.abs(trend.value))}
            {trend.label && <span className="font-normal text-fg-muted"> {trend.label}</span>}
          </span>
        </p>
      )}
    </div>
  );
}

/** Grade responsiva de Stats com divisórias. */
export function StatGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-8 rounded-card border border-border bg-surface p-6 shadow-card md:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}
