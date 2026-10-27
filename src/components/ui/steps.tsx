import { Check } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface StepItem {
  label: string;
  /** Linha de apoio (aparece a partir de `sm`). */
  description?: string;
}

export interface StepsProps extends Omit<React.ComponentProps<"div">, "children"> {
  steps: readonly StepItem[];
  /** Índice (0-based) da etapa atual. */
  current: number;
  /** Nome acessível da lista, ex.: "Etapas do cadastro". */
  label?: string;
}

/**
 * Indicador de etapas para fluxos em várias telas (onboarding, novo paper). Só apresentação —
 * a navegação entre etapas fica com a feature. A etapa atual recebe aria-current="step".
 * No celular mostra só os números + "Etapa 2 de 4 · Título".
 */
export function Steps({ steps, current, label = "Etapas", className, ...props }: StepsProps) {
  const total = steps.length;
  const active = Math.min(Math.max(0, current), Math.max(0, total - 1));
  const currentStep = steps[active];

  return (
    <div className={cn("grid gap-2", className)} {...props}>
      <ol aria-label={label} className="flex items-start">
        {steps.map((step, i) => {
          const status = i < active ? "complete" : i === active ? "current" : "upcoming";
          const statusText = status === "complete" ? "concluída" : status === "current" ? "etapa atual" : "próxima";
          return (
            <li
              key={`${i}-${step.label}`}
              aria-current={status === "current" ? "step" : undefined}
              className={cn("flex min-w-0 items-start", i < total - 1 && "flex-1")}
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "tabular inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold [&_svg]:size-4",
                    status === "complete" && "bg-primary text-primary-fg",
                    status === "current" && "border-2 border-primary bg-primary-soft text-primary-soft-fg",
                    status === "upcoming" && "border border-border-strong bg-surface text-fg-subtle",
                  )}
                >
                  {status === "complete" ? <Check strokeWidth={3} /> : formatNumber(i + 1)}
                </span>
                <span aria-hidden="true" className="hidden min-w-0 pt-1 pr-2 sm:grid">
                  <span
                    className={cn(
                      "truncate text-sm leading-snug font-semibold",
                      status === "upcoming" ? "text-fg-muted" : "text-fg",
                    )}
                  >
                    {step.label}
                  </span>
                  {step.description && <span className="truncate text-xs text-fg-subtle">{step.description}</span>}
                </span>
                <span className="sr-only">
                  Etapa {formatNumber(i + 1)} de {formatNumber(total)}: {step.label} ({statusText})
                </span>
              </span>
              {i < total - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-2 mt-4 h-0.5 min-w-4 flex-1 rounded-pill",
                    i < active ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {currentStep && (
        <p aria-hidden="true" className="text-sm text-fg-muted sm:hidden">
          <span className="font-semibold text-fg">
            Etapa {formatNumber(active + 1)} de {formatNumber(total)}
          </span>{" "}
          · {currentStep.label}
        </p>
      )}
    </div>
  );
}
