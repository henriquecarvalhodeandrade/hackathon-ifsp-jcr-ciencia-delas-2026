"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Estado compartilhado por um cartão (publicação ou comentário): o menu "…" do cabeçalho abre a
 * edição que fica no corpo, e o botão "Comentar" do rodapé abre o painel de comentários.
 */
type ItemContextValue = {
  editing: boolean;
  startEditing: () => void;
  /** Fecha a edição e devolve o foco ao botão "…" (que abriu a edição). */
  stopEditing: () => void;
  commentsOpen: boolean;
  setCommentsOpen: (open: boolean) => void;
  /** Envolve o menu "…": o foco volta para o botão dele. */
  menuSlotRef: React.RefObject<HTMLSpanElement | null>;
};

const ItemContext = createContext<ItemContextValue | null>(null);

export function ItemProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const menuSlotRef = useRef<HTMLSpanElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    menuSlotRef.current?.querySelector<HTMLElement>("button[aria-haspopup]")?.focus();
  }, [editing]);

  const startEditing = useCallback(() => setEditing(true), []);
  const stopEditing = useCallback(() => {
    restoreFocus.current = true;
    setEditing(false);
  }, []);

  const value = useMemo(
    () => ({ editing, startEditing, stopEditing, commentsOpen, setCommentsOpen, menuSlotRef }),
    [editing, startEditing, stopEditing, commentsOpen],
  );
  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
}

export function useItem(): ItemContextValue {
  const value = useContext(ItemContext);
  if (!value) throw new Error("useItem precisa de <ItemProvider>.");
  return value;
}
