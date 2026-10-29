"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button, Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { updateCommentAction, type CommentEditState } from "@/lib/feed/actions";
import { FEED_LIMITS, readCommentForm } from "@/lib/feed/schema";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";

export interface EditableCommentProps {
  commentId: string;
  postId: string;
  /** Texto original (para o formulário de edição). */
  body: string;
  canEdit: boolean;
  /** Corpo já renderizado no servidor. */
  children: React.ReactNode;
  /** Demais ações (apagar, denunciar) — o botão "Editar" entra junto. */
  actions?: React.ReactNode;
}

/** Corpo de um comentário com edição no lugar (só para a autora do comentário). */
export function EditableComment({
  commentId,
  postId,
  body,
  canEdit,
  children,
  actions,
}: EditableCommentProps) {
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
      <CommentEditForm commentId={commentId} postId={postId} body={body} onDone={finishEditing} />
    );
  }

  const hasActions = canEdit || Boolean(actions);
  return (
    <>
      {children}
      {hasActions && (
        <div className="mt-2 flex flex-wrap items-start justify-end gap-1">
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
      )}
    </>
  );
}

function CommentEditForm({
  commentId,
  postId,
  body,
  onDone,
}: {
  commentId: string;
  postId: string;
  body: string;
  onDone: () => void;
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
    if (state?.ok) onDone();
    else formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [state, onDone]);

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
          rows={3}
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
