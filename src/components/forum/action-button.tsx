"use client";

import { useActionState } from "react";
import { SubmitButton, type ButtonProps } from "@/components/ui";
import type { SimpleActionState } from "@/lib/forum/actions";
import { CONNECTION_ERROR, withConnectionFallback } from "@/lib/forum/client-action";
import { cn } from "@/lib/utils";

export interface ActionButtonProps {
  action: (prev: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;
  hiddenFields: Record<string, string>;
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/**
 * Botão que envia uma Server Action (fixar, trancar, marcar solução…). Erros aparecem
 * logo abaixo; sucesso é anunciado só para leitores de tela (a página já muda).
 */
export function ActionButton({
  action,
  hiddenFields,
  children,
  pendingText = "Aguarde…",
  variant = "outline",
  size = "sm",
  className,
}: ActionButtonProps) {
  const [state, formAction] = useActionState<SimpleActionState, FormData>(
    withConnectionFallback(action, () => ({ ok: false, error: CONNECTION_ERROR })),
    null,
  );
  const failed = Boolean(state && !state.ok);
  return (
    <form action={formAction} className={cn("inline-flex flex-col items-start gap-1", className)}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} pendingText={pendingText}>
        {children}
      </SubmitButton>
      <span
        aria-live="polite"
        className={failed ? "max-w-xs text-sm font-medium text-danger" : "sr-only"}
      >
        {state ? (state.ok ? state.message : state.error) : ""}
      </span>
    </form>
  );
}
