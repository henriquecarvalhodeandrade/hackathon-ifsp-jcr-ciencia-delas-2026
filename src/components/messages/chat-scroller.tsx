"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Distância do fim (px) em que ainda consideramos que a pessoa está "lá embaixo". */
const NEAR_BOTTOM = 160;

/**
 * Área rolável das mensagens do chat (adaptada do `ConversationScroller` da mentoria), presa ao
 * fim: ocupa o espaço que sobra entre o topo e o campo (`flex-1`) e as mensagens ficam embaixo,
 * perto do campo, mesmo quando são poucas. `role="log"`: o leitor de tela anuncia só o que chega
 * (`aria-relevant="additions"`). Abre no fim; quando chega mensagem nova, desce até ela se a pessoa
 * já estava perto do fim ou se a mensagem é dela — sem puxar a tela de quem relê o começo. Se a
 * área encolhe (teclado do celular abrindo, aviso no topo), continua presa ao fim. Focável pelo
 * teclado (setas rolam).
 */
export function ChatScroller({
  label,
  lastItemId,
  lastIsMine,
  scrollerRef,
  className,
  children,
}: {
  label: string;
  /** Id do último item (mensagem, provisória ou linha de sistema): muda → talvez rolar. */
  lastItemId: string | null;
  lastIsMine: boolean;
  /** Ref da área rolável (para levar o foco até ela). */
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = scrollerRef ?? localRef;
  const nearBottom = useRef(true);
  const mounted = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!mounted.current || nearBottom.current || lastIsMine) {
      element.scrollTop = element.scrollHeight;
      nearBottom.current = true;
    }
    mounted.current = true;
  }, [ref, lastItemId, lastIsMine]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <div
      ref={ref}
      role="log"
      aria-label={label}
      aria-relevant="additions"
      tabIndex={0}
      onScroll={(event) => {
        const el = event.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
      }}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:-outline-offset-2",
        className,
      )}
    >
      <div className="flex min-h-full flex-col justify-end">{children}</div>
    </div>
  );
}
