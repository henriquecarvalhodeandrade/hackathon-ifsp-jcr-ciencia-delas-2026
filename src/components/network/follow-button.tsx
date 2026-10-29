"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Plus, UserMinus } from "lucide-react";
import { buttonVariants, toast, type ButtonSize } from "@/components/ui";
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
  /** Abaixo de `sm`, só o ícone (o texto continua no nome acessível). Para linhas compactas. */
  iconOnlyOnMobile?: boolean;
  /**
   * false = não re-renderiza a página depois da ação (listas da /rede: o cartão fica no lugar e o
   * botão guarda o estado novo). Padrão: true (ex.: no perfil, os números se atualizam).
   */
  revalidate?: boolean;
  className?: string;
}

/**
 * Seguir / deixar de seguir, com atualização otimista. Exceção documentada em docs/02 §13: em vez
 * de `aria-pressed` com nome fixo, o texto É o estado — "Seguir" → "Seguindo" — e, no hover ou no
 * foco do teclado, vira a ação "Deixar de seguir". O nome acessível acompanha o texto visível
 * (o rótulo escondido usa `visibility: hidden`, que sai da árvore de acessibilidade, e os dois
 * ocupam a mesma célula: o botão não muda de largura).
 */
export function FollowButton({
  profileId,
  following,
  personName,
  size = "md",
  iconOnlyOnMobile = false,
  revalidate = true,
  className,
}: FollowButtonProps) {
  const [confirmed, setConfirmed] = useState(following);
  const [lastProp, setLastProp] = useState(following);
  const [, startTransition] = useTransition();

  // Dados novos do servidor (revalidação) substituem o último estado confirmado.
  if (lastProp !== following) {
    setLastProp(following);
    setConfirmed(following);
  }
  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_c, next: boolean) => next);

  const name = firstNameOf(personName);
  const who = name || "esta pesquisadora";

  function handleClick() {
    const next = !optimistic;
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
          toast({
            message: result.following
              ? `Você agora segue ${who}. As publicações dela aparecem no seu feed.`
              : `Você deixou de seguir ${who}.`,
            tone: result.following ? "success" : "info",
          });
        } else {
          toast({ message: result.error, tone: "danger" });
        }
      });
    });
  }

  const label = (text: string) => (
    <span className={cn(iconOnlyOnMobile && "max-sm:sr-only")}>
      {text}
      {name && <span className="sr-only"> {name}</span>}
    </span>
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        buttonVariants({ variant: "outline", size }),
        "group",
        size === "sm" && "pointer-coarse:h-11 pointer-coarse:px-4",
        iconOnlyOnMobile && (size === "sm" ? "max-sm:w-8 max-sm:px-0" : "max-sm:w-10 max-sm:px-0"),
        iconOnlyOnMobile && size === "sm" && "max-sm:pointer-coarse:w-11",
        optimistic &&
          "hover:border-danger/50 hover:bg-danger-soft hover:text-danger-soft-fg focus-visible:border-danger/50 focus-visible:bg-danger-soft focus-visible:text-danger-soft-fg",
        className,
      )}
    >
      {optimistic ? (
        <>
          {/* Seguindo (repouso) e Deixar de seguir (hover/foco) na mesma célula da grade. */}
          <span className="grid items-center justify-items-center">
            <span className="inline-flex items-center gap-2 [grid-area:1/1] group-hover:invisible group-focus-visible:invisible">
              <Check aria-hidden="true" />
              {label("Seguindo")}
            </span>
            <span className="invisible inline-flex items-center gap-2 [grid-area:1/1] group-hover:visible group-focus-visible:visible">
              <UserMinus aria-hidden="true" />
              {label("Deixar de seguir")}
            </span>
          </span>
        </>
      ) : (
        <>
          <Plus aria-hidden="true" />
          {label("Seguir")}
        </>
      )}
    </button>
  );
}
