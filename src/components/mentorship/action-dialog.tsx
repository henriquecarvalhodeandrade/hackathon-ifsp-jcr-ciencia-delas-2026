"use client";

import { useActionState, useState } from "react";
import { Button, Dialog, FormMessage, SubmitButton, type ButtonProps } from "@/components/ui";
import type { ActionState } from "@/lib/mentorship/types";

export interface MentorshipActionDialogProps {
  /** Server Action no formato do useActionState. */
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  children?: React.ReactNode;
}

/**
 * Confirmação com Server Action que mostra o erro DENTRO do diálogo (o ConfirmDialog do
 * design system não devolve o resultado da action). Fecha sozinho quando a action dá certo.
 */
export function MentorshipActionDialog({
  action,
  hiddenFields,
  triggerLabel,
  triggerIcon,
  triggerVariant = "outline",
  triggerSize = "sm",
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Voltar",
  tone = "danger",
  children,
}: MentorshipActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      description={description}
      trigger={
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      }
    >
      <form action={formAction} className="grid gap-4">
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {children}
        <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <SubmitButton
            variant={tone === "danger" ? "danger" : "primary"}
            pendingText={pendingLabel}
          >
            {confirmLabel}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
