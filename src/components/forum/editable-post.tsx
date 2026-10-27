"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button, Field, FormMessage, SubmitButton } from "@/components/ui";
import { updatePost, type PostEditState } from "@/lib/forum/actions";
import { FORUM_LIMITS } from "@/lib/forum/schema";
import { MarkdownEditor } from "./markdown-editor";

export interface EditablePostProps {
  postId: string;
  threadId: string;
  /** Markdown original (para o formulário de edição). */
  body: string;
  canEdit: boolean;
  /** Corpo já renderizado no servidor (<Markdown>). */
  children: React.ReactNode;
  /** Barra de reações (renderizada no servidor). */
  reactions: React.ReactNode;
  /** Demais ações (solução, excluir, denunciar) — o botão "Editar" entra junto. */
  actions?: React.ReactNode;
}

/** Corpo de uma resposta com edição no lugar (só para a autora). */
export function EditablePost({ postId, threadId, body, canEdit, children, reactions, actions }: EditablePostProps) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <PostEditForm
        postId={postId}
        threadId={threadId}
        body={body}
        onDone={() => {
          restoreFocus.current = true;
          setEditing(false);
        }}
      />
    );
  }

  return (
    <>
      {children}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {reactions}
        <div className="flex flex-wrap items-start gap-1">
          {canEdit && (
            <Button ref={editButton} variant="ghost" size="sm" className="text-fg-muted" onClick={() => setEditing(true)}>
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
  threadId,
  body,
  onDone,
}: {
  postId: string;
  threadId: string;
  body: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<PostEditState, FormData>(async (prev, formData) => {
    const result = await updatePost(prev, formData);
    if (result?.ok) onDone();
    return result;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [state]);

  const values = state && !state.ok ? state.values : { body };
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="threadId" value={threadId} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <Field key={state?.nonce ?? "inicial"} label="Editar resposta" error={errors?.body}>
        <MarkdownEditor
          name="body"
          label="edição da resposta"
          defaultValue={values.body}
          maxLength={FORUM_LIMITS.postBodyMax}
          rows={5}
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
