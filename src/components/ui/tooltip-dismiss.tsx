"use client";

import { useEffect, useRef } from "react";

/**
 * Detalhe interno do <Tooltip>: Esc esconde a dica enquanto o ponteiro/foco continuam no
 * elemento (WCAG 1.4.13 — conteúdo em hover/foco precisa poder ser dispensado).
 * Volta a funcionar quando o ponteiro sai ou o foco deixa o elemento.
 */
export function TooltipDismiss() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = ref.current?.parentElement;
    if (!wrapper) return;
    const reset = () => {
      delete wrapper.dataset.dismissed;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (wrapper.matches(":hover") || wrapper.contains(document.activeElement)) {
        wrapper.dataset.dismissed = "";
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!wrapper.contains(event.relatedTarget as Node | null)) reset();
    };
    document.addEventListener("keydown", onKeyDown);
    wrapper.addEventListener("pointerleave", reset);
    wrapper.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wrapper.removeEventListener("pointerleave", reset);
      wrapper.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return <span ref={ref} hidden />;
}
