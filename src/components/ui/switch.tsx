import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.ComponentProps<"input">, "type" | "role"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Rótulo à esquerda e chave à direita (bom para listas de preferências). */
  labelPosition?: "start" | "end";
}

/**
 * Chave liga/desliga: <input type="checkbox" role="switch"> nativo — funciona em formulários
 * (envia "on" quando ligada) e sem JavaScript. Ligada, o botãozinho usa primary-fg (branco no claro,
 * violeta-950 no escuro) para manter ≥ 3:1 contra o trilho nos dois temas.
 */
export function Switch({ label, description, labelPosition = "end", className, ...props }: SwitchProps) {
  const control = (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          "h-6 w-10 rounded-pill border border-transparent bg-border-strong transition-colors duration-150",
          "peer-checked:bg-primary peer-hover:bg-fg-subtle peer-checked:peer-hover:bg-primary-hover",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
          "forced-colors:border-[CanvasText]",
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 left-1 size-4 rounded-full bg-white shadow-card transition-[transform,background-color] duration-200 ease-out-soft peer-checked:translate-x-4 peer-checked:bg-primary-fg forced-colors:bg-[CanvasText]"
      />
    </span>
  );

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 text-[0.9375rem] has-disabled:cursor-not-allowed has-disabled:opacity-60",
        labelPosition === "start" && "justify-between",
        className,
      )}
    >
      {labelPosition === "end" && <span className="mt-0.5">{control}</span>}
      <span className="grid gap-0.5 leading-snug">
        <span className="font-medium text-fg">{label}</span>
        {description && <span className="text-sm text-fg-muted">{description}</span>}
      </span>
      {labelPosition === "start" && <span className="mt-0.5">{control}</span>}
    </label>
  );
}
