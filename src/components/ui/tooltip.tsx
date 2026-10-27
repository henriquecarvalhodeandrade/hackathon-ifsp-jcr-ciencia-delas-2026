import { cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";
import { TooltipDismiss } from "./tooltip-dismiss";

export interface TooltipProps {
  /** Texto curto e complementar (não coloque informação essencial só aqui). */
  content: React.ReactNode;
  /** Um único elemento focável (botão, link). Recebe aria-describedby. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Dica que aparece no hover e no foco do teclado (CSS) e some com Esc. Funciona em Server Components.
 * Para botões só com ícone, o nome continua vindo do aria-label; a dica complementa.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
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
          "pointer-events-none invisible absolute left-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-badge bg-fg px-2.5 py-1.5 text-center text-xs leading-snug font-medium text-bg opacity-0 shadow-raised transition-[opacity,visibility] duration-150",
          "group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-hover/tooltip:delay-300",
          "group-data-dismissed/tooltip:invisible! group-data-dismissed/tooltip:opacity-0!",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
      <TooltipDismiss />
    </span>
  );
}
