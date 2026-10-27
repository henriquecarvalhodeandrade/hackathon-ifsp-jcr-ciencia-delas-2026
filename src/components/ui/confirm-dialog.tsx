"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";
import { SubmitButton } from "./submit-button";

export interface ConfirmDialogProps {
  /** Elemento que abre a confirmação (padrão: botão com `triggerLabel`). */
  trigger?: React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** "danger" para ações destrutivas (padrão), "primary" para as demais. */
  tone?: "danger" | "primary";
  /** Server Action executada ao confirmar (recebe o FormData com `hiddenFields`). */
  action?: (formData: FormData) => void | Promise<void>;
  /** Campos ocultos enviados com a action, ex.: { id: thread.id }. */
  hiddenFields?: Record<string, string>;
  /** Alternativa sem formulário (uso só no cliente). */
  onConfirm?: () => void | Promise<void>;
  children?: React.ReactNode;
}

/**
 * Confirmação antes de ações importantes. Com `action`, envia um formulário para a
 * Server Action e mostra o estado de carregamento no botão.
 */
export function ConfirmDialog({
  trigger,
  triggerLabel = "Excluir",
  triggerVariant = "outline",
  triggerSize = "md",
  title,
  description,
  confirmLabel = "Confirmar",
  pendingLabel = "Aguarde…",
  cancelLabel = "Cancelar",
  tone = "danger",
  action,
  hiddenFields,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmVariant = tone === "danger" ? "danger" : "primary";

  async function handleClientConfirm() {
    if (!onConfirm) return setOpen(false);
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      description={description}
      trigger={
        trigger ?? (
          <Button variant={triggerVariant} size={triggerSize}>
            {triggerLabel}
          </Button>
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          {action ? (
            <form
              action={async (formData) => {
                await action(formData);
                setOpen(false);
              }}
            >
              {hiddenFields &&
                Object.entries(hiddenFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
              <SubmitButton variant={confirmVariant} pendingText={pendingLabel} fullWidth>
                {confirmLabel}
              </SubmitButton>
            </form>
          ) : (
            <Button variant={confirmVariant} loading={busy} loadingText={pendingLabel} onClick={handleClientConfirm}>
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {children}
    </Dialog>
  );
}
