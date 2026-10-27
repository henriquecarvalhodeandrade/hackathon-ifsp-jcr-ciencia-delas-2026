"use client";

import { useEffect } from "react";

/**
 * No celular as abas (TabNav) rolam na horizontal: garante que a aba ativa fique visível
 * (ex.: "Mentorias ativas", a última). Só ajusta o scroll horizontal da própria barra.
 */
export function ScrollActiveTab({ navLabel, activeKey }: { navLabel: string; activeKey: string }) {
  useEffect(() => {
    const nav = Array.from(document.querySelectorAll<HTMLElement>("nav[aria-label]")).find(
      (el) => el.getAttribute("aria-label") === navLabel,
    );
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (box.left >= navBox.left && box.right <= navBox.right) return;
    nav.scrollLeft += box.left - navBox.left - (navBox.width - box.width) / 2;
  }, [navLabel, activeKey]);
  return null;
}
