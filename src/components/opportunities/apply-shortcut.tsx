"use client";

import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

/** id do campo da carta no <ApplyForm> (o atalho leva o foco direto para ele). */
export const APPLY_MESSAGE_ID = "carta-apresentacao";

/**
 * "Candidatar-se" no resumo da vaga: rola até o formulário e põe o foco na carta. Sem JavaScript,
 * é só um link para a âncora #candidatar.
 */
export function ApplyShortcut({ className }: { className?: string }) {
  return (
    <a
      href="#candidatar"
      className={cn(buttonVariants({ fullWidth: true }), className)}
      onClick={(event) => {
        const field = document.getElementById(APPLY_MESSAGE_ID);
        if (!field) return;
        event.preventDefault();
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        field.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        field.focus({ preventScroll: true });
      }}
    >
      Candidatar-se
    </a>
  );
}
