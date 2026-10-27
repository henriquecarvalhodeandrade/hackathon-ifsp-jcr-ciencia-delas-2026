"use client";

import { useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { controlClasses } from "./input";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Mostra "120/1.500" abaixo do campo (requer maxLength). */
  showCount?: boolean;
}

/**
 * Área de texto com contador opcional de caracteres.
 * O contador é anunciado de forma educada (aria-live) só quando faltam poucos caracteres.
 */
export function Textarea({
  className,
  showCount = false,
  maxLength,
  defaultValue,
  value,
  onChange,
  rows = 5,
  id,
  ...props
}: TextareaProps) {
  const [length, setLength] = useState(() => String(value ?? defaultValue ?? "").length);
  const currentLength = value !== undefined ? String(value).length : length;
  const counterId = id ? `${id}-contador` : undefined;
  const nearLimit = maxLength !== undefined && currentLength >= maxLength * 0.9;

  const describedBy =
    [props["aria-describedby"], showCount && maxLength ? counterId : undefined].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="grid gap-1.5">
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={(event) => {
          setLength(event.currentTarget.value.length);
          onChange?.(event);
        }}
        className={cn(controlClasses, "min-h-24 resize-y px-3.5 py-2.5 text-base leading-relaxed", className)}
        {...props}
        aria-describedby={describedBy}
      />
      {showCount && maxLength !== undefined && (
        <p
          id={counterId}
          className={cn("tabular justify-self-end text-xs", nearLimit ? "font-semibold text-warning" : "text-fg-subtle")}
          aria-live={nearLimit ? "polite" : "off"}
        >
          {formatNumber(currentLength)}/{formatNumber(maxLength)}
          <span className="sr-only"> caracteres</span>
        </p>
      )}
    </div>
  );
}
