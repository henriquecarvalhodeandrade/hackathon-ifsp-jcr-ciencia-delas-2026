"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";
import { Button, Field, FormMessage, Textarea, type ButtonProps } from "@/components/ui";
import { respondRequestAction } from "@/app/mentoria/actions";
import { RESPONSE_MESSAGE_MAX } from "@/lib/mentorship/presentation";
import type { ActionState, RespondValues } from "@/lib/mentorship/types";

function DecisionButton({
  value,
  pendingText,
  variant,
  children,
}: {
  value: "accepted" | "declined";
  pendingText: string;
  variant: ButtonProps["variant"];
  children: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const isThis = pending && data?.get("decision") === value;
  return (
    <Button
      type="submit"
      name="decision"
      value={value}
      variant={variant}
      loading={isThis}
      loadingText={pendingText}
      disabled={pending}
    >
      {children}
    </Button>
  );
}

/** Aceitar ou recusar um pedido pendente, com resposta opcional para a mentoranda. */
export function RespondForm({ requestId, menteeName }: { requestId: string; menteeName: string }) {
  const [state, formAction] = useActionState<ActionState<RespondValues>, FormData>(respondRequestAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const previous = state?.values?.response_message ?? "";

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <Field
        label={`Resposta para ${menteeName}`}
        optional
        hint="Uma palavra de boas-vindas, um horário para conversarem ou o motivo da recusa."
        error={errors?.response_message}
      >
        <Textarea
          key={previous}
          name="response_message"
          rows={3}
          maxLength={RESPONSE_MESSAGE_MAX}
          showCount
          defaultValue={previous}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <DecisionButton value="accepted" variant="primary" pendingText="Aceitando…">
          <Check aria-hidden="true" />
          Aceitar mentoria
        </DecisionButton>
        <DecisionButton value="declined" variant="outline" pendingText="Recusando…">
          <X aria-hidden="true" />
          Recusar
        </DecisionButton>
      </div>
    </form>
  );
}
