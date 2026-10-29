"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, House, MessageCircle, Network, Newspaper } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { isActivePath } from "./nav-link";

/** As cinco áreas do dia a dia da rede, sempre a um toque no celular. */
export const TAB_BAR_ITEMS = [
  { href: "/painel", label: "Início", icon: House },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/rede", label: "Rede", icon: Network },
  { href: "/ics", label: "ICs", icon: FlaskConical },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
] as const;

/**
 * Telas de conversa (campo de mensagem embaixo + teclado): a barra sai para dar espaço.
 * Também fica fora do onboarding (as áreas da barra exigem o cadastro completo).
 */
const HIDDEN_ON: readonly RegExp[] = [
  /^\/mensagens\/[^/]+/,
  /^\/mentoria\/conversa\/[^/]+/,
  /^\/onboarding(\/|$)/,
];

export function isTabBarHidden(pathname: string | null): boolean {
  return pathname !== null && HIDDEN_ON.some((pattern) => pattern.test(pathname));
}

const NOT_TEXT_INPUT = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTypingTarget(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return !NOT_TEXT_INPUT.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Há um campo de texto em foco (o teclado do celular provavelmente está aberto). */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      // No focusout o foco ainda não chegou ao próximo elemento: confere no quadro seguinte.
      frame = requestAnimationFrame(() => setTyping(isTypingTarget(document.activeElement)));
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return typing;
}

export interface MobileTabBarProps {
  /** Conversas diretas com mensagem nova (o mesmo número do cabeçalho). */
  unreadMessages: number;
}

/**
 * Barra de abas fixa embaixo, abaixo de `lg` e só para membras com cadastro completo:
 * Início (painel) · Feed · Rede · ICs · Mensagens. 56 px + a área segura do iPhone.
 * Renderiza também um espaçador no fim da página, para o rodapé não ficar escondido atrás dela.
 * Some enquanto há um campo de texto em foco (teclado aberto) e nas telas de conversa.
 * A gaveta (MobileNav) continua com a lista completa.
 */
export function MobileTabBar({ unreadMessages }: MobileTabBarProps) {
  const pathname = usePathname();
  const typing = useTyping();
  if (isTabBarHidden(pathname)) return null;

  return (
    <>
      <div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Navegação rápida"
        data-tab-bar=""
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-bg/85 lg:hidden",
          typing && "hidden",
        )}
      >
        <ul className="mx-auto grid h-14 max-w-lg grid-cols-5 px-1">
          {TAB_BAR_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            const badge = href === "/mensagens" ? unreadMessages : 0;
            return (
              <li key={href} className="flex min-w-0">
                <Link
                  href={href}
                  aria-current={active === "page" ? "page" : active ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs leading-4 font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:-outline-offset-2",
                    active && "text-primary hover:text-primary",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center justify-center rounded-pill transition-colors [&_svg]:size-5",
                      active && "bg-primary-soft text-primary-soft-fg",
                    )}
                  >
                    <Icon />
                    {badge > 0 && (
                      <span className="absolute -top-1 right-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-accent px-1 text-[0.6875rem] leading-none font-bold text-accent-fg tabular ring-2 ring-bg">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                  {badge > 0 && (
                    <span className="sr-only">
                      {` (${formatNumber(badge)} ${badge === 1 ? "conversa nova" : "conversas novas"})`}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
