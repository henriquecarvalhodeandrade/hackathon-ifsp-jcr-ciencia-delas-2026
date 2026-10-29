"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { controlClasses } from "@/components/ui/input";
import {
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX,
  type ConversationStarter,
} from "@/lib/messages/conversation";
import { cn, formatNumber } from "@/lib/utils";

/** Altura máxima do campo (≈ 5 linhas): depois disso ele rola por dentro. */
const MAX_HEIGHT_PX = 140;

function finePointer(): boolean {
  return window.matchMedia("(pointer: fine)").matches;
}

/**
 * Campo do chat, preso ao pé da conversa. Uma linha que cresce com o texto (até ~5 linhas;
 * `field-sizing: content`, com ajuste via JS onde não há suporte), botão de enviar redondo de
 * 44 px ("Enviar"), contador só perto do limite. Enter envia e Shift+Enter quebra a linha (no
 * celular, onde não há Shift, Enter quebra a linha e o botão envia). Não trava enquanto envia: o
 * campo é limpo na hora e a mensagem aparece como provisória na conversa (`onSend`).
 *
 * Com `waiting` (pedido enviado, esperando resposta), o campo continua no mesmo lugar e com a
 * mesma altura, desativado, mostrando o texto da espera — nada pula na tela.
 */
export function ChatComposer({
  id,
  otherFirstName,
  canSend,
  waitingText,
  sendLabel,
  starters,
  onSend,
  autoFocus,
}: {
  /** Id do campo (o foco volta para ele depois de aceitar um pedido, por exemplo). */
  id: string;
  otherFirstName: string;
  canSend: boolean;
  /** Texto do campo desativado (pedido aguardando resposta). */
  waitingText: string | null;
  sendLabel: string;
  /** Sugestões para começar (só com a conversa vazia), numa linha que rola de lado. */
  starters: readonly ConversationStarter[];
  onSend: (body: string) => void;
  /** Foca o campo ao abrir, só com mouse/trackpad (no celular abriria o teclado sem pedir). */
  autoFocus: boolean;
}) {
  const [value, setValue] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const countId = useId();
  const showCount = value.length >= MESSAGE_COUNTER_FROM;

  useEffect(() => {
    if (autoFocus && canSend && finePointer()) fieldRef.current?.focus({ preventScroll: true });
  }, [autoFocus, canSend]);

  // Sem `field-sizing: content` (Safari/Firefox antigos): altura = conteúdo, até o máximo.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field || CSS.supports("field-sizing", "content")) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight + 2, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function submit() {
    const field = fieldRef.current;
    if (!canSend) return;
    if (!value.trim()) {
      field?.focus();
      return;
    }
    onSend(value);
    setValue("");
    field?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
    // Composição de texto (acentos, teclados asiáticos): Enter confirma a letra, não envia.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!finePointer() && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    submit();
  }

  function applyStarter(text: string) {
    setValue(text);
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    window.requestAnimationFrame(() => field.setSelectionRange(text.length, text.length));
  }

  const describedBy = [hintId, showCount ? countId : null].filter(Boolean).join(" ");

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-2"
    >
      {starters.length > 0 && canSend && (
        <div className="-mx-3 grid gap-1.5 sm:-mx-4 lg:-mx-6">
          <p className="px-3 text-xs font-semibold text-fg-muted sm:px-4 lg:px-6">
            Sugestões para começar
          </p>
          <ul className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-0.5 sm:px-4 lg:px-6">
            {starters.map((starter) => (
              <li key={starter.label} className="shrink-0">
                <button
                  type="button"
                  onClick={() => applyStarter(starter.text)}
                  className="inline-flex h-9 items-center rounded-pill border border-border-strong bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-fg transition-colors hover:bg-surface-2 pointer-coarse:h-11"
                >
                  {starter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          Mensagem para {otherFirstName || "a outra pessoa"}
        </label>
        <textarea
          ref={fieldRef}
          id={id}
          name="body"
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX}
          disabled={!canSend}
          placeholder={
            canSend
              ? `Escreva para ${otherFirstName || "ela"}…`
              : (waitingText ?? "Conversa fechada")
          }
          aria-describedby={describedBy}
          className={cn(
            controlClasses,
            "block [field-sizing:content] min-h-11 resize-none px-3.5 py-2.5 text-base leading-6",
            "max-h-[8.75rem] overflow-y-auto disabled:placeholder:text-fg-muted",
          )}
        />
        <button
          type="submit"
          aria-label={sendLabel}
          title={sendLabel}
          disabled={!canSend}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition-colors hover:bg-primary-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-5"
        >
          <SendHorizontal aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-fg-muted">
        <p id={hintId} className="sr-only lg:not-sr-only">
          {canSend
            ? "Enter envia · Shift + Enter quebra a linha · As mensagens ficam só entre vocês duas."
            : (waitingText ?? "")}
        </p>
        {showCount && (
          <p id={countId} className="ml-auto tabular">
            {formatNumber(value.length)}/{formatNumber(MESSAGE_MAX)}
          </p>
        )}
      </div>
    </form>
  );
}
