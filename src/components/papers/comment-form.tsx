"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { addComment, type CommentState } from "@/lib/papers/actions";
import { PAPER_LIMITS } from "@/lib/papers/limits";

export function CommentForm({ paperId }: { paperId: string }) {
  const [state, formAction] = useActionState<CommentState, FormData>(addComment, null);
  const [lastState, setLastState] = useState<CommentState>(null);
  const [version, setVersion] = useState(0);

  // Cada resposta da action remonta o campo com o valor devolvido (vazio após publicar).
  if (state !== lastState) {
    setLastState(state);
    setVersion((v) => v + 1);
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="paper_id" value={paperId} />
      <FormMessage tone={state?.ok ? "success" : "error"}>
        {state ? (state.ok ? state.message : state.error) : null}
      </FormMessage>
      <Field
        label="Seu comentário"
        hint="Compartilhe uma pergunta, uma leitura ou um elogio. Seja gentil: aqui vale o código de conduta."
        error={errors?.body}
      >
        <Textarea
          key={`body-${version}`}
          name="body"
          rows={4}
          maxLength={PAPER_LIMITS.commentMax}
          showCount
          defaultValue={state?.values.body}
        />
      </Field>
      <div>
        <SubmitButton pendingText="Publicando…">
          <Send aria-hidden="true" />
          Comentar
        </SubmitButton>
      </div>
    </form>
  );
}
