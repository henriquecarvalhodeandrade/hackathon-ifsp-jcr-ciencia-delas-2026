"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { enterDemoPersona, type DemoActionState } from "@/app/demo/actions";
import { FormMessage, SubmitButton, type ButtonVariant } from "@/components/ui";

const INITIAL: DemoActionState = { ok: false };

export interface PersonaEntryFormProps {
  slug: string;
  firstName: string;
  /** "outline" no cartão da persona em que a pessoa já está (o destaque vai para "Ir para o painel"). */
  variant?: ButtonVariant;
}

/**
 * Botão "Entrar como <Nome>". O formulário só leva o slug; o servidor confere tudo de novo.
 * Funciona sem JavaScript (o formulário é enviado normalmente e a resposta redireciona).
 */
export function PersonaEntryForm({ slug, firstName, variant = "primary" }: PersonaEntryFormProps) {
  const [state, formAction] = useActionState(enterDemoPersona, INITIAL);
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="persona" value={slug} />
      <SubmitButton fullWidth variant={variant} pendingText={`Entrando como ${firstName}…`}>
        <LogIn aria-hidden="true" />
        Entrar como {firstName}
      </SubmitButton>
      {/* Sempre montada (aria-live); vazia, sai do fluxo para não somar espaço ao cartão. */}
      <FormMessage tone="error" className={state.error ? undefined : "sr-only"}>
        {state.error}
      </FormMessage>
    </form>
  );
}
