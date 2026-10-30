"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { BadgeCheck, CircleAlert, FileSignature, Trash2, Undo2, X } from "lucide-react";
import {
  Checkbox,
  ConfirmDialog,
  Field,
  FormMessage,
  SubmitButton,
  Textarea,
  type ButtonProps,
} from "@/components/ui";
import {
  consentDeclarationAction,
  deleteFeedbackAction,
  requestDeclarationAction,
  revokeDeclarationAction,
} from "@/lib/recognition/actions";
import { REVOKE_REASON_MAX, type ReturnTo } from "@/lib/recognition/schemas";
import type { RecognitionActionState } from "@/lib/recognition/types";

export const CONSENT_LABEL =
  "Autorizo que meu nome apareça na declaração e na página pública de verificação";

/**
 * Caixa de autorização (obrigatória) com o erro ligado por aria-describedby. Com erro, recebe o
 * foco (o botão de envio fica desabilitado durante o envio e o foco cairia no <body>).
 */
function ConsentCheckbox({
  error,
  description,
  state,
}: {
  error?: string;
  description: string;
  /** Estado da ação: a cada resposta com erro na caixa, o foco volta para ela. */
  state: RecognitionActionState;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state && !state.ok && state.fieldErrors?.consent) ref.current?.focus();
  }, [state]);
  return (
    <div className="grid gap-1.5">
      <Checkbox
        ref={ref}
        id={`${id}-autorizo`}
        name="consent"
        required
        label={CONSENT_LABEL}
        description={description}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
      />
      {error && (
        <p id={`${id}-erro`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function errorOf(state: RecognitionActionState, field: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

/** "Pedir declaração" (ou "Pedir uma nova"): quem pede já autoriza o próprio nome. */
export function DeclarationRequestForm({
  requestId,
  otherFirstName,
  returnTo,
  label = "Pedir declaração",
}: {
  requestId: string;
  otherFirstName: string;
  returnTo: ReturnTo;
  label?: string;
}) {
  const [state, formAction] = useActionState<RecognitionActionState, FormData>(
    requestDeclarationAction,
    null,
  );
  const consentError = errorOf(state, "consent");
  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <ConsentCheckbox
        error={consentError}
        state={state}
        description={`A declaração só é emitida quando ${otherFirstName} também autorizar.`}
      />
      <FormMessage tone="error">
        {state && !state.ok && !consentError ? state.error : null}
      </FormMessage>
      <div>
        <SubmitButton size="sm" pendingText="Pedindo…">
          <FileSignature aria-hidden="true" />
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}

/** A outra pediu: "Autorizar e emitir" (com a mesma caixa de autorização). */
export function DeclarationConsentForm({
  requestId,
  declarationId,
  otherFirstName,
  returnTo,
}: {
  requestId: string;
  declarationId: string;
  otherFirstName: string;
  returnTo: ReturnTo;
}) {
  const [state, formAction] = useActionState<RecognitionActionState, FormData>(
    consentDeclarationAction,
    null,
  );
  const consentError = errorOf(state, "consent");
  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="declaration_id" value={declarationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <ConsentCheckbox
        error={consentError}
        state={state}
        description={`${otherFirstName} já autorizou o nome dela. Com a sua autorização, a declaração é emitida.`}
      />
      <FormMessage tone="error">
        {state && !state.ok && !consentError ? state.error : null}
      </FormMessage>
      <div>
        <SubmitButton size="sm" pendingText="Emitindo…">
          <BadgeCheck aria-hidden="true" />
          Autorizar e emitir
        </SubmitButton>
      </div>
    </form>
  );
}

type RevokeMode = "revoke" | "cancel" | "decline";

const REVOKE_COPY: Record<
  RevokeMode,
  {
    trigger: string;
    title: string;
    confirm: string;
    pending: string;
    variant: ButtonProps["variant"];
  }
> = {
  revoke: {
    trigger: "Revogar",
    title: "Revogar esta declaração?",
    confirm: "Sim, revogar",
    pending: "Revogando…",
    variant: "outline",
  },
  cancel: {
    trigger: "Cancelar pedido",
    title: "Cancelar o pedido de declaração?",
    confirm: "Sim, cancelar pedido",
    pending: "Cancelando…",
    variant: "ghost",
  },
  decline: {
    trigger: "Recusar",
    title: "Recusar o pedido de declaração?",
    confirm: "Sim, recusar",
    pending: "Recusando…",
    variant: "ghost",
  },
};

/** Revogar (emitida), cancelar (pedido meu) ou recusar (pedido da outra). Motivo opcional. */
export function RevokeDeclarationDialog({
  requestId,
  declarationId,
  otherFirstName,
  returnTo,
  mode,
}: {
  requestId: string;
  declarationId: string;
  otherFirstName: string;
  returnTo: ReturnTo;
  mode: RevokeMode;
}) {
  const copy = REVOKE_COPY[mode];
  const description =
    mode === "revoke"
      ? "Na página de verificação, o código passa a aparecer como revogado, sem nomes. Não dá para desfazer, mas vocês podem pedir uma nova depois."
      : mode === "cancel"
        ? `Nenhum nome foi publicado. ${otherFirstName} deixa de ver o pedido, e você pode pedir de novo quando quiser.`
        : `Nenhum nome é publicado. ${otherFirstName} verá que o pedido foi recusado.`;
  return (
    <ConfirmDialog<RecognitionActionState>
      stateAction={revokeDeclarationAction}
      hiddenFields={{ request_id: requestId, declaration_id: declarationId, return_to: returnTo }}
      triggerLabel={copy.trigger}
      triggerIcon={mode === "revoke" ? <Undo2 aria-hidden="true" /> : <X aria-hidden="true" />}
      triggerVariant={copy.variant}
      triggerSize="sm"
      title={copy.title}
      description={description}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      cancelLabel="Voltar"
      tone={mode === "revoke" ? "danger" : "primary"}
    >
      {mode !== "cancel" && (
        <Field
          label="Motivo"
          optional
          hint={`Só vocês duas veem. Até ${REVOKE_REASON_MAX} caracteres.`}
        >
          <Textarea name="reason" rows={3} maxLength={REVOKE_REASON_MAX} showCount />
        </Field>
      )}
    </ConfirmDialog>
  );
}

/** Apagar o próprio retorno (LGPD: ela decide; depois pode contar de novo). */
export function DeleteFeedbackDialog({ requestId }: { requestId: string }) {
  return (
    <ConfirmDialog<RecognitionActionState>
      stateAction={deleteFeedbackAction}
      hiddenFields={{ request_id: requestId }}
      triggerLabel="Apagar meu retorno"
      triggerIcon={<Trash2 aria-hidden="true" />}
      triggerVariant="ghost"
      triggerSize="sm"
      title="Apagar o seu retorno?"
      description="Suas respostas e sua nota saem da plataforma (e dos números gerais). Se quiser, você pode contar como foi de novo depois."
      confirmLabel="Sim, apagar"
      pendingLabel="Apagando…"
      cancelLabel="Voltar"
    />
  );
}
