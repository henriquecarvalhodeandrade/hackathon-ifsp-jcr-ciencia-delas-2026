import { useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldError } from "./field";

export interface RadioProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** "default" (lista) ou "card" (bloco clicável, bom para poucas opções com descrição). */
  variant?: "default" | "card";
}

/** Botão de opção nativo com visual da marca. Use dentro de <RadioGroup> ou com o mesmo `name`. */
export function Radio({ label, description, variant = "default", className, ...props }: RadioProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 text-[0.9375rem] has-disabled:cursor-not-allowed has-disabled:opacity-60",
        variant === "card" &&
          "rounded-control border border-border bg-surface p-3.5 transition-colors hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft/50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          type="radio"
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong bg-surface",
            "transition-colors duration-150 checked:border-primary hover:border-fg-subtle checked:hover:border-primary-hover",
            "aria-invalid:border-danger disabled:cursor-not-allowed forced-colors:appearance-auto",
            variant === "card" && "focus-visible:outline-none",
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-2.5 scale-50 rounded-full bg-primary opacity-0 transition-[opacity,transform] peer-checked:scale-100 peer-checked:opacity-100 forced-colors:hidden"
        />
      </span>
      <span className="grid gap-0.5 leading-snug">
        <span className="font-medium text-fg">{label}</span>
        {description && <span className="text-sm text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}

export interface RadioGroupOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  legend: React.ReactNode;
  options: readonly RadioGroupOption[];
  defaultValue?: string;
  hint?: React.ReactNode;
  error?: FieldError;
  required?: boolean;
  orientation?: "vertical" | "horizontal";
  variant?: RadioProps["variant"];
  hideLegend?: boolean;
  className?: string;
}

/** Grupo de opções (fieldset + legend) — semântica correta para leitores de tela. */
export function RadioGroup({
  name,
  legend,
  options,
  defaultValue,
  hint,
  error,
  required,
  orientation = "vertical",
  variant = "default",
  hideLegend,
  className,
}: RadioGroupProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const message = typeof error === "string" ? error : error?.[0];
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = message ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset className={cn("grid gap-2", className)} aria-describedby={describedBy}>
      <legend className={cn("mb-1 text-sm font-semibold text-fg", hideLegend && "sr-only")}>
        {legend}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="-mt-1 mb-1 text-sm text-fg-muted">
          {hint}
        </p>
      )}
      <div
        className={cn(
          "grid gap-2.5",
          orientation === "horizontal" && "sm:flex sm:flex-wrap sm:gap-x-6",
          variant === "card" && orientation === "horizontal" && "sm:grid sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] sm:gap-3",
        )}
      >
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            description={option.description}
            disabled={option.disabled}
            defaultChecked={defaultValue === option.value}
            required={required}
            aria-invalid={message ? true : undefined}
            variant={variant}
          />
        ))}
      </div>
      {message && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
          <span>{message}</span>
        </p>
      )}
    </fieldset>
  );
}
