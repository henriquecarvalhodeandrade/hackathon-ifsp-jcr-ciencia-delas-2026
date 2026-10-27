"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

/**
 * O que a action/onConfirm pode devolver. `{ ok: false, error }` (o contrato das Server Actions)
 * mantém o diálogo aberto e mostra o erro; qualquer outro retorno fecha o diálogo.
 */
export type ConfirmResult = void | undefined | { ok: boolean; error?: string };

function failureMessage(result: unknown): string | null {
  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    const error = "error" in result && typeof result.error === "string" ? result.error : "";
    return error || "Não foi possível concluir. Tente de novo.";
  }
  return null;
}

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
  /**
   * Server Action executada ao confirmar (recebe o FormData com `hiddenFields`).
   * Pode devolver `{ ok: false, error }` para manter o diálogo aberto com a mensagem.
   */
  action?: (formData: FormData) => ConfirmResult | Promise<ConfirmResult>;
  /** Campos ocultos enviados com a action, ex.: { id: thread.id }. */
  hiddenFields?: Record<string, string>;
  /** Alternativa sem formulário (uso só no cliente). Mesmo contrato de retorno da `action`. */
  onConfirm?: () => ConfirmResult | Promise<ConfirmResult>;
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
  const [error, setError] = useState<string | null>(null);
  const confirmVariant = tone === "danger" ? "danger" : "primary";

  function changeOpen(value: boolean) {
    if (value) setError(null);
    setOpen(value);
  }

  function finish(result: unknown) {
    const message = failureMessage(result);
    if (message) setError(message);
    else setOpen(false);
  }

  async function handleClientConfirm() {
    if (!onConfirm) return setOpen(false);
    setBusy(true);
    setError(null);
    try {
      finish(await onConfirm());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
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
                setError(null);
                finish(await action(formData));
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
      <FormMessage tone="error" className={children ? "mt-3" : undefined}>
        {error}
      </FormMessage>
    </Dialog>
  );
}
