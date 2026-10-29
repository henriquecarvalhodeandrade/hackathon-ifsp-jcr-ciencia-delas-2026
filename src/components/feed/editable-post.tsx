"use client";

import { useActionState, useEffect, useRef } from "react";
import { Save } from "lucide-react";
import { Button, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { updatePostAction, type PostEditState } from "@/lib/feed/actions";
import { POST_KIND_OPTIONS } from "@/lib/feed/presentation";
import { FEED_LIMITS, readPostEditForm, type PostKind } from "@/lib/feed/schema";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { notifyPostChanged } from "./dom";
import { useItem } from "./item-context";

export interface EditablePostProps {
  postId: string;
  kind: PostKind;
  /** Texto original (Markdown) para o formulário de edição. */
  body: string;
  linkUrl: string | null;
  /** Corpo, link e anexo já renderizados no servidor. */
  children: React.ReactNode;
}

/**
 * Corpo da publicação com edição no lugar (tipo, texto e link — só a autora). A edição é aberta
 * pelo item "Editar" do menu "…" do cartão (estado compartilhado em <ItemProvider>).
 */
export function EditablePost({ postId, kind, body, linkUrl, children }: EditablePostProps) {
  const { editing, stopEditing } = useItem();
  if (!editing) return <>{children}</>;
  return (
    <PostEditForm
      postId={postId}
      initial={{ kind, body, linkUrl: linkUrl ?? "" }}
      onDone={stopEditing}
    />
  );
}

function PostEditForm({
  postId,
  initial,
  onDone,
}: {
  postId: string;
  initial: { kind: string; body: string; linkUrl: string };
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<PostEditState, FormData>(
    withConnectionFallback(updatePostAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: readPostEditForm(formData),
      nonce: freshNonce(),
    })),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Fecha só depois do commit que traz o resultado — o mesmo que traz a página revalidada,
  // então o texto novo já aparece (sem piscar o antigo). Com erro, foca o primeiro campo inválido.
  useEffect(() => {
    if (state?.ok) {
      // Cartões carregados com "Carregar mais" não vêm na página revalidada: pedem a versão nova.
      notifyPostChanged({ postId });
      onDone();
      return;
    }
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      (state ? null : form?.querySelector<HTMLElement>("textarea"));
    target?.focus();
  }, [state, onDone, postId]);

  const values = state && !state.ok ? state.values : initial;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="postId" value={postId} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <div key={state?.nonce ?? "inicial"} className="grid gap-4">
        <Field label="Texto da publicação" required error={errors?.body}>
          <Textarea
            name="body"
            defaultValue={values.body}
            maxLength={FEED_LIMITS.bodyMax}
            showCount
            autoGrow
            className="min-h-28"
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
              defaultValue={values.linkUrl}
              maxLength={FEED_LIMITS.linkMax}
              placeholder="https://"
            />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingText="Salvando…">
          <Save aria-hidden="true" />
          Salvar
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
