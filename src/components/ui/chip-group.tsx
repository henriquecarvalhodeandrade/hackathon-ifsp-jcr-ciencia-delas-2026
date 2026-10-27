"use client";

import { useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { ChipToggle } from "./chip";
import type { FieldError } from "./field";

export interface ChipGroupOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ChipGroupProps {
  /** Nome do campo — o servidor lê com formData.getAll(name). */
  name: string;
  legend: React.ReactNode;
  options: readonly ChipGroupOption[];
  defaultValue?: readonly string[];
  /** Modo controlado (opcional). */
  value?: readonly string[];
  onValueChange?: (value: string[]) => void;
  /** Máximo de opções marcadas; as demais ficam desabilitadas ao atingir o limite. */
  max?: number;
  hint?: React.ReactNode;
  error?: FieldError;
  required?: boolean;
  hideLegend?: boolean;
  className?: string;
}

/**
 * Seleção múltipla em chips (áreas de pesquisa, tópicos de mentoria).
 * Cada chip é um checkbox nativo: o formulário envia um valor por chip marcado.
 */
export function ChipGroup({
  name,
  legend,
  options,
  defaultValue = [],
  value,
  onValueChange,
  max,
  hint,
  error,
  required,
  hideLegend,
  className,
}: ChipGroupProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [internal, setInternal] = useState<string[]>(() => [...defaultValue]);
  const selected = value ? [...value] : internal;
  const atLimit = max !== undefined && selected.length >= max;
  const message = typeof error === "string" ? error : error?.[0];
  const statusId = max !== undefined ? `${id}-status` : undefined;
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = message ? `${id}-erro` : undefined;

  function toggle(optionValue: string, checked: boolean) {
    const next = checked ? [...selected, optionValue] : selected.filter((v) => v !== optionValue);
    if (!value) setInternal(next);
    onValueChange?.(next);
  }

  return (
    <fieldset
      className={cn("grid gap-2", className)}
      aria-describedby={[hintId, statusId, errorId].filter(Boolean).join(" ") || undefined}
    >
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
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <ChipToggle
              key={option.value}
              name={name}
              value={option.value}
              label={option.label}
              checked={checked}
              disabled={option.disabled || (atLimit && !checked)}
              aria-invalid={message ? true : undefined}
              onChange={(event) => toggle(option.value, event.currentTarget.checked)}
            />
          );
        })}
      </div>
      {max !== undefined && (
        <p id={statusId} aria-live="polite" className={cn("text-xs", atLimit ? "font-semibold text-fg-muted" : "text-fg-subtle")}>
          {formatNumber(selected.length)} de {formatNumber(max)} selecionadas
          {atLimit && " — limite atingido. Desmarque uma opção para trocar."}
        </p>
      )}
      {message && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
          <span>{message}</span>
        </p>
      )}
    </fieldset>
  );
}
