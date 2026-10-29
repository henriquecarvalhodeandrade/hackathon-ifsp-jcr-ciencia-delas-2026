"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { buttonVariants, type ButtonSize } from "@/components/ui";
import { followAction, unfollowAction } from "@/lib/network/actions";
import { firstNameOf, NETWORK_CONNECTION_ERROR } from "@/lib/network/presentation";
import { cn } from "@/lib/utils";

export interface FollowButtonProps {
  profileId: string;
  /** Eu já sigo esta pessoa. */
  following: boolean;
  /** Nome da pessoa: completa o nome acessível ("Seguir Marina") em listas com vários botões. */
  personName?: string | null;
  size?: Extract<ButtonSize, "sm" | "md">;
  /**
   * false = não re-renderiza a página depois da ação (listas da /rede: o cartão fica no lugar e o
   * botão guarda o estado novo). Padrão: true (ex.: no perfil, os números se atualizam).
   */
  revalidate?: boolean;
  className?: string;
}

/**
 * Seguir / deixar de seguir, com atualização otimista. É um botão de alternância: o nome é FIXO
 * ("Seguir") e o estado vem do `aria-pressed` (docs/02 §13) — ligado, ganha o visto e o fundo
 * violeta. O resultado é anunciado por uma região `aria-live`.
 */
export function FollowButton({
  profileId,
  following,
  personName,
  size = "md",
  revalidate = true,
  className,
}: FollowButtonProps) {
  const [confirmed, setConfirmed] = useState(following);
  const [lastProp, setLastProp] = useState(following);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isPending, startTransition] = useTransition();

  // Dados novos do servidor (revalidação) substituem o último estado confirmado.
  if (lastProp !== following) {
    setLastProp(following);
    setConfirmed(following);
  }
  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_c, next: boolean) => next);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const name = firstNameOf(personName);
  const label = name ? `Seguir ${name}` : "Seguir";

  function handleClick() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      let result: Awaited<ReturnType<typeof followAction>>;
      try {
        result = next
          ? await followAction(profileId, { revalidate })
          : await unfollowAction(profileId, { revalidate });
      } catch {
        result = { ok: false, error: NETWORK_CONNECTION_ERROR };
      }
      startTransition(() => {
        if (result.ok) {
          setConfirmed(result.following);
          setAnnouncement(
            result.following
              ? `Você agora segue ${name || "esta pesquisadora"}.`
              : `Você deixou de seguir ${name || "esta pesquisadora"}.`,
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
        aria-label={name ? label : undefined}
        className={cn(
          buttonVariants({ variant: "outline", size }),
          optimistic &&
            "border-primary bg-primary-soft text-primary-soft-fg hover:border-primary hover:bg-primary-soft",
          className,
        )}
      >
        {optimistic ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Seguir
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
