"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { updatePostAction, type PostEditState } from "@/lib/feed/actions";
import { POST_KIND_OPTIONS } from "@/lib/feed/presentation";
import { FEED_LIMITS, readPostEditForm, type PostKind } from "@/lib/feed/schema";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";

export interface EditablePostProps {
  postId: string;
  kind: PostKind;
  /** Texto original (Markdown) para o formulário de edição. */
  body: string;
  linkUrl: string | null;
  canEdit: boolean;
  /** Corpo, link e anexo já renderizados no servidor. */
  children: React.ReactNode;
  /** Curtir e comentários (lado esquerdo do rodapé). */
  footer: React.ReactNode;
  /** Demais ações (apagar, denunciar) — o botão "Editar" entra junto. */
  actions?: React.ReactNode;
}

/** Publicação com edição no lugar (tipo, texto e link — só para a autora). */
export function EditablePost({
  postId,
  kind,
  body,
  linkUrl,
  canEdit,
  children,
  footer,
  actions,
}: EditablePostProps) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  const finishEditing = useCallback(() => {
    restoreFocus.current = true;
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <PostEditForm
        postId={postId}
        initial={{ kind, body, linkUrl: linkUrl ?? "" }}
        onDone={finishEditing}
      />
    );
  }

  return (
    <>
      {children}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
        <div className="flex flex-wrap items-start gap-1">{footer}</div>
        <div className="flex flex-wrap items-start gap-1">
          {canEdit && (
            <Button
              ref={editButton}
              variant="ghost"
              size="sm"
              className="text-fg-muted"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          )}
          {actions}
        </div>
      </div>
    </>
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
      onDone();
      return;
    }
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      (state ? null : form?.querySelector<HTMLElement>("textarea"));
    target?.focus();
  }, [state, onDone]);

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
            rows={5}
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
