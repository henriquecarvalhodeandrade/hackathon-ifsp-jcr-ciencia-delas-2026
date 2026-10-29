"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Pin } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { togglePinnedAction } from "@/lib/portfolio/actions";
import { cn } from "@/lib/utils";

const CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/**
 * "Destacar" um item do portfólio (aparece primeiro aqui e no perfil). Botão de alternância com
 * nome FIXO e `aria-pressed` (docs/02 §13); a lista se reordena depois da revalidação.
 */
export function PinButton({
  itemId,
  itemTitle,
  pinned,
}: {
  itemId: string;
  itemTitle: string;
  pinned: boolean;
}) {
  const [confirmed, setConfirmed] = useState(pinned);
  const [lastProp, setLastProp] = useState(pinned);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isPending, startTransition] = useTransition();

  if (lastProp !== pinned) {
    setLastProp(pinned);
    setConfirmed(pinned);
  }
  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_c, next: boolean) => next);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  function handleClick() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      let result: Awaited<ReturnType<typeof togglePinnedAction>>;
      try {
        result = await togglePinnedAction(itemId, next);
      } catch {
        result = { ok: false, error: CONNECTION_ERROR };
      }
      startTransition(() => {
        if (result.ok) {
          setConfirmed(result.pinned);
          setAnnouncement(
            result.pinned
              ? "Item destacado: ele aparece primeiro no portfólio e no seu perfil."
              : "Destaque removido.",
          );
        } else {
          setError(result.error);
        }
      });
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={optimistic}
        aria-busy={isPending || undefined}
        aria-label={`Destacar “${itemTitle}”`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          optimistic &&
            "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft hover:text-primary-soft-fg",
        )}
      >
        <Pin aria-hidden="true" className={cn(optimistic && "fill-current")} />
        Destacar
      </button>
      <span aria-live="polite" className="sr-only">
        {error ?? announcement}
      </span>
      {error && (
        <span
          aria-hidden="true"
          className="absolute top-full left-0 z-20 mt-1 w-56 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-fg shadow-overlay"
        >
          {error}
        </span>
      )}
    </span>
  );
}
