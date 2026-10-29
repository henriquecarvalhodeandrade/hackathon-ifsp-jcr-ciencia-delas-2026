"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BackLinkProps {
  /** Para onde ir quando não dá para voltar pelo histórico (e sem JavaScript). */
  href: string;
  label: string;
  /**
   * Quando voltar pelo histórico:
   * - "same-path" (padrão): só se a página anterior é a do `href` (com qualquer filtro) — o rótulo
   *   promete um lugar ("Voltar ao feed"), então só volta se for para lá;
   * - "any": se a página anterior é qualquer página do site (rótulo genérico "Voltar").
   */
  match?: "same-path" | "any";
  className?: string;
}

type NavigationEntry = { url: string | null; index: number };
type NavigationLike = { currentEntry?: NavigationEntry | null; entries?: () => NavigationEntry[] };

/**
 * URL da entrada anterior do histórico, se for do site. A Navigation API só lista entradas da
 * mesma origem e acompanha as navegações do cliente do Next. Sem ela (navegadores antigos), vale
 * o `document.referrer` da carga inicial (se `history.length` indica que há para onde voltar).
 */
function previousInternalUrl(): URL | null {
  try {
    const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
    const current = navigation?.currentEntry;
    if (current && navigation?.entries) {
      if (current.index <= 0) return null;
      const previous = navigation.entries()[current.index - 1];
      return previous?.url ? new URL(previous.url) : null;
    }
    if (!document.referrer || window.history.length <= 1) return null;
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? referrer : null;
  } catch {
    return null;
  }
}

/**
 * Link "← Voltar" que volta pelo histórico quando a pessoa veio de onde o rótulo promete: o feed
 * reabre na mesma rolagem, a lista de vagas com os mesmos filtros (`/ics?bolsa=1`) e nenhuma
 * entrada nova vai para o histórico. Aberto direto (link externo, nova aba), segue o `href`.
 * Com Ctrl/⌘/Shift ou sem JavaScript, é um link comum.
 */
export function BackLink({ href, label, match = "same-path", className }: BackLinkProps) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const previous = previousInternalUrl();
        if (!previous) return;
        if (match === "same-path") {
          const target = new URL(href, window.location.origin);
          if (previous.pathname !== target.pathname) return;
        }
        event.preventDefault();
        router.back();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
