"use client";

import { useActionState, useState } from "react";
import { Button, Dialog, FormMessage, SubmitButton, type ButtonProps } from "@/components/ui";
import type { SimpleActionState } from "@/lib/forum/actions";

type Action = (prev: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;

export interface ConfirmActionDialogProps {
  action: Action;
  hiddenFields: Record<string, string>;
  title: string;
  description?: string;
  confirmLabel: string;
  pendingLabel?: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  /** "danger" para exclusões (padrão). */
  tone?: "danger" | "primary";
  triggerClassName?: string;
}

/**
 * Confirmação (Dialog do design system) que executa uma Server Action e mostra o erro
 * dentro do próprio diálogo — a ConfirmDialog padrão fecha sem dar retorno quando falha.
 * Sucesso: a action redireciona ou revalida; o diálogo fecha sozinho.
 */
export function ConfirmActionDialog({
  action,
  hiddenFields,
  title,
  description,
  confirmLabel,
  pendingLabel = "Aguarde…",
  triggerLabel,
  triggerIcon,
  triggerVariant = "ghost",
  triggerSize = "sm",
  tone = "danger",
  triggerClassName,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      description={description}
      trigger={
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      }
    >
      <ConfirmForm
        action={action}
        hiddenFields={hiddenFields}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        tone={tone}
        onClose={() => setOpen(false)}
      />
    </Dialog>
  );
}

function ConfirmForm({
  action,
  hiddenFields,
  confirmLabel,
  pendingLabel,
  tone,
  onClose,
}: {
  action: Action;
  hiddenFields: Record<string, string>;
  confirmLabel: string;
  pendingLabel: string;
  tone: "danger" | "primary";
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<SimpleActionState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.ok) onClose();
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-4 pb-1">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <SubmitButton variant={tone === "danger" ? "danger" : "primary"} pendingText={pendingLabel}>
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
