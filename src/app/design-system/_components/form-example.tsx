"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { KeywordInput } from "@/components/ui/keyword-input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { CAREER_STAGE_OPTIONS, MENTORSHIP_TOPIC_OPTIONS } from "@/lib/constants";
import { submitDemoProfile, type DemoProfileState } from "./actions";

/**
 * Exemplo completo do padrão de formulário: Server Action + zod + useActionState.
 * Os valores voltam no estado para que nada se perca quando a validação falha
 * (o React 19 reseta o <form> depois de cada action).
 */
export function FormExample() {
  const [state, formAction] = useActionState<DemoProfileState, FormData>(submitDemoProfile, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state?.values;

  return (
    <form action={formAction} noValidate className="grid gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="font-display text-xl font-semibold text-fg">Conte sobre você</h3>
          <p className="text-fg-muted">Envie vazio para ver os erros; preencha para ver o sucesso.</p>
        </div>
        <FormMessage tone={state?.ok ? "success" : "error"}>
          {state ? (state.ok ? state.message : state.error) : null}
        </FormMessage>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome completo" required error={errors?.full_name}>
          <Input name="full_name" autoComplete="name" defaultValue={values?.full_name} />
        </Field>
        <Field label="E-mail" required hint="Usamos só para avisos da plataforma." error={errors?.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={values?.email} />
        </Field>
      </div>

      <Field label="Fase da carreira" required error={errors?.career_stage}>
        <Select
          name="career_stage"
          placeholder="Selecione…"
          options={CAREER_STAGE_OPTIONS}
          defaultValue={values?.career_stage ?? ""}
          key={`stage-${values?.career_stage ?? ""}`}
        />
      </Field>

      <ChipGroup
        key={`topics-${values?.topics.join(",") ?? ""}`}
        name="topics"
        legend="Em que temas você quer mentoria?"
        hint="Escolha até 3."
        options={MENTORSHIP_TOPIC_OPTIONS.slice(0, 9)}
        defaultValue={values?.topics}
        max={3}
        required
        error={errors?.topics}
      />

      <Field label="Palavras-chave da sua pesquisa" optional error={errors?.keywords}>
        <KeywordInput key={`kw-${values?.keywords.join(",") ?? ""}`} name="keywords" max={8} defaultValue={values?.keywords} />
      </Field>

      <Field label="Bio curta" optional hint="Em poucas linhas: o que você pesquisa e o que te move." error={errors?.bio}>
        <Textarea name="bio" maxLength={500} showCount rows={4} defaultValue={values?.bio} />
      </Field>

      <div className="grid gap-1.5">
        <Checkbox
          name="consent"
          label="Concordo com o código de conduta da comunidade"
          description="Respeito, acolhimento e tolerância zero a assédio."
          aria-invalid={errors?.consent ? true : undefined}
        />
        {errors?.consent && <p className="pl-8 text-sm font-medium text-danger">{errors.consent[0]}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <SubmitButton pendingText="Enviando…">
          <Send aria-hidden="true" />
          Enviar
        </SubmitButton>
        <p className="text-sm text-fg-subtle">Campos com * são obrigatórios.</p>
      </div>
    </form>
  );
}
