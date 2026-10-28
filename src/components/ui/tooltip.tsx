import { cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";
import { TooltipDismiss } from "./tooltip-dismiss";

export interface TooltipProps {
  /** Texto curto e complementar (não coloque informação essencial só aqui). */
  content: React.ReactNode;
  /** Um único elemento focável (botão, link). Recebe aria-describedby. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  /** Lado em que a dica abre (padrão "top"). */
  side?: "top" | "bottom";
  /**
   * Alinhamento com o elemento: "center" (padrão), "start" (a dica começa na borda esquerda
   * dele e cresce para a direita) ou "end" (termina na borda direita e cresce para a esquerda).
   * Use start/end em elementos perto das bordas da tela, para a dica não sair dela no celular.
   */
  align?: "start" | "center" | "end";
  className?: string;
}

const sideClasses = { top: "bottom-full mb-2", bottom: "top-full mt-2" } as const;

const alignClasses = {
  start: "left-0 text-left",
  center: "left-1/2 -translate-x-1/2 text-center",
  end: "right-0 text-left",
} as const;

/**
 * Dica que aparece no hover e no foco do teclado (CSS) e some com Esc. Funciona em Server Components.
 * Para botões só com ícone, o nome continua vindo do aria-label; a dica complementa.
 *
 * Escondida, a dica fica com `display: none` (e não só invisível): assim ela não ocupa espaço
 * nem cria rolagem horizontal na página. A largura nunca passa da tela (`100vw - 2rem`).
 */
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
  const id = `dica-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const child = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" "),
      })
    : children;

  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {child}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute z-50 hidden w-max max-w-[min(15rem,calc(100vw-2rem))] rounded-badge bg-fg px-2.5 py-1.5 text-xs leading-snug font-medium text-bg opacity-0 shadow-raised",
          // Entra/sai com fade: `display` também transiciona (allow-discrete) e @starting-style dá o ponto de partida.
          "transition-[opacity,display] transition-discrete duration-150 starting:opacity-0",
          "group-focus-within/tooltip:block group-focus-within/tooltip:opacity-100 group-hover/tooltip:block group-hover/tooltip:opacity-100 group-hover/tooltip:delay-300",
          "group-data-dismissed/tooltip:hidden!",
          sideClasses[side],
          alignClasses[align],
        )}
      >
        {content}
      </span>
      <TooltipDismiss />
    </span>
  );
}
