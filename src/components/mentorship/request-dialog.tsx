"use client";

import { useActionState, useRef, useState } from "react";
import { HeartHandshake, Plus, Send } from "lucide-react";
import {
  Button,
  Dialog,
  Field,
  FormMessage,
  SubmitButton,
  Textarea,
  type ButtonProps,
} from "@/components/ui";
import { createRequestAction } from "@/app/mentoria/actions";
import {
  REQUEST_MESSAGE_MAX,
  REQUEST_MESSAGE_MIN,
  appendStarter,
  defaultRequestMessage,
  firstName,
} from "@/lib/mentorship/presentation";
import type { ActionState, RequestValues } from "@/lib/mentorship/types";

export interface RequestMentorshipDialogProps {
  mentorId: string;
  mentorName: string;
  /** Perguntas para puxar conversa (da sugestão). A primeira entra no rascunho. */
  starters?: readonly string[];
  /** Abre já na primeira renderização (link direto ?mentora=<id>). */
  defaultOpen?: boolean;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
}

/**
 * Diálogo "Pedir mentoria": mensagem (20–1.500 caracteres) com rascunho editável e perguntas
 * sugeridas. A Server Action grava o pedido e leva para "Solicitações enviadas".
 */
export function RequestMentorshipDialog({
  mentorId,
  mentorName,
  starters = [],
  defaultOpen = false,
  triggerLabel = "Pedir mentoria",
  triggerVariant = "primary",
  triggerSize = "md",
}: RequestMentorshipDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState(() => defaultRequestMessage(mentorName, starters[0]));
  const [state, formAction] = useActionState<ActionState<RequestValues>, FormData>(
    createRequestAction,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const name = firstName(mentorName) || mentorName;
  const extraStarters = starters.slice(1);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    // Aberto sozinho pelo link direto, o diálogo não tem para onde devolver o foco ao fechar
    // (ele estava no <body>): leva o foco ao botão "Pedir mentoria" do cartão.
    if (!value && defaultOpen) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      title={`Pedir mentoria a ${name}`}
      description="Conte quem você é, o que pesquisa e como ela pode ajudar. Ela recebe uma notificação e responde por aqui."
      trigger={
        <Button ref={triggerRef} variant={triggerVariant} size={triggerSize}>
          <HeartHandshake aria-hidden="true" />
          {triggerLabel}
        </Button>
      }
    >
      <form action={formAction} noValidate className="grid gap-5">
        <input type="hidden" name="mentor_id" value={mentorId} />
        <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>

        <Field
          label="Sua mensagem"
          required
          hint={`Entre ${REQUEST_MESSAGE_MIN} e 1.500 caracteres. Troque os trechos entre colchetes pelo seu contexto.`}
          error={errors?.message}
        >
          <Textarea
            name="message"
            rows={8}
            maxLength={REQUEST_MESSAGE_MAX}
            showCount
            data-autofocus
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
          />
        </Field>

        {extraStarters.length > 0 && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-fg">Outras perguntas para puxar conversa</p>
            <ul className="grid gap-2">
              {extraStarters.map((starter) => {
                const added = message.includes(starter);
                return (
                  <li
                    key={starter}
                    className="flex flex-col gap-2 rounded-control bg-surface-2 p-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>{starter}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={added}
                      onClick={() => setMessage((current) => appendStarter(current, starter))}
                      className="shrink-0 self-start sm:self-auto"
                    >
                      <Plus aria-hidden="true" />
                      {added ? "Adicionada" : "Adicionar"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-sm text-fg-subtle">
          {name} verá seu nome, seu perfil, esta mensagem e a afinidade calculada. Seu e-mail só
          aparece para ela se ela aceitar o pedido.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Enviando pedido…">
            <Send aria-hidden="true" />
            Enviar pedido
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
