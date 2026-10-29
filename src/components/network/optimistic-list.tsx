"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";

/**
 * Listas da /rede que respondem na hora: ao aceitar, recusar, cancelar ou remover, o cartão some
 * JÁ (estado otimista) enquanto a Server Action roda. Quando ela termina, a página revalidada
 * chega sem o item; se der erro, a transição acaba e o cartão volta sozinho (`useOptimistic`).
 *
 * Os cartões continuam renderizados no servidor: o provedor não gera HTML, e cada cartão vai
 * dentro de <OptimisticItem id>, que some quando o id está escondido.
 */

type Run = (id: string, task: () => Promise<boolean>) => void;

const ListContext = createContext<{ hidden: ReadonlySet<string>; run: Run } | null>(null);

const NONE: ReadonlySet<string> = new Set();

export function OptimisticList({ children }: { children: React.ReactNode }) {
  const [hidden, hide] = useOptimistic(NONE, (current: ReadonlySet<string>, id: string) => {
    const next = new Set(current);
    next.add(id);
    return next;
  });
  const [, startTransition] = useTransition();

  /** Esconde o item e roda a ação; `task` devolve true no sucesso. */
  const run: Run = (id, task) => {
    startTransition(async () => {
      hide(id);
      await task();
    });
  };

  return <ListContext.Provider value={{ hidden, run }}>{children}</ListContext.Provider>;
}

export function OptimisticItem({ id, children }: { id: string; children: React.ReactNode }) {
  const context = useContext(ListContext);
  if (context?.hidden.has(id)) return null;
  return children;
}

/** O `run` da lista mais próxima (ou null fora de uma lista: o chamador roda a ação sozinho). */
export function useOptimisticList() {
  return useContext(ListContext);
}
