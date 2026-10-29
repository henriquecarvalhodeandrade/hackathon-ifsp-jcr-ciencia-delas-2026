"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { Button, FormMessage, Kbd, SubmitButton, Textarea } from "@/components/ui";
import { sendDirectMessageAction } from "@/app/mensagens/actions";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { MESSAGE_MAX, type ConversationStarter } from "@/lib/messages/conversation";
import type { DirectMessageState } from "@/lib/messages/types";

/** Troca o texto do campo como se a pessoa tivesse digitado (o contador acompanha). */
function fillField(field: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
  field.setSelectionRange(text.length, text.length);
}

/**
 * Campo de envio da conversa direta (mesmo comportamento da conversa da mentoria). Enter envia e
 * Shift+Enter quebra a linha (no celular, onde não há Shift, Enter quebra a linha e o botão
 * envia). Erros do banco (CDxxx) aparecem acima do campo, numa região `aria-live`, e o texto volta
 * para o campo; o envio bem-sucedido limpa o campo e é anunciado discretamente — a mensagem nova
 * aparece na conversa logo acima.
 */
export function DirectMessageComposer({
  conversationId,
  otherFirstName,
  starters = [],
  hint = "As mensagens ficam só entre vocês duas.",
  submitLabel = "Enviar",
}: {
  conversationId: string;
  otherFirstName: string;
  /** Sugestões para começar (só com a conversa vazia). */
  starters?: readonly ConversationStarter[];
  /** Texto ao lado do botão (ex.: o aviso de que a mensagem vai como pedido). */
  hint?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<DirectMessageState, FormData>(
    withConnectionFallback(sendDirectMessageAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: { body: String(formData.get("body") ?? "") },
      nonce: freshNonce(),
    })),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Depois de cada envio o campo é remontado (key): devolve o foco para continuar a conversa.
  useEffect(() => {
    if (state) fieldRef.current?.focus();
  }, [state]);

  const failed = state && !state.ok ? state : null;
  const fieldId = `mensagem-${conversationId}`;
  const hintId = `${fieldId}-dica`;

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
    // Composição de texto (acentos, teclados asiáticos): Enter confirma a letra, não envia.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (pending || !event.currentTarget.value.trim()) return;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="conversation_id" value={conversationId} />

      <FormMessage tone="error">{failed?.error ?? null}</FormMessage>
      <p role="status" aria-live="polite" className="sr-only">
        {state?.ok ? state.message : ""}
      </p>

      {starters.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-fg-muted">Sugestões para começar</p>
          <ul className="flex flex-wrap gap-2">
            {starters.map((starter) => (
              <li key={starter.label}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fieldRef.current && fillField(fieldRef.current, starter.text)}
                >
                  {starter.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div key={state?.nonce ?? "inicial"} className="grid gap-1.5">
        <label htmlFor={fieldId} className="sr-only">
          Mensagem para {otherFirstName || "a outra pessoa"}
        </label>
        <Textarea
          ref={fieldRef}
          id={fieldId}
          name="body"
          rows={3}
          maxLength={MESSAGE_MAX}
          showCount
          required
          defaultValue={failed?.values.body ?? ""}
          placeholder={`Escreva para ${otherFirstName || "ela"}…`}
          aria-describedby={hintId}
          aria-invalid={failed?.fieldErrors?.body ? true : undefined}
          onKeyDown={onKeyDown}
          className="min-h-20"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={hintId} className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
          <span className="contents pointer-coarse:hidden">
            <Kbd>Enter</Kbd> envia · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> quebra a linha ·
          </span>
          <span>{hint}</span>
        </p>
        <SubmitButton pendingText="Enviando…" className="ml-auto">
          <SendHorizontal aria-hidden="true" />
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
