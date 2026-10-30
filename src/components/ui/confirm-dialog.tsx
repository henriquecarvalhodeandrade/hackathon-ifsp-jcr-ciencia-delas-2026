"use client";

import { useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

/**
 * O que a action/onConfirm pode devolver. `{ ok: false, error }` (o contrato das Server Actions)
 * mantém o diálogo aberto e mostra o erro; qualquer outro retorno fecha o diálogo.
 */
export type ConfirmResult = void | undefined | null | { ok: boolean; error?: string };

/** Mensagem quando a action nem chega a responder (rede caiu, erro inesperado no servidor). */
export const CONFIRM_CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/** Texto de erro de um resultado `{ ok: false }` (ou null quando deu certo). */
export function confirmFailureMessage(result: unknown): string | null {
  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    const error = "error" in result && typeof result.error === "string" ? result.error : "";
    return error || "Não foi possível concluir. Tente de novo.";
  }
  return null;
}

export interface ConfirmDialogProps<S extends ConfirmResult = ConfirmResult> {
  /** Elemento que abre a confirmação (padrão: botão com `triggerIcon` + `triggerLabel`). Pode vir de um Server Component. */
  trigger?: React.ReactElement;
  triggerLabel?: string;
  /** Ícone do botão padrão, ex.: <Trash2 aria-hidden="true" />. */
  triggerIcon?: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** "danger" para ações destrutivas (padrão), "primary" para as demais. */
  tone?: "danger" | "primary";
  /**
   * Server Action executada ao confirmar (recebe o FormData com `hiddenFields` e os campos de `children`).
   * Pode devolver `{ ok: false, error }` para manter o diálogo aberto com a mensagem.
   */
  action?: (formData: FormData) => S | Promise<S>;
  /**
   * Alternativa a `action` para Server Actions no formato do `useActionState`:
   * `(estadoAnterior, formData) => Promise<estado>`. O estado anterior é `null` a cada abertura.
   */
  stateAction?: (prev: S | null, formData: FormData) => Promise<S | null>;
  /** Campos ocultos enviados com a action, ex.: { id: thread.id }. */
  hiddenFields?: Record<string, string>;
  /** Alternativa sem formulário (uso só no cliente). Mesmo contrato de retorno da `action`. */
  onConfirm?: () => ConfirmResult | Promise<ConfirmResult>;
  /** Conteúdo extra no corpo. Com `action`/`stateAction`, campos aqui são enviados no formulário. */
  children?: React.ReactNode;
}

/**
 * Confirmação antes de ações importantes. Com `action`/`stateAction`, envia um formulário para a
 * Server Action e mostra o estado de carregamento no botão. Erros (`{ ok: false, error }` ou falha
 * de conexão) aparecem dentro do diálogo, que continua aberto; `redirect()`/`notFound()` seguem normais.
 */
export function ConfirmDialog<S extends ConfirmResult = ConfirmResult>({
  trigger,
  triggerLabel = "Excluir",
  triggerIcon,
  triggerVariant = "outline",
  triggerSize = "md",
  triggerClassName,
  title,
  description,
  confirmLabel = "Confirmar",
  pendingLabel = "Aguarde…",
  cancelLabel = "Cancelar",
  tone = "danger",
  action,
  stateAction,
  hiddenFields,
  onConfirm,
  children,
}: ConfirmDialogProps<S>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastState = useRef<S | null>(null);
  const confirmVariant = tone === "danger" ? "danger" : "primary";
  const submit = stateAction ?? action;

  function changeOpen(value: boolean) {
    if (value) {
      setError(null);
      lastState.current = null;
    }
    setOpen(value);
  }

  function finish(result: unknown) {
    const message = confirmFailureMessage(result);
    if (message) setError(message);
    else setOpen(false);
  }

  async function run(task: () => unknown) {
    setError(null);
    try {
      finish(await task());
    } catch (caught) {
      // redirect()/notFound() da action continuam com o Next; o resto vira mensagem no diálogo.
      unstable_rethrow(caught);
      setError(CONFIRM_CONNECTION_ERROR);
    }
  }

  async function submitForm(formData: FormData) {
    await run(async () => {
      if (stateAction) {
        const result = await stateAction(lastState.current, formData);
        lastState.current = result;
        return result;
      }
      return action?.(formData);
    });
  }

  async function handleClientConfirm() {
    if (!onConfirm) return setOpen(false);
    setBusy(true);
    try {
      await run(onConfirm);
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
      formProps={submit ? { action: submitForm } : undefined}
      trigger={
        trigger ?? (
          <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
            {triggerIcon}
            {triggerLabel}
          </Button>
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          {submit ? (
            <SubmitButton variant={confirmVariant} pendingText={pendingLabel}>
              {confirmLabel}
            </SubmitButton>
          ) : (
            <Button
              variant={confirmVariant}
              loading={busy}
              loadingText={pendingLabel}
              onClick={handleClientConfirm}
            >
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {children}
      <FormMessage tone="error" className={children ? "mt-3" : undefined}>
        {error}
      </FormMessage>
    </Dialog>
  );
}
