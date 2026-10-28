import { useId } from "react";
import { CircleAlert, Footprints } from "lucide-react";
import { ChipToggle } from "@/components/ui/chip";
import type { FieldError } from "@/components/ui/field";
import { TRAJECTORY_MARKER } from "@/lib/profile/form-values";
import { TRAJECTORY_HELP, TRAJECTORY_OPTIONS } from "@/lib/trajectory/catalog";

export interface TrajectoryFieldsProps {
  /** Marcas salvas (slugs). */
  defaultValue?: readonly string[];
  error?: FieldError;
}

/**
 * "Sua trajetória (opcional)" — no fim de "Sobre você" (onboarding, etapa 1, e /perfil#sobre).
 * Oito chips-caixa de seleção nativos (funcionam sem JavaScript e pelo teclado: Tab + Espaço).
 * Nunca obrigatório; nada aqui conta como "perfil incompleto". A marca oculta avisa o servidor
 * que o grupo foi mostrado — sem ela, as marcas salvas não mudam (form-values.ts).
 */
export function TrajectoryFields({ defaultValue = [], error }: TrajectoryFieldsProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hintId = `${id}-dica`;
  const message = typeof error === "string" ? error : error?.[0];
  const errorId = message ? `${id}-erro` : undefined;
  const selected = new Set(defaultValue);

  return (
    <div className="rounded-card border border-border bg-surface-2 p-4 sm:p-5">
      <fieldset
        className="grid gap-3"
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}
      >
        <legend className="mb-1 text-sm leading-snug font-semibold text-fg">
          <span className="inline-flex items-center gap-2">
            <Footprints aria-hidden="true" className="size-4 shrink-0 text-accent-strong" />
            <span>
              Sua trajetória <span className="font-normal text-fg-subtle">(opcional)</span>
            </span>
          </span>
        </legend>
        {/* Depois da legend: ela precisa ser o primeiro filho do fieldset. */}
        <input type="hidden" name={TRAJECTORY_MARKER} value="1" />
        <p id={hintId} className="-mt-1 text-sm text-fg-muted">
          {TRAJECTORY_HELP}
        </p>
        <ul className="flex flex-wrap gap-2">
          {TRAJECTORY_OPTIONS.map((option) => (
            <li key={option.value} className="max-w-full">
              <ChipToggle
                name="trajectory_tags"
                value={option.value}
                defaultChecked={selected.has(option.value)}
                aria-invalid={message ? true : undefined}
                // Rótulos em primeira pessoa são longos: no celular o chip quebra a linha.
                className="h-auto min-h-9 rounded-card py-1.5 text-left whitespace-normal sm:rounded-pill"
                label={<span className="whitespace-normal">{option.label}</span>}
              />
            </li>
          ))}
        </ul>
        {message && (
          <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </p>
        )}
      </fieldset>
    </div>
  );
}
