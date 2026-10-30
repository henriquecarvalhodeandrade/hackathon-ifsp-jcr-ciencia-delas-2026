"use client";

import { useActionState } from "react";
import { CirclePause, CirclePlay } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { setAvailabilityAction } from "@/app/mentoria/actions";
import type { ActionState } from "@/lib/mentorship/types";

/** Ação rápida da mentora: pausar ou retomar novos pedidos (profiles.mentor_available). */
export function AvailabilityForm({ available }: { available: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(setAvailabilityAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="available" value={available ? "false" : "true"} />
      <div>
        <SubmitButton variant="outline" size="sm" pendingText="Salvando…">
          {available ? <CirclePause aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
          {available ? "Pausar novos pedidos" : "Voltar a receber pedidos"}
        </SubmitButton>
      </div>
      <FormMessage tone={state?.ok ? "success" : "error"}>
        {state ? (state.ok ? state.message : state.error) : null}
      </FormMessage>
    </form>
  );
}
