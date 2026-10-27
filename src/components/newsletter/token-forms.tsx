"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BellOff, CircleCheck, MailCheck, Trash2 } from "lucide-react";
import { Button, ButtonLink, ConfirmDialog, FormMessage, SubmitButton } from "@/components/ui";
import {
  confirmNewsletterSubscription,
  deleteNewsletterData,
  unsubscribeFromNewsletter,
  type TokenActionState,
} from "@/app/newsletter/actions";

function SuccessPanel({ title, message, children }: { title: string; message: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <CircleCheck className="size-5" />
        </span>
        <div className="grid gap-1">
          <p className="font-display text-xl font-semibold text-fg">{title}</p>
          <p className="text-fg-muted">{message}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Botão de confirmação do double opt-in (um clique explícito: robôs que abrem links não confirmam). */
export function ConfirmSubscriptionForm({ token }: { token: string }) {
  const [state, action] = useActionState<TokenActionState, FormData>(confirmNewsletterSubscription, null);

  if (state?.ok) {
    return (
      <SuccessPanel title="Inscrição confirmada" message={state.message}>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/newsletter">Ver edições anteriores</ButtonLink>
          <ButtonLink href="/papers" variant="outline">
            Explorar a Vitrine
          </ButtonLink>
        </div>
      </SuccessPanel>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <div>
        <SubmitButton size="lg" pendingText="Confirmando…">
          <MailCheck aria-hidden="true" />
          Confirmar inscrição
        </SubmitButton>
      </div>
    </form>
  );
}

/** Descadastro com um clique + opção de excluir os dados (LGPD). */
export function UnsubscribeForms({ token, alreadyUnsubscribed }: { token: string; alreadyUnsubscribed: boolean }) {
  const [state, action] = useActionState<TokenActionState, FormData>(unsubscribeFromNewsletter, null);
  const done = alreadyUnsubscribed || state?.ok;

  const deleteBlock = (
    <div className="grid gap-3 rounded-card border border-border bg-surface-2 p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 className="font-display text-lg font-semibold text-fg">Excluir meus dados</h2>
        <p className="text-sm text-fg-muted">
          Apaga o seu e-mail, as áreas de interesse, o registro do consentimento e o histórico de envios. Se quiser
          voltar, é só se inscrever de novo.
        </p>
      </div>
      <div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="text-danger hover:bg-danger-soft hover:text-danger-soft-fg">
              <Trash2 aria-hidden="true" />
              Excluir meus dados
            </Button>
          }
          title="Excluir seus dados da newsletter?"
          description="Seu e-mail e o histórico de envios serão apagados de vez. Essa ação não pode ser desfeita."
          confirmLabel="Sim, excluir"
          pendingLabel="Excluindo…"
          action={deleteNewsletterData}
          hiddenFields={{ token }}
        />
      </div>
    </div>
  );

  if (done) {
    return (
      <div className="grid gap-6">
        <SuccessPanel
          title="Inscrição cancelada"
          message={
            state?.ok ? state.message : "Esta inscrição já está cancelada — você não recebe mais o Boletim Delas."
          }
        >
          <p className="text-sm text-fg-muted">
            Mudou de ideia?{" "}
            <Link href="/newsletter#assinar" className="font-semibold text-primary underline underline-offset-2">
              Inscreva-se de novo
            </Link>{" "}
            quando quiser.
          </p>
        </SuccessPanel>
        {deleteBlock}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
        <div>
          <SubmitButton size="lg" variant="danger" pendingText="Cancelando…">
            <BellOff aria-hidden="true" />
            Cancelar inscrição
          </SubmitButton>
        </div>
      </form>
      {deleteBlock}
    </div>
  );
}
