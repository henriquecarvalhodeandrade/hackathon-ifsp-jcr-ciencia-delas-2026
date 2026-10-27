"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EyeOff, Save, Send, ShieldCheck } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Field,
  FormMessage,
  Input,
  KeywordInput,
  Select,
  SubmitButton,
  Switch,
} from "@/components/ui";
import { createThread, updateThread, type ThreadFormState } from "@/lib/forum/actions";
import { FORUM_LIMITS, type ThreadFormValues } from "@/lib/forum/schema";
import type { CategorySummary, ForumCategory } from "@/lib/forum/types";
import { CategoryIcon } from "./category-icon";
import { MarkdownEditor } from "./markdown-editor";

type CategoryOption = Pick<
  ForumCategory,
  "id" | "slug" | "name" | "description" | "allow_anonymous"
>;

export type ThreadFormProps =
  | {
      mode: "create";
      categories: readonly CategoryOption[];
      defaultCategoryId?: number;
      cancelHref: string;
    }
  | {
      mode: "edit";
      threadId: string;
      category: CategorySummary;
      isAnonymous: boolean;
      initial: Pick<ThreadFormValues, "title" | "body" | "tags">;
      cancelHref: string;
    };

/** Formulário de tópico (novo ou edição), com prévia de Markdown e anonimato quando permitido. */
export function ThreadForm(props: ThreadFormProps) {
  const [state, formAction] = useActionState<ThreadFormState, FormData>(
    props.mode === "create" ? createThread : updateThread,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Depois de um erro de validação, leva o foco ao primeiro campo com problema.
  useEffect(() => {
    if (!state || state.ok) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const initialValues: ThreadFormValues =
    props.mode === "create"
      ? {
          categoryId: props.defaultCategoryId ? String(props.defaultCategoryId) : "",
          title: "",
          body: "",
          tags: [],
          anonymous: false,
        }
      : { categoryId: String(props.category.id), ...props.initial, anonymous: props.isAnonymous };
  const values = state?.values ?? initialValues;
  const errors = state?.fieldErrors;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-6">
      <FormMessage tone="error">{state?.error}</FormMessage>
      {props.mode === "edit" && <input type="hidden" name="threadId" value={props.threadId} />}

      <ThreadFields key={state?.nonce ?? "inicial"} props={props} values={values} errors={errors} />

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <SubmitButton pendingText={props.mode === "create" ? "Publicando…" : "Salvando…"}>
          {props.mode === "create" ? <Send aria-hidden="true" /> : <Save aria-hidden="true" />}
          {props.mode === "create" ? "Publicar tópico" : "Salvar alterações"}
        </SubmitButton>
        <ButtonLink href={props.cancelHref} variant="ghost">
          Cancelar
        </ButtonLink>
        <p className="text-sm text-fg-subtle">Campos com * são obrigatórios.</p>
      </div>
    </form>
  );
}

/** Campos com estado próprio (categoria escolhida). Remontados a cada resposta da action. */
function ThreadFields({
  props,
  values,
  errors,
}: {
  props: ThreadFormProps;
  values: ThreadFormValues;
  errors: NonNullable<ThreadFormState>["fieldErrors"];
}) {
  const [categoryId, setCategoryId] = useState(values.categoryId);
  const selected =
    props.mode === "create" ? props.categories.find((c) => String(c.id) === categoryId) : undefined;
  const allowAnonymous = props.mode === "create" && Boolean(selected?.allow_anonymous);

  return (
    <div className="grid gap-6">
      {props.mode === "create" ? (
        <Field
          label="Categoria"
          required
          hint={selected?.description || "Escolha o espaço que mais combina com o assunto."}
          error={errors?.categoryId}
        >
          {/* Não controlado de propósito: o React 19 reseta o <form> depois da action e um
              <select value> controlado voltaria para a 1ª opção. defaultValue marca a opção
              como defaultSelected, que é o que o reset restaura. */}
          <Select
            name="categoryId"
            defaultValue={values.categoryId}
            onChange={(event) => setCategoryId(event.currentTarget.value)}
            placeholder="Selecione uma categoria…"
            options={props.categories.map((c) => ({
              value: String(c.id),
              label: c.allow_anonymous ? `${c.name} (aceita anonimato)` : c.name,
            }))}
          />
        </Field>
      ) : (
        <div className="grid gap-1.5">
          <p className="text-sm font-semibold text-fg">Categoria</p>
          <p className="flex flex-wrap items-center gap-2 text-fg-muted">
            <CategoryIcon icon={props.category.icon} className="size-4 text-primary" />
            {props.category.name}
            {props.isAnonymous && (
              <Badge variant="secondary">
                <EyeOff aria-hidden="true" />
                Publicado anonimamente
              </Badge>
            )}
          </p>
          <p className="text-sm text-fg-subtle">
            A categoria e o anonimato não mudam depois da publicação.
          </p>
        </div>
      )}

      <Field
        label="Título"
        required
        hint="Uma pergunta ou frase curta que resuma o assunto."
        error={errors?.title}
      >
        <Input
          name="title"
          defaultValue={values.title}
          maxLength={FORUM_LIMITS.titleMax}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Texto"
        required
        hint="Conte o contexto: o que você já tentou, o que precisa, prazos. Evite expor dados pessoais de outras pessoas."
        error={errors?.body}
      >
        <MarkdownEditor
          name="body"
          label="texto do tópico"
          defaultValue={values.body}
          maxLength={FORUM_LIMITS.threadBodyMax}
          rows={10}
        />
      </Field>

      <Field
        label="Tags"
        optional
        hint={`Até ${FORUM_LIMITS.tagsMax} palavras-chave para facilitar a busca (ex.: mestrado, bolsas, r).`}
        error={errors?.tags}
      >
        <KeywordInput
          name="tags"
          defaultValue={values.tags}
          max={FORUM_LIMITS.tagsMax}
          maxLength={FORUM_LIMITS.tagMaxLength}
          placeholder="Digite uma tag e tecle Enter"
        />
      </Field>

      {allowAnonymous && (
        <div className="grid gap-3 rounded-card border border-border bg-surface-2 p-4">
          <Switch
            name="anonymous"
            defaultChecked={values.anonymous}
            label="Publicar anonimamente"
            description="Seu nome e sua foto não aparecem para as outras membros. Você continua podendo editar e apagar o tópico."
          />
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
            <span>
              Por segurança, a moderação consegue ver a autoria e só usa essa informação em casos
              graves, como ameaças ou assédio. Saiba mais no{" "}
              <Link
                href="/conduta"
                className="font-semibold text-primary underline underline-offset-2"
              >
                código de conduta
              </Link>
              .
            </span>
          </p>
          {errors?.anonymous?.[0] && (
            <p className="text-sm font-medium text-danger">{errors.anonymous[0]}</p>
          )}
        </div>
      )}
    </div>
  );
}
