"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type NavigationLike = { currentEntry?: { index: number } | null };

/**
 * A entrada anterior do histórico é uma página da Artemis? A Navigation API só lista entradas da
 * mesma origem (índice > 0 = dá para voltar sem sair do site), e ela acompanha as navegações do
 * cliente do Next. Sem ela (navegadores antigos), vale o `document.referrer` da carga inicial.
 */
function cameFromInside(): boolean {
  try {
    const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
    if (navigation?.currentEntry) return navigation.currentEntry.index > 0;
    return (
      document.referrer !== "" &&
      new URL(document.referrer).origin === window.location.origin &&
      window.history.length > 1
    );
  } catch {
    return false;
  }
}

/**
 * "← Voltar": volta pelo histórico quando a pessoa chegou de outra página da Artemis (feed, rede,
 * notificações…), mantendo a rolagem de lá; aberto direto (link externo, nova aba), vai para
 * `fallbackHref`. Sem JavaScript, é um link comum para o `fallbackHref`.
 */
export function BackLink({
  fallbackHref,
  label = "Voltar",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (!cameFromInside()) return;
        event.preventDefault();
        router.back();
      }}
      className="inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
