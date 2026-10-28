"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ShieldAlert, UserSearch } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { revealAnonymousAuthor, type RevealResult } from "@/lib/admin/actions";
import type { ActionState } from "@/lib/admin/action-state";

interface RevealAuthorDialogProps {
  reportId: string;
  targetType: "thread" | "post";
  targetId: string;
}

function RevealForm({ reportId, targetType, targetId, onCancel }: RevealAuthorDialogProps & { onCancel: () => void }) {
  const [state, formAction] = useActionState<ActionState<RevealResult>, FormData>(revealAnonymousAuthor, null);
  // Controlados: o React 19 limpa campos não controlados depois de cada envio do formulário,
  // e um erro de validação não pode desmarcar a confirmação nem apagar o motivo.
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div className="grid gap-4">
        <Alert variant="info" title="Autoria revelada" live>
          Esta publicação foi escrita por{" "}
          <Link href={`/pesquisadoras/${state.data.profileId}`} className="font-semibold">
            {state.data.name}
          </Link>
          . A revelação ficou no registro interno da moderação. Trate essa informação com sigilo e use-a só para
          proteger a comunidade.
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <Alert variant="warning" title="Use só em casos graves" icon={<ShieldAlert />}>
        O anonimato protege quem relata assédio, maternidade e saúde mental. Revele apenas diante de ameaça, assédio
        grave ou risco a alguém. Seu nome, a data e o motivo ficam no registro interno da moderação (quem denunciou
        não vê). O nome revelado não é registrado.
      </Alert>
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <Field
        label="Motivo da revelação"
        required
        hint="Entre 20 e 300 caracteres. Fica no registro interno da moderação."
        error={errors?.reason}
      >
        <Textarea
          name="reason"
          rows={3}
          maxLength={300}
          showCount
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="grid gap-1.5">
        <Checkbox
          id={`revelar-confirmar-${targetId}`}
          name="confirm"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          label="Entendo que este é um caso grave e que esta ação fica registrada."
          aria-invalid={errors?.confirm ? true : undefined}
          aria-describedby={errors?.confirm ? `revelar-confirmar-${targetId}-erro` : undefined}
        />
        {errors?.confirm && (
          <p id={`revelar-confirmar-${targetId}-erro`} className="pl-8 text-sm font-medium text-danger">
            {errors.confirm[0]}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton variant="danger" pendingText="Revelando…">
          Revelar autoria
        </SubmitButton>
      </div>
    </form>
  );
}

/** Somente admins: revela quem escreveu um tópico/resposta anônimo, com justificativa auditada. */
export function RevealAuthorDialog(props: RevealAuthorDialogProps) {
  // O conteúdo do Dialog só existe enquanto ele está aberto: ao fechar, o resultado
  // (a identidade revelada) é descartado da tela.
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="md"
      title="Revelar a autoria desta publicação anônima?"
      description="Ação exclusiva de administradoras, para casos graves."
      trigger={
        <Button variant="outline" size="sm">
          <UserSearch aria-hidden="true" />
          Revelar autoria
        </Button>
      }
    >
      <RevealForm {...props} onCancel={() => setOpen(false)} />
    </Dialog>
  );
}
