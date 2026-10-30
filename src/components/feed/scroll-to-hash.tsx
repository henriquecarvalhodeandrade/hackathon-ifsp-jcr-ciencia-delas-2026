"use client";

import { useEffect } from "react";

const TARGET = /^(comentarios|comentar|comentario-[0-9a-f-]{36})$/i;

/**
 * Leva até o `#` da URL depois que a página da publicação monta. Na navegação pelo cliente (link
 * "N comentários" no feed), o alvo só existe depois do carregamento e o Next mantinha a rolagem
 * antiga (às vezes no rodapé). Aceita `#comentarios`, `#comentar` e `#comentario-<id>`; além de
 * rolar, foca o título do alvo (o campo, no caso de `#comentar`) para o leitor de tela começar ali.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!TARGET.test(hash)) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      const focusable =
        hash === "comentarios"
          ? document.getElementById("comentarios-titulo")
          : hash === "comentar"
            ? target
            : target.querySelector<HTMLElement>("h3[tabindex]");
      focusable?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
