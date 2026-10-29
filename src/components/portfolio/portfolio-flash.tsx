"use client";

import { useEffect, useRef } from "react";
import { toast, type ToastTone } from "@/components/ui";

/**
 * Depois de adicionar ou editar (redirect para `/portfolio?aviso=…&item=…`): mostra o aviso como
 * toast, rola até o item (centralizado), realça o cartão com um anel que some e limpa a URL —
 * `history.replaceState` não refaz a página no servidor (o item continua onde está). Recarregar
 * ou compartilhar o link não repete o aviso.
 */
export function PortfolioFlash({
  notice,
  itemId,
}: {
  notice: { title: string; body: string; tone: ToastTone } | null;
  itemId: string | null;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    if (notice) toast({ message: `${notice.title}. ${notice.body}`, tone: notice.tone });

    const card = itemId ? document.getElementById(`item-${itemId}`) : null;
    if (card) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      card.dataset.flash = "on";
      // Sem limpar no cleanup: no modo estrito o efeito roda duas vezes e o anel ficaria preso.
      window.setTimeout(() => {
        card.dataset.flash = "off";
      }, 2400);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    url.searchParams.delete("item");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [notice, itemId]);

  return null;
}
