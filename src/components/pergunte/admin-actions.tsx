"use client";

import { Check, Eye, EyeOff, Trash2, X } from "lucide-react";
import { ActionForm, runInConfirmDialog } from "@/components/admin/action-form";
import { ConfirmDialog, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { removeQuestion, reviewQuestion, setAnswerHidden } from "@/lib/pergunte/actions";
import { REJECT_REASON_OPTIONS } from "@/lib/pergunte/labels";
import { HIDE_REASON_MAX, REMOVE_REASON_LIMITS } from "@/lib/pergunte/schemas";

/** "Publicar": um clique (o texto inteiro está no cartão, logo acima). */
export function PublishQuestionButton({ questionId }: { questionId: string }) {
  return (
    <ActionForm action={reviewQuestion} hiddenFields={{ questionId, decision: "publish" }}>
      <SubmitButton size="sm" variant="secondary" pendingText="Publicando…">
        <Check aria-hidden="true" />
        Publicar
      </SubmitButton>
    </ActionForm>
  );
}

/** "Não publicar": exige um motivo da lista (quem perguntou vê um texto acolhedor sobre ele). */
export function RejectQuestionDialog({ questionId }: { questionId: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Não publicar"
      triggerIcon={<X aria-hidden="true" />}
      triggerVariant="outline"
      triggerSize="sm"
      title="Não publicar esta pergunta?"
      description="Quem perguntou verá o motivo, com um texto acolhedor, no link de acompanhamento. A pergunta é apagada de vez 30 dias depois."
      confirmLabel="Não publicar"
      pendingLabel="Registrando…"
      cancelLabel="Voltar"
      hiddenFields={{ questionId, decision: "reject" }}
      action={(formData) => runInConfirmDialog(reviewQuestion, formData)}
    >
      <Field label="Motivo" required>
        <Select
          name="reason"
          defaultValue=""
          placeholder="Escolha um motivo"
          options={REJECT_REASON_OPTIONS}
          data-autofocus=""
        />
      </Field>
    </ConfirmDialog>
  );
}

/** "Ocultar"/"Reexibir" uma resposta pública, com motivo opcional (vai para o registro). */
export function AnswerVisibilityDialog({
  answerId,
  hidden,
}: {
  answerId: string;
  /** Estado atual da resposta. */
  hidden: boolean;
}) {
  const hide = !hidden;
  return (
    <ConfirmDialog
      triggerLabel={hide ? "Ocultar" : "Reexibir"}
      triggerIcon={hide ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      triggerVariant={hide ? "ghost" : "outline"}
      triggerSize="sm"
      triggerClassName={hide ? "text-danger hover:bg-danger-soft hover:text-danger-soft-fg" : ""}
      tone={hide ? "danger" : "primary"}
      title={hide ? "Ocultar esta resposta?" : "Reexibir esta resposta?"}
      description={
        hide
          ? "Ela deixa de aparecer para o público e para a contagem de respostas. Dá para reexibir depois."
          : "Ela volta a aparecer na pergunta para todo mundo."
      }
      confirmLabel={hide ? "Ocultar resposta" : "Reexibir resposta"}
      pendingLabel={hide ? "Ocultando…" : "Reexibindo…"}
      cancelLabel="Voltar"
      hiddenFields={{ answerId, hidden: hide ? "true" : "false" }}
      action={(formData) => runInConfirmDialog(setAnswerHidden, formData)}
    >
      <Field label="Motivo" optional hint="Fica no registro da moderação. A autora não é avisada.">
        <Input name="reason" maxLength={HIDE_REASON_MAX} autoComplete="off" data-autofocus="" />
      </Field>
    </ConfirmDialog>
  );
}

/**
 * "Remover pergunta" (moderação): apaga de vez a pergunta e as respostas — quando algo que
 * identifica a estudante passou na revisão, ou quando ela pede a exclusão sem ter o link. O motivo
 * vai para o registro da moderação; depois, volta para /pergunte com a confirmação.
 */
export function RemoveQuestionDialog({ questionId }: { questionId: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Remover pergunta"
      triggerIcon={<Trash2 aria-hidden="true" />}
      triggerVariant="danger"
      triggerSize="sm"
      title="Remover esta pergunta de vez?"
      description="A pergunta e todas as respostas dela são apagadas para sempre. Quem tem o link de acompanhamento passa a ver “Não encontramos esta pergunta”."
      confirmLabel="Remover de vez"
      pendingLabel="Removendo…"
      cancelLabel="Voltar"
      hiddenFields={{ questionId }}
      stateAction={removeQuestion}
    >
      <Field
        label="Motivo"
        required
        hint="Fica no registro da moderação. Não copie aqui o nome, a escola ou os contatos de quem perguntou."
      >
        <Textarea name="reason" rows={3} maxLength={REMOVE_REASON_LIMITS.max} data-autofocus="" />
      </Field>
    </ConfirmDialog>
  );
}
