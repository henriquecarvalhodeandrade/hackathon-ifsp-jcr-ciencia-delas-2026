"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteAccountAction } from "@/app/perfil/actions";
import type { DeleteAccountState } from "@/lib/profile/types";

const WORD = "EXCLUIR";

/** Diálogo de exclusão definitiva da conta (pede para digitar EXCLUIR). */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    null,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="md"
      title="Excluir sua conta?"
      description="Essa ação é definitiva e não pode ser desfeita."
      trigger={
        <Button variant="danger">
          <Trash2 aria-hidden="true" />
          Excluir minha conta
        </Button>
      }
    >
      <form action={formAction} noValidate className="grid gap-5">
        <div className="grid gap-2 text-[0.9375rem] text-fg-muted">
          <p>Vamos apagar, para sempre:</p>
          <ul className="grid list-disc gap-1 pl-5 marker:text-danger">
            <li>seu perfil, foto, áreas e preferências de mentoria;</li>
            <li>seus tópicos e respostas no fórum — inclusive os anônimos;</li>
            <li>papers que você divulgou, seus comentários e destaques;</li>
            <li>pedidos e históricos de mentoria, sugestões e notificações.</li>
          </ul>
          <p>Se você assina o boletim, use o link de descadastro que vem em cada e-mail.</p>
        </div>
        <FormMessage tone="error">{state?.error}</FormMessage>
        <Field label={`Para confirmar, digite ${WORD}`} required>
          <Input
            name="confirmation"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <SubmitButton variant="danger" pendingText="Excluindo…">
            Excluir definitivamente
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
