"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Pin } from "lucide-react";
import { buttonVariants, toast } from "@/components/ui";
import { togglePinnedAction } from "@/lib/portfolio/actions";
import { cn } from "@/lib/utils";

const CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/**
 * "Destacar" um item do portfólio (aparece primeiro no perfil). Botão de alternância com nome
 * FIXO e `aria-pressed` (docs/02 §13). O cartão NÃO muda de lugar agora (a ação não revalida a
 * página): a ordem nova vale na próxima visita — e o aviso conta isso.
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
  const [isPending, startTransition] = useTransition();

  if (lastProp !== pinned) {
    setLastProp(pinned);
    setConfirmed(pinned);
  }
  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_c, next: boolean) => next);

  function handleClick() {
    const next = !optimistic;
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
          toast(
            result.pinned
              ? "Destacado — aparece primeiro no seu perfil."
              : { message: "Destaque removido.", tone: "info" },
          );
        } else {
          toast({ message: result.error, tone: "danger" });
        }
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimistic}
      aria-busy={isPending || undefined}
      aria-label={`Destacar “${itemTitle}”`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "pointer-coarse:h-11 pointer-coarse:px-4",
        optimistic &&
          "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft hover:text-primary-soft-fg",
      )}
    >
      <Pin aria-hidden="true" className={cn(optimistic && "fill-current")} />
      Destacar
    </button>
  );
}
