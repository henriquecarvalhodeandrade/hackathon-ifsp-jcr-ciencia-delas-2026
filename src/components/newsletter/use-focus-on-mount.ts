"use client";

import { useEffect, useRef } from "react";

/**
 * Leva o foco para o elemento quando ele aparece (ex.: painel de sucesso que substitui um
 * formulário). Sem isso, o botão clicado some e o foco cai no <body>: quem usa teclado ou leitor
 * de tela perde o lugar e pode não ouvir a confirmação. O elemento precisa de tabIndex={-1}.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
