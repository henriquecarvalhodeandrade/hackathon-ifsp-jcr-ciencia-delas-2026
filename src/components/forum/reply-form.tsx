"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Field, FormMessage, SubmitButton, Switch } from "@/components/ui";
import { createPost, type PostFormState } from "@/lib/forum/actions";
import { FORUM_LIMITS } from "@/lib/forum/schema";
import { MarkdownEditor } from "./markdown-editor";

export interface ReplyFormProps {
  threadId: string;
  /** A categoria aceita respostas anônimas. */
  allowAnonymous: boolean;
}

/** Formulário de resposta no fim do tópico. Após publicar, rola até a resposta nova. */
export function ReplyForm({ threadId, allowAnonymous }: ReplyFormProps) {
  const [state, formAction] = useActionState<PostFormState, FormData>(createPost, null);
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
        .getElementById(`resposta-${state.postId}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }, [state]);

  const values = state && !state.ok ? state.values : { body: "", anonymous: false };
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="threadId" value={threadId} />
      <FormMessage tone={state?.ok ? "success" : "error"}>{state ? (state.ok ? state.message : state.error) : null}</FormMessage>

      <div key={state?.nonce ?? "inicial"} className="grid gap-4">
        <Field label="Sua resposta" required error={errors?.body}>
          <MarkdownEditor
            name="body"
            label="sua resposta"
            defaultValue={values.body}
            maxLength={FORUM_LIMITS.postBodyMax}
            rows={5}
            placeholder="Compartilhe sua experiência com acolhimento e respeito."
          />
        </Field>
        {allowAnonymous && (
          <div className="grid gap-1.5">
            <Switch
              name="anonymous"
              defaultChecked={values.anonymous}
              label="Responder anonimamente"
              description="Seu nome não aparece. A moderação pode ver a autoria apenas em casos graves de segurança."
            />
            {errors?.anonymous?.[0] && <p className="text-sm font-medium text-danger">{errors.anonymous[0]}</p>}
          </div>
        )}
      </div>

      <div>
        <SubmitButton pendingText="Publicando…">
          <Send aria-hidden="true" />
          Publicar resposta
        </SubmitButton>
      </div>
    </form>
  );
}
