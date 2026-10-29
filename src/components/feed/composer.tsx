"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Avatar, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { createPostAction, type ComposerState } from "@/lib/feed/actions";
import { POST_KIND_OPTIONS } from "@/lib/feed/presentation";
import { FEED_LIMITS, readPostForm, type PostFormValues } from "@/lib/feed/schema";
import type { ComposerAttachments } from "@/lib/feed/types";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";

export interface ComposerProps {
  viewer: { id: string; name: string; avatarUrl: string | null };
  /** Itens do portfólio e vagas para anexar (null = não carregou: o campo some). */
  attachments: ComposerAttachments | null;
}

const EMPTY: PostFormValues = { kind: "update", body: "", linkUrl: "", attachment: "" };

/**
 * Caixa de publicação do feed. Depois de publicar, o React 19 limpa o formulário e a página
 * revalidada já traz a publicação nova no topo — rolamos até ela.
 */
export function Composer({ viewer, attachments }: ComposerProps) {
  const [state, formAction] = useActionState<ComposerState, FormData>(
    withConnectionFallback(createPostAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: readPostForm(formData),
      nonce: freshNonce(),
    })),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      document
        .getElementById(`post-${state.postId}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }, [state]);

  const values = state && !state.ok ? state.values : EMPTY;
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const hasAttachments =
    attachments !== null &&
    (attachments.portfolio.length > 0 || attachments.opportunities.length > 0);

  return (
    <section
      aria-labelledby="compositor-titulo"
      className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex items-center gap-3">
        <Avatar name={viewer.name} src={viewer.avatarUrl} seed={viewer.id} size="sm" />
        <h2 id="compositor-titulo" className="font-display text-lg font-semibold text-fg">
          Compartilhe com a rede
        </h2>
      </div>

      <form ref={formRef} action={formAction} noValidate className="mt-3 grid gap-4">
        <FormMessage tone={state?.ok ? "success" : "error"}>
          {state ? (state.ok ? state.message : state.error) : null}
        </FormMessage>

        <div key={state?.nonce ?? "inicial"} className="grid gap-4">
          <Field
            label="Sua publicação"
            hint="Aceita Markdown simples: **negrito**, listas e links."
            required
            error={errors?.body}
          >
            <Textarea
              name="body"
              rows={3}
              maxLength={FEED_LIMITS.bodyMax}
              showCount
              defaultValue={values.body}
              placeholder="Um avanço da pesquisa, um projeto, uma conquista, um evento…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={errors?.kind}>
              <Select name="kind" defaultValue={values.kind} options={POST_KIND_OPTIONS} />
            </Field>
            <Field label="Link" optional error={errors?.linkUrl}>
              <Input
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
        </div>

        {/* Anexo e "Publicar" na mesma linha (a partir de sm) para a caixa não empurrar o feed. */}
        <div
          key={`anexo-${state?.nonce ?? "inicial"}`}
          className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          {hasAttachments ? (
            <Field label="Anexar do seu portfólio ou vaga" optional error={errors?.attachment}>
              <Select name="attachment" defaultValue={values.attachment}>
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
          ) : attachments === null ? (
            <span aria-hidden="true" />
          ) : (
            <p className="text-sm text-fg-muted sm:pb-2.5">
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
          <div className="flex justify-end">
            <SubmitButton pendingText="Publicando…">
              <Send aria-hidden="true" />
              Publicar
            </SubmitButton>
          </div>
        </div>
      </form>
    </section>
  );
}
