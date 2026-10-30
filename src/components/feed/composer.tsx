"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Link2, Paperclip, Send } from "lucide-react";
import {
  Avatar,
  Field,
  FormMessage,
  Input,
  Kbd,
  Select,
  SubmitButton,
  Textarea,
  buttonVariants,
} from "@/components/ui";
import { createPostAction, type ComposerState } from "@/lib/feed/actions";
import { POST_KIND_OPTIONS } from "@/lib/feed/presentation";
import { FEED_LIMITS, readPostForm, type PostFormValues } from "@/lib/feed/schema";
import type { ComposerAttachments, FeedViewer } from "@/lib/feed/types";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { cn } from "@/lib/utils";
import { announce, focusPost, waitForElement } from "./dom";
import { KIND_ICONS } from "./post-kind-badge";

export interface ComposerProps {
  viewer: FeedViewer;
  /** Itens do portfólio e vagas para anexar (null = não carregou: o clipe some). */
  attachments: ComposerAttachments | null;
  /**
   * Chegou por `/feed?escrever=1` (ex.: "Compartilhar novidade" no painel): a caixa já vem
   * aberta e o campo recebe o foco; o parâmetro sai da URL para recarregar não reabrir.
   */
  autoOpen?: boolean;
}

const EMPTY: PostFormValues = { kind: "update", body: "", linkUrl: "", attachment: "" };

const toggleClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "text-fg-muted pointer-coarse:size-11 aria-expanded:bg-primary-soft aria-expanded:text-primary-soft-fg",
);

/**
 * Caixa de publicação do feed. Fechada, é um campo de uma linha com a foto de quem escreve (o
 * feed aparece logo abaixo); abre ao focar, digitar ou quando há erro. Aberta: tipo em chips,
 * link e anexo sob demanda, Ctrl/Cmd+Enter publica. Depois de publicar, fecha, leva o foco à
 * publicação nova e a destaca por um instante.
 */
export function Composer({ viewer, attachments, autoOpen = false }: ComposerProps) {
  const [state, formAction] = useActionState<ComposerState, FormData>(
    withConnectionFallback(createPostAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: readPostForm(formData),
      nonce: freshNonce(),
    })),
    null,
  );
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLSelectElement>(null);
  const pointerInside = useRef(false);
  const [expanded, setExpanded] = useState(autoOpen);

  // Link direto para escrever: foco no campo e tira `escrever` da URL (o resto fica).
  useEffect(() => {
    if (!autoOpen) return;
    const field = formRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    field?.focus();
    const url = new URL(window.location.href);
    if (url.searchParams.has("escrever")) {
      url.searchParams.delete("escrever");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [autoOpen]);
  const [empty, setEmpty] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const failed = state && !state.ok ? state : null;
  const values = failed ? failed.values : EMPTY;
  const errors = failed?.fieldErrors;
  const open = expanded || Boolean(failed);

  // Cada resposta da action ajusta a caixa durante a renderização (sem efeito em cascata):
  // com erro, link e anexo continuam abertos se estavam preenchidos; com sucesso, tudo fecha.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.ok) {
      setEmpty(!state.values.body.trim());
      setLinkOpen(Boolean(state.values.linkUrl));
      setAttachOpen(Boolean(state.values.attachment));
    } else if (state?.ok) {
      setExpanded(false);
      setEmpty(true);
      setLinkOpen(false);
      setAttachOpen(false);
    }
  }

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    announce(state.message);
    // A página revalidada traz a publicação nova no topo: foco e destaque nela.
    waitForElement(`post-${state.postId}`, true, () =>
      focusPost(state.postId, { highlight: true }),
    );
  }, [state]);

  function isUntouched() {
    const form = formRef.current;
    if (!form) return true;
    const data = new FormData(form);
    return (
      !String(data.get("body") ?? "").trim() && !data.get("linkUrl") && !data.get("attachment")
    );
  }

  // Fecha quando o foco sai da caixa e não há nada escrito (o clique em botões do Safari não
  // foca o botão: o ponteiro dentro da caixa também conta).
  function onBlur() {
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form || pointerInside.current || form.contains(document.activeElement)) return;
      if (!failed && isUntouched()) setExpanded(false);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (event.currentTarget.value.trim()) formRef.current?.requestSubmit();
  }

  function toggleLink() {
    const next = !linkOpen;
    setLinkOpen(next);
    if (next) requestAnimationFrame(() => linkRef.current?.focus());
    else if (linkRef.current) linkRef.current.value = "";
  }

  function toggleAttach() {
    const next = !attachOpen;
    setAttachOpen(next);
    if (next) requestAnimationFrame(() => attachRef.current?.focus());
    else if (attachRef.current) attachRef.current.value = "";
  }

  const textId = `${baseId}-texto`;
  const linkPanelId = `${baseId}-link`;
  const attachPanelId = `${baseId}-anexo`;
  const reasonId = `${baseId}-motivo`;
  const hasAttachments =
    attachments !== null &&
    (attachments.portfolio.length > 0 || attachments.opportunities.length > 0);

  return (
    <section
      aria-labelledby="compositor-titulo"
      className="rounded-card border border-border bg-surface p-3 shadow-card sm:p-4"
    >
      <h2 id="compositor-titulo" className="sr-only">
        Nova publicação
      </h2>
      <form
        ref={formRef}
        action={formAction}
        noValidate
        onFocus={() => setExpanded(true)}
        onBlur={onBlur}
        onPointerDown={() => {
          pointerInside.current = true;
        }}
        onPointerUp={() => {
          window.setTimeout(() => (pointerInside.current = false), 0);
        }}
        className="grid gap-3"
      >
        {/* Sempre montada (aria-live); vazia, sai do fluxo para não somar espaço à caixa fechada. */}
        <FormMessage tone="error" className={failed ? undefined : "sr-only"}>
          {failed?.error ?? null}
        </FormMessage>

        <div key={state?.nonce ?? "inicial"} className="grid gap-3">
          <div className="flex items-start gap-3">
            <Avatar name={viewer.name} src={viewer.avatarUrl} seed={viewer.id} className="mt-0.5" />
            <Field
              id={textId}
              label="Escreva uma publicação"
              hideLabel
              error={errors?.body}
              className="min-w-0 flex-1"
            >
              <Textarea
                name="body"
                rows={1}
                autoGrow
                showCount={open}
                maxLength={FEED_LIMITS.bodyMax}
                defaultValue={values.body}
                placeholder="Compartilhe um avanço, projeto ou conquista…"
                onChange={(event) => setEmpty(!event.currentTarget.value.trim())}
                onKeyDown={onKeyDown}
                className={cn(
                  // Fechada: uma linha (o texto de exemplo vira "…" em vez de quebrar).
                  "rounded-pill px-4 py-2.5 placeholder:truncate",
                  open && "min-h-24 rounded-control placeholder:whitespace-normal",
                )}
              />
            </Field>
          </div>

          <div hidden={!open} className="grid gap-4 sm:pl-[3.25rem]">
            <p className="-mt-1 text-xs text-fg-subtle">
              Aceita Markdown simples: **negrito**, listas e links.
            </p>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold text-fg">Tipo da publicação</legend>
              <div className="flex flex-wrap gap-1.5">
                {POST_KIND_OPTIONS.map(({ value, label }) => {
                  const Icon = KIND_ICONS[value];
                  return (
                    <label key={value} className="relative inline-flex cursor-pointer">
                      <input
                        type="radio"
                        name="kind"
                        value={value}
                        defaultChecked={values.kind === value}
                        className="peer sr-only"
                      />
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-strong px-3 text-sm font-semibold text-fg-muted transition-colors peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary-soft-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus hover:bg-surface-2 pointer-coarse:h-11 [&_svg]:size-4">
                        <Icon aria-hidden="true" />
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors?.kind?.[0] && (
                <p className="text-sm font-medium text-danger">{errors.kind[0]}</p>
              )}
            </fieldset>

            <div id={linkPanelId} hidden={!linkOpen}>
              <Field label="Link" optional error={errors?.linkUrl}>
                <Input
                  ref={linkRef}
                  name="linkUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  maxLength={FEED_LIMITS.linkMax}
                  defaultValue={values.linkUrl}
                  placeholder="https://"
                />
              </Field>
            </div>

            <div id={attachPanelId} hidden={!attachOpen}>
              {hasAttachments ? (
                <Field label="Anexar do seu portfólio ou vaga" optional error={errors?.attachment}>
                  <Select ref={attachRef} name="attachment" defaultValue={values.attachment}>
                    <option value="">Sem anexo</option>
                    {attachments.portfolio.length > 0 && (
                      <optgroup label="Do meu portfólio">
                        {attachments.portfolio.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {attachments.opportunities.length > 0 && (
                      <optgroup label="Minhas vagas">
                        {attachments.opportunities.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </Field>
              ) : (
                <p className="text-sm text-fg-muted">
                  Para anexar um artigo, projeto ou prêmio,{" "}
                  <Link
                    href="/portfolio"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    adicione itens ao seu portfólio
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Adicionar link"
                  aria-expanded={linkOpen}
                  aria-controls={linkPanelId}
                  onClick={toggleLink}
                  className={toggleClass}
                >
                  <Link2 aria-hidden="true" />
                </button>
                {attachments !== null && (
                  <button
                    type="button"
                    aria-label="Anexar do portfólio ou de uma vaga"
                    aria-expanded={attachOpen}
                    aria-controls={attachPanelId}
                    onClick={toggleAttach}
                    className={toggleClass}
                  >
                    <Paperclip aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-fg-subtle pointer-fine:inline">
                  <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> publica
                </span>
                <SubmitButton
                  pendingText="Publicando…"
                  aria-disabled={empty || undefined}
                  aria-describedby={empty ? reasonId : undefined}
                  onClick={(event) => {
                    // Sem texto não há o que publicar: o botão avisa (aria-disabled) e devolve o
                    // foco ao campo em vez de enviar.
                    if (!empty) return;
                    event.preventDefault();
                    formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
                  }}
                  className={cn(empty && "opacity-60")}
                >
                  <Send aria-hidden="true" />
                  Publicar
                </SubmitButton>
                <span id={reasonId} className="sr-only">
                  Escreva algo para publicar.
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
