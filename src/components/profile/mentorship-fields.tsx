"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { ChipGroup } from "@/components/ui/chip-group";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, MEETING_FORMATS, MENTORSHIP_TOPIC_OPTIONS } from "@/lib/constants";
import { AVAILABILITY_MARKER } from "@/lib/profile/form-values";
import { PROFILE_LIMITS } from "@/lib/profile/schemas";
import type { SectionFieldsProps } from "./about-fields";

const FORMAT_OPTIONS = Object.entries(MEETING_FORMATS).map(([value, label]) => ({ value, label }));
const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }));

export interface MentorshipFieldsProps extends SectionFieldsProps {
  /** No /perfil, mostra "Disponível para novos pedidos" (o onboarding não mostra). */
  showAvailability?: boolean;
}

function topicsLegend(seeks: boolean, mentor: boolean): string {
  if (seeks && mentor) return "Temas em que você quer ajuda ou pode orientar";
  if (mentor) return "Temas em que você pode orientar";
  return "Temas em que você quer ajuda";
}

/**
 * Seção 3 — Mentoria. As chaves revelam os campos de cada papel; os campos escondidos
 * continuam no formulário (com o texto já digitado), mas o servidor só os grava quando a
 * chave correspondente está ligada.
 */
export function MentorshipFields({ values, errors, showAvailability = false }: MentorshipFieldsProps) {
  const [seeks, setSeeks] = useState(Boolean(values.seeks_mentorship));
  const [mentor, setMentor] = useState(Boolean(values.is_mentor));
  const participates = seeks || mentor;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface-2 p-4">
          <Switch
            name="seeks_mentorship"
            label="Quero ser mentorada"
            description="Receba sugestões de mentoras com base no seu perfil e peça orientação."
            defaultChecked={values.seeks_mentorship}
            onChange={(event) => setSeeks(event.currentTarget.checked)}
          />
        </div>
        <div className="rounded-card border border-border bg-surface-2 p-4">
          <Switch
            name="is_mentor"
            label="Quero ser mentora"
            description="Apoie pesquisadoras em início de carreira com conversas e orientação."
            defaultChecked={values.is_mentor}
            onChange={(event) => setMentor(event.currentTarget.checked)}
          />
        </div>
      </div>

      {!participates && (
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          Tudo bem participar só do fórum e da vitrine. Você pode ativar a mentoria quando quiser, no seu perfil.
        </p>
      )}

      <div hidden={!seeks}>
        <Field
          label="O que você busca na mentoria?"
          optional
          hint="Ex.: escrever meu primeiro artigo, escolher um mestrado, conciliar pesquisa e maternidade."
          error={errors?.mentoring_goals}
        >
          <Textarea
            name="mentoring_goals"
            maxLength={PROFILE_LIMITS.mentoringGoals}
            showCount
            rows={4}
            defaultValue={values.mentoring_goals}
          />
        </Field>
      </div>

      <div hidden={!mentor}>
        <div className="grid gap-5">
          <Field
            label="Como você pode ajudar?"
            required
            hint="Sua experiência e os tipos de conversa em que você se sente à vontade. É o que as mentorandas leem primeiro."
            error={errors?.mentoring_offer}
          >
            <Textarea
              name="mentoring_offer"
              maxLength={PROFILE_LIMITS.mentoringOffer.max}
              showCount
              rows={4}
              defaultValue={values.mentoring_offer}
            />
          </Field>
          <Field
            label="Quantas mentorandas ao mesmo tempo?"
            required
            hint={`De ${PROFILE_LIMITS.mentorCapacity.min} a ${PROFILE_LIMITS.mentorCapacity.max}. Você pode mudar quando quiser.`}
            error={errors?.mentor_capacity}
          >
            <Input
              name="mentor_capacity"
              type="number"
              inputMode="numeric"
              min={PROFILE_LIMITS.mentorCapacity.min}
              max={PROFILE_LIMITS.mentorCapacity.max}
              defaultValue={values.mentor_capacity}
              className="max-w-32"
            />
          </Field>
          {showAvailability && (
            <div className="rounded-card border border-border p-4">
              <input type="hidden" name={AVAILABILITY_MARKER} value="1" />
              <Switch
                name="mentor_available"
                label="Disponível para novos pedidos"
                description="Desligue em períodos corridos: você sai das sugestões, mas mantém as mentorias em andamento."
                defaultChecked={values.mentor_available}
              />
            </div>
          )}
        </div>
      </div>

      <div hidden={!participates}>
        <div className="grid gap-6">
          <ChipGroup
            name="mentorship_topics"
            legend={topicsLegend(seeks, mentor)}
            hint={`Escolha até ${PROFILE_LIMITS.mentorshipTopics.max}.`}
            options={MENTORSHIP_TOPIC_OPTIONS}
            max={PROFILE_LIMITS.mentorshipTopics.max}
            defaultValue={values.mentorship_topics}
            required
            error={errors?.mentorship_topics}
          />
          <ChipGroup
            name="meeting_formats"
            legend="Formatos de encontro"
            options={FORMAT_OPTIONS}
            defaultValue={values.meeting_formats}
            required
            error={errors?.meeting_formats}
          />
          <ChipGroup
            name="languages"
            legend="Idiomas para as conversas"
            options={LANGUAGE_OPTIONS}
            max={PROFILE_LIMITS.languages.max}
            defaultValue={values.languages}
            required
            error={errors?.languages}
          />
        </div>
      </div>
    </div>
  );
}
