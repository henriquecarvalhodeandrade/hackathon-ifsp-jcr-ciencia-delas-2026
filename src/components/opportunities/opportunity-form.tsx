"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { AreaSelect } from "@/components/papers/area-select";
import {
  ButtonLink,
  Checkbox,
  ChipGroup,
  Field,
  FormMessage,
  Input,
  KeywordInput,
  RadioGroup,
  revealFormMessage,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { BR_STATES, CAREER_STAGE_OPTIONS, MEETING_FORMATS } from "@/lib/constants";
import { saveOpportunity } from "@/lib/opportunities/actions";
import { MODALITY_ORDER, OPPORTUNITY_KIND_OPTIONS } from "@/lib/opportunities/labels";
import { OPPORTUNITY_LIMITS as L } from "@/lib/opportunities/limits";
import type { OpportunityFormValues } from "@/lib/opportunities/schema";
import type { OpportunityFormState } from "@/lib/opportunities/types";
import type { AreaRow } from "@/lib/papers/params";

const UF_OPTIONS = Object.entries(BR_STATES).map(([value, label]) => ({
  value,
  label: `${value} — ${label}`,
}));
const MODALITY_OPTIONS = MODALITY_ORDER.map((value) => ({ value, label: MEETING_FORMATS[value] }));

export interface OpportunityFormProps {
  mode: "create" | "edit";
  opportunityId?: string;
  initialValues: OpportunityFormValues;
  areas: readonly AreaRow[];
  cancelHref: string;
  /** "Hoje" em São Paulo (AAAA-MM-DD), mínimo do campo de prazo ao publicar. */
  today: string;
}

function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="grid gap-1">
        <h2 id={id} className="font-display text-xl font-semibold text-fg">
          {title}
        </h2>
        {description && <p className="text-[0.9375rem] text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Formulário de publicar/editar vaga (docs/18 §2.3). Os campos são não controlados; quando a
 * action devolve os valores (erro de validação), a `version` muda e os campos remontam com o
 * texto de volta — o React 19 reseta o <form> depois de cada envio.
 */
export function OpportunityForm({
  mode,
  opportunityId,
  initialValues,
  areas,
  cancelHref,
  today,
}: OpportunityFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState<OpportunityFormState, FormData>(saveOpportunity, null);
  const [lastState, setLastState] = useState<OpportunityFormState>(null);
  const [source, setSource] = useState({ values: initialValues, version: 0 });
  const [hasScholarship, setHasScholarship] = useState(initialValues.has_scholarship);

  if (state !== lastState) {
    setLastState(state);
    if (state) {
      setSource((s) => ({ values: state.values, version: s.version + 1 }));
      setHasScholarship(state.values.has_scholarship);
    }
  }

  // Depois de um envio com erros, leva o foco ao primeiro campo inválido; erro do formulário
  // inteiro (ex.: limite de vagas por dia, CD075) aparece no topo: rola até a mensagem.
  useEffect(() => {
    if (!state) return;
    const invalid = state.fieldErrors
      ? formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  const values = source.values;
  const v = source.version;
  const errors = state?.fieldErrors;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-8">
      {opportunityId && <input type="hidden" name="opportunity_id" value={opportunityId} />}

      <FormMessage ref={messageRef} tone="error">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      <FormSection
        id="secao-vaga"
        title="A oportunidade"
        description="Conte o que a estudante vai fazer e aprender. Uma boa descrição atrai candidaturas que combinam com o projeto."
      >
        <Field label="Título" required error={errors?.title}>
          <Input
            key={`title-${v}`}
            name="title"
            defaultValue={values.title}
            maxLength={L.titleMax}
            placeholder="Ex.: Iniciação científica em polinização por abelhas nativas"
          />
        </Field>
        <Field label="Tipo" required error={errors?.kind}>
          <Select
            key={`kind-${v}`}
            name="kind"
            defaultValue={values.kind}
            options={OPPORTUNITY_KIND_OPTIONS}
          />
        </Field>
        <Field
          label="Descrição"
          required
          hint="O projeto, as atividades do dia a dia, o que ela vai aprender e como é a orientação."
          error={errors?.description}
        >
          <Textarea
            key={`description-${v}`}
            name="description"
            rows={8}
            defaultValue={values.description}
            maxLength={L.descriptionMax}
            showCount
          />
        </Field>
        <Field
          label="Requisitos"
          optional
          hint="Só o que é indispensável. Requisitos demais afastam estudantes que aprenderiam rápido."
          error={errors?.requirements}
        >
          <Textarea
            key={`requirements-${v}`}
            name="requirements"
            rows={4}
            defaultValue={values.requirements}
            maxLength={L.requirementsMax}
            showCount
          />
        </Field>
        <Field
          label="Área"
          optional
          hint="Ajuda quem filtra as vagas por área."
          error={errors?.area_id}
        >
          <AreaSelect
            key={`area-${v}`}
            areas={areas}
            mode="form"
            name="area_id"
            defaultValue={values.area_id}
            placeholder="Sem área específica"
          />
        </Field>
        <Field
          label="Palavras-chave"
          optional
          hint="Até 10. Ajudam a encontrar a vaga na busca."
          error={errors?.keywords}
        >
          <KeywordInput
            key={`keywords-${v}`}
            name="keywords"
            defaultValue={values.keywords}
            max={L.keywordsMax}
            maxLength={L.keywordMax}
          />
        </Field>
      </FormSection>

      <FormSection id="secao-local" title="Onde e como">
        <Field label="Instituição" optional error={errors?.institution}>
          <Input
            key={`institution-${v}`}
            name="institution"
            defaultValue={values.institution}
            maxLength={L.institutionMax}
            autoComplete="organization"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <Field label="Cidade" optional error={errors?.city}>
            <Input
              key={`city-${v}`}
              name="city"
              defaultValue={values.city}
              maxLength={L.cityMax}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="Estado" optional error={errors?.state}>
            <Select
              key={`state-${v}`}
              name="state"
              defaultValue={values.state}
              placeholder="Selecione…"
              options={UF_OPTIONS}
            />
          </Field>
        </div>
        <RadioGroup
          key={`modality-${v}`}
          name="modality"
          legend="Modalidade"
          options={MODALITY_OPTIONS}
          defaultValue={values.modality}
          orientation="horizontal"
          required
          error={errors?.modality}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Horas por semana" optional hint="De 1 a 40." error={errors?.weekly_hours}>
            <Input
              key={`hours-${v}`}
              name="weekly_hours"
              type="number"
              inputMode="numeric"
              min={L.weeklyHoursMin}
              max={L.weeklyHoursMax}
              defaultValue={values.weekly_hours}
            />
          </Field>
          <Field label="Número de vagas" required hint="De 1 a 20." error={errors?.vacancies}>
            <Input
              key={`vacancies-${v}`}
              name="vacancies"
              type="number"
              inputMode="numeric"
              min={L.vacanciesMin}
              max={L.vacanciesMax}
              defaultValue={values.vacancies}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection id="secao-bolsa" title="Bolsa">
        <Checkbox
          key={`scholarship-${v}`}
          name="has_scholarship"
          checked={hasScholarship}
          onChange={(event) => setHasScholarship(event.currentTarget.checked)}
          label="A vaga tem bolsa"
          description="Marque só se a bolsa estiver garantida ou em edital aberto."
        />
        {hasScholarship && (
          <Field
            label="Detalhes da bolsa"
            optional
            hint="Agência, valor ou duração. Ex.: PIBIC/CNPq, R$ 700 por mês, 12 meses."
            error={errors?.scholarship_info}
          >
            <Input
              key={`scholarship-info-${v}`}
              name="scholarship_info"
              defaultValue={values.scholarship_info}
              maxLength={L.scholarshipInfoMax}
            />
          </Field>
        )}
      </FormSection>

      <FormSection
        id="secao-quem"
        title="Quem pode se candidatar"
        description="As estudantes filtram as vagas pela própria etapa. Quem está em outra etapa ainda pode se candidatar, com um aviso."
      >
        <ChipGroup
          key={`stages-${v}`}
          name="target_stages"
          legend="Etapas"
          hint="Marque uma ou mais. Para IC Júnior, marque Ensino médio/técnico."
          options={CAREER_STAGE_OPTIONS}
          defaultValue={values.target_stages}
          required
          error={errors?.target_stages}
        />
        <Field
          label="Inscrições até"
          optional
          hint="O último dia ainda vale (horário de Brasília). Sem data, a vaga fica aberta até você encerrar."
          error={errors?.deadline}
        >
          <Input
            key={`deadline-${v}`}
            name="deadline"
            type="date"
            min={mode === "create" ? today : undefined}
            defaultValue={values.deadline}
            className="sm:max-w-56"
          />
        </Field>
      </FormSection>

      {mode === "create" && (
        <Checkbox
          key={`share-${v}`}
          name="share_to_feed"
          defaultChecked={values.share_to_feed}
          label="Compartilhar no feed"
          description="Publicamos “Abri uma vaga de …” no feed, com o link para a vaga, para quem acompanha você ver."
        />
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <SubmitButton size="lg" pendingText={mode === "create" ? "Publicando…" : "Salvando…"}>
          <Send aria-hidden="true" />
          {mode === "create" ? "Publicar oportunidade" : "Salvar alterações"}
        </SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost" size="lg">
          Cancelar
        </ButtonLink>
        <p className="w-full text-sm text-fg-subtle sm:w-auto">Campos com * são obrigatórios.</p>
      </div>
    </form>
  );
}
