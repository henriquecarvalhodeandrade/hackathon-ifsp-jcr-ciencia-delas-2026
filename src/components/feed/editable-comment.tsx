"use client";

import { useActionState, useEffect, useRef } from "react";
import { Save } from "lucide-react";
import { Button, Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { updateCommentAction, type CommentEditState } from "@/lib/feed/actions";
import { FEED_LIMITS, readCommentForm } from "@/lib/feed/schema";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { useItem } from "./item-context";

export interface EditableCommentProps {
  commentId: string;
  postId: string;
  /** Texto original (para o formulário de edição). */
  body: string;
  /** Corpo já renderizado (no servidor ou no painel do cartão). */
  children: React.ReactNode;
  /** Depois de salvar, com o texto novo (o painel do cartão atualiza a própria lista). */
  onSaved?: (body: string) => void;
}

/**
 * Corpo de um comentário com edição no lugar (só a autora). A edição é aberta pelo item "Editar"
 * do menu "…" do comentário (estado compartilhado em <ItemProvider>).
 */
export function EditableComment({
  commentId,
  postId,
  body,
  children,
  onSaved,
}: EditableCommentProps) {
  const { editing, stopEditing } = useItem();
  if (!editing) return <>{children}</>;
  return (
    <CommentEditForm
      commentId={commentId}
      postId={postId}
      body={body}
      onDone={stopEditing}
      onSaved={onSaved}
    />
  );
}

function CommentEditForm({
  commentId,
  postId,
  body,
  onDone,
  onSaved,
}: {
  commentId: string;
  postId: string;
  body: string;
  onDone: () => void;
  onSaved?: (body: string) => void;
}) {
  const [state, formAction] = useActionState<CommentEditState, FormData>(
    withConnectionFallback(updateCommentAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: readCommentForm(formData),
      nonce: freshNonce(),
    })),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Fecha só depois do commit que traz o resultado (já com a página revalidada).
  useEffect(() => {
    if (state?.ok) {
      onSaved?.(state.body);
      onDone();
    } else formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [state, onDone, onSaved]);

  const values = state && !state.ok ? state.values : { body };
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="postId" value={postId} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <Field key={state?.nonce ?? "inicial"} label="Editar comentário" error={errors?.body}>
        <Textarea
          name="body"
          defaultValue={values.body}
          maxLength={FEED_LIMITS.commentMax}
          showCount
          autoGrow
          className="min-h-20"
        />
      </Field>
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
