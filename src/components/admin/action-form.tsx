"use client";

import { useState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import type { ActionState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";
import { announce } from "./flash";

export type ServerActionFn = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface ActionFormProps {
  /** Server Action no formato (estadoAnterior, formData) → ActionState. */
  action: ServerActionFn;
  /** Campos ocultos enviados junto (ids etc.). */
  hiddenFields?: Record<string, string>;
  /** Controles do formulário (normalmente um <SubmitButton>). */
  children: React.ReactNode;
  className?: string;
  messageClassName?: string;
}

/**
 * Formulário de uma ação (fixar, ocultar, resolver…). O sucesso é anunciado na região
 * fixa do painel (o cartão pode sumir da lista depois da revalidação); o erro aparece
 * aqui mesmo, junto do botão.
 */
export function ActionForm({ action, hiddenFields, children, className, messageClassName }: ActionFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function run(formData: FormData) {
    setError(null);
    try {
      const result = await action(null, formData);
      if (!result) return;
      if (result.ok) announce(result.message);
      else setError(result.error);
    } catch {
      setError("Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.");
    }
  }

  return (
    <form action={run} className={cn("grid gap-2", className)}>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <FormMessage tone="error" className={messageClassName}>
        {error}
      </FormMessage>
    </form>
  );
}

/** Executa uma Server Action fora de <form> (ex.: dentro do ConfirmDialog) e anuncia o resultado. */
export async function runAndAnnounce(action: ServerActionFn, formData: FormData): Promise<ActionState> {
  try {
    const result = await action(null, formData);
    if (result) announce(result.ok ? result.message : result.error, result.ok ? "success" : "danger");
    return result;
  } catch {
    const message = "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
    announce(message, "danger");
    return { ok: false, error: message };
  }
}
