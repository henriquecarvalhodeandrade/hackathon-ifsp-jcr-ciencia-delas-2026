"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Distância do fim (px) em que ainda consideramos que a pessoa está "lá embaixo". */
const NEAR_BOTTOM = 160;

/**
 * Área rolável das mensagens (`role="log"`: o leitor de tela anuncia só as mensagens que
 * chegam — `aria-relevant="additions"`, então a troca de "há 1 minuto" por "há 2 minutos" e de
 * "Enviada" por "Lida" não é lida em voz alta). Abre no fim da conversa; quando chega mensagem
 * nova, desce até ela se a pessoa já estava perto do fim ou se a mensagem é dela — sem puxar a
 * tela de quem está relendo o começo. Focável pelo teclado (setas rolam).
 */
export function ConversationScroller({
  label,
  lastMessageId,
  lastIsMine,
  className,
  children,
}: {
  label: string;
  lastMessageId: string | null;
  lastIsMine: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
  }, [lastMessageId, lastIsMine]);

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
        "overflow-y-auto overscroll-contain focus-visible:-outline-offset-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
