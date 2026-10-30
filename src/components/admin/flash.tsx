"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Aviso de resultado das ações do painel. Muitas ações fazem o cartão sumir da lista
 * (ex.: resolver uma denúncia), então a confirmação não pode morar dentro dele:
 * quem executa a ação chama `announce()` e esta região — fixa na página — mostra o texto.
 */

const EVENT = "cd-admin-flash";

export type FlashTone = "success" | "danger";

export function announce(message: string, tone: FlashTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ message: string; tone: FlashTone }>(EVENT, { detail: { message, tone } }),
  );
}

export function AdminFlashRegion() {
  const [flash, setFlash] = useState<{ message: string; tone: FlashTone; key: number } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onFlash(event: Event) {
      const { message, tone } = (event as CustomEvent<{ message: string; tone: FlashTone }>).detail;
      setFlash({ message, tone, key: Date.now() });
      if (timer.current) clearTimeout(timer.current);
      // Sucesso some sozinho depois de um tempo; erro fica até ser fechado.
      if (tone === "success") timer.current = setTimeout(() => setFlash(null), 9000);
    }
    window.addEventListener(EVENT, onFlash);
    return () => {
      window.removeEventListener(EVENT, onFlash);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {flash && (
        <Alert
          key={flash.key}
          variant={flash.tone}
          className="pointer-events-auto w-full max-w-md animate-pop-in items-start shadow-overlay"
        >
          <div className="flex items-start gap-3">
            <p className="flex-1">{flash.message}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar aviso"
              className="-mt-1 -mr-2 text-current hover:bg-current/10"
              onClick={() => setFlash(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
