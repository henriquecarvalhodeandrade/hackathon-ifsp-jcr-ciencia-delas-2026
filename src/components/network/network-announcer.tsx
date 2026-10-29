"use client";

import { useEffect, useState } from "react";

const EVENT = "artemis:rede-anuncio";

type Detail = { message: string; focusId?: string };

/**
 * Anuncia o resultado de uma ação das listas da /rede e leva o foco a um título estável.
 * Depois de aceitar, recusar ou remover, o cartão SOME da lista (a página é revalidada) — junto
 * com o botão focado e a região aria-live dele. Este anúncio mora fora da lista e não some.
 */
export function announceNetwork(message: string, focusId?: string) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { message, focusId } }));
}

/** Região aria-live da página (monte uma vez, fora das listas). */
export function NetworkAnnouncer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer: number | undefined;
    function onAnnounce(event: Event) {
      const { message: text, focusId } = (event as CustomEvent<Detail>).detail;
      // Limpa antes de escrever: a mesma frase duas vezes seguidas também é anunciada.
      setMessage("");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setMessage(text);
        // Depois que o diálogo fecha e devolve o foco (a um botão que pode ter sumido).
        if (focusId) document.getElementById(focusId)?.focus({ preventScroll: false });
      }, 150);
    }
    window.addEventListener(EVENT, onAnnounce);
    return () => {
      window.removeEventListener(EVENT, onAnnounce);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
