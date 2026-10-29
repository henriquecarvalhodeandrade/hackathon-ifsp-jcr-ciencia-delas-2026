"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { createCommentAction, type CommentFormState } from "@/lib/feed/actions";
import { FEED_LIMITS, readCommentForm } from "@/lib/feed/schema";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";

/** Comentar uma publicação. Depois de enviar, rola até o comentário novo. */
export function CommentForm({ postId }: { postId: string }) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    withConnectionFallback(createCommentAction, (formData) => ({
      ok: false,
      error: CONNECTION_ERROR_KEEP_TEXT,
      values: readCommentForm(formData),
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
        .getElementById(`comentario-${state.commentId}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }, [state]);

  const values = state && !state.ok ? state.values : { body: "" };
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="postId" value={postId} />
      <FormMessage tone={state?.ok ? "success" : "error"}>
        {state ? (state.ok ? state.message : state.error) : null}
      </FormMessage>
      <Field
        id="comentar"
        label="Seu comentário"
        hint="Uma pergunta, um parabéns, uma dica. Seja gentil: aqui vale o código de conduta."
        required
        error={errors?.body}
      >
        <Textarea
          key={state?.nonce ?? "inicial"}
          name="body"
          rows={3}
          maxLength={FEED_LIMITS.commentMax}
          showCount
          defaultValue={values.body}
        />
      </Field>
      <div>
        <SubmitButton pendingText="Enviando…">
          <Send aria-hidden="true" />
          Comentar
        </SubmitButton>
      </div>
    </form>
  );
}
