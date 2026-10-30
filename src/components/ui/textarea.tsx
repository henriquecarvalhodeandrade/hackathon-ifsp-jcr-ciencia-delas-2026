"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { controlClasses } from "./input";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Mostra "120/1.500" abaixo do campo (requer maxLength). */
  showCount?: boolean;
  /**
   * Cresce com o texto, de uma linha até ~metade da tela (`field-sizing: content`; sem suporte no
   * navegador, a altura é ajustada via JS). Opcional — sem ela, o campo continua como antes.
   */
  autoGrow?: boolean;
}

const AUTO_GROW_MAX = 0.5;

/** Fallback do autoGrow para navegadores sem `field-sizing`: altura = conteúdo, até 50vh. */
function fitToContent(field: HTMLTextAreaElement) {
  field.style.height = "auto";
  const max = window.innerHeight * AUTO_GROW_MAX;
  field.style.height = `${Math.min(field.scrollHeight + 2, max)}px`;
}

/**
 * Área de texto com contador opcional de caracteres.
 * O contador é anunciado de forma educada (aria-live) só quando faltam poucos caracteres.
 * Sem `value` (campo não controlado), o contador lê o texto do próprio campo: acompanha a
 * digitação, o reset do formulário (o React 19 limpa o <form> depois de cada action) e o
 * texto restaurado pelo navegador ao voltar para a página.
 */
export function Textarea({
  className,
  showCount = false,
  autoGrow = false,
  maxLength,
  defaultValue,
  value,
  onChange,
  rows = 5,
  id,
  ref,
  ...props
}: TextareaProps) {
  const [length, setLength] = useState(() => String(value ?? defaultValue ?? "").length);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const currentLength = value !== undefined ? String(value).length : length;
  const counterId = id ? `${id}-contador` : undefined;
  const nearLimit = maxLength !== undefined && currentLength >= maxLength * 0.9;
  const counting = showCount && maxLength !== undefined;
  const controlled = value !== undefined;

  // Junta a ref interna com a ref de quem usa o componente (função ou objeto).
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      fieldRef.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    const field = fieldRef.current;
    if (!counting || controlled || !field) return;
    const sync = () => setLength(field.value.length);
    // O evento "reset" dispara ANTES de o navegador restaurar os valores: lê na próxima tarefa.
    const onReset = () => window.setTimeout(sync, 0);
    const form = field.form;
    form?.addEventListener("reset", onReset);
    // Texto restaurado pelo navegador (voltar/avançar) ou por preenchimento automático.
    const frame = requestAnimationFrame(sync);
    return () => {
      form?.removeEventListener("reset", onReset);
      cancelAnimationFrame(frame);
    };
  }, [counting, controlled]);

  // autoGrow sem `field-sizing: content` (Safari/Firefox antigos): ajusta a altura via JS.
  useEffect(() => {
    const field = fieldRef.current;
    if (!autoGrow || !field) return;
    if (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")) return;
    const sync = () => fitToContent(field);
    const onReset = () => window.setTimeout(sync, 0);
    const form = field.form;
    field.addEventListener("input", sync);
    form?.addEventListener("reset", onReset);
    sync();
    return () => {
      field.removeEventListener("input", sync);
      form?.removeEventListener("reset", onReset);
    };
  }, [autoGrow]);

  const describedBy =
    [props["aria-describedby"], counting ? counterId : undefined].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="grid gap-1.5">
      <textarea
        ref={setRefs}
        id={id}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={(event) => {
          setLength(event.currentTarget.value.length);
          onChange?.(event);
        }}
        className={cn(
          controlClasses,
          "min-h-24 resize-y px-3.5 py-2.5 text-base leading-relaxed",
          autoGrow && "field-sizing-content max-h-[50vh] min-h-11 resize-none",
          className,
        )}
        {...props}
        aria-describedby={describedBy}
      />
      {counting && (
        <p
          id={counterId}
          className={cn(
            "justify-self-end text-xs tabular",
            nearLimit ? "font-semibold text-warning" : "text-fg-subtle",
          )}
          aria-live={nearLimit ? "polite" : "off"}
        >
          {formatNumber(currentLength)}/{formatNumber(maxLength)}
          <span className="sr-only"> caracteres</span>
        </p>
      )}
    </div>
  );
}
