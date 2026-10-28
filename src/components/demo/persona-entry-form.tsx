"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { enterDemoPersona, type DemoActionState } from "@/app/demo/actions";
import { FormMessage, SubmitButton } from "@/components/ui";

const INITIAL: DemoActionState = { ok: false };

export interface PersonaEntryFormProps {
  slug: string;
  firstName: string;
}

/**
 * Botão "Entrar como <Nome>". O formulário só leva o slug; o servidor confere tudo de novo.
 * Funciona sem JavaScript (o formulário é enviado normalmente e a resposta redireciona).
 */
export function PersonaEntryForm({ slug, firstName }: PersonaEntryFormProps) {
  const [state, formAction] = useActionState(enterDemoPersona, INITIAL);
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="persona" value={slug} />
      <SubmitButton fullWidth pendingText={`Entrando como ${firstName}…`}>
        <LogIn aria-hidden="true" />
        Entrar como {firstName}
      </SubmitButton>
      <FormMessage tone="error">{state.error}</FormMessage>
    </form>
  );
}
