import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BR_STATES, CAREER_STAGE_OPTIONS } from "@/lib/constants";
import type { ProfileFieldErrors, ProfileFormValues } from "@/lib/profile/form-values";
import { PROFILE_LIMITS } from "@/lib/profile/schemas";
import { TrajectoryFields } from "./trajectory-fields";

const UF_OPTIONS = Object.entries(BR_STATES).map(([value, label]) => ({
  value,
  label: `${value} — ${label}`,
}));

export interface SectionFieldsProps {
  values: Partial<ProfileFormValues>;
  errors?: ProfileFieldErrors;
}

/**
 * Seção 1 — Sobre você (nome, pronomes, título, fase da carreira, instituição e local) e, no
 * fim, as marcas opcionais de trajetória (docs/17).
 */
export function AboutFields({ values, errors }: SectionFieldsProps) {
  return (
    <div className="grid gap-5">
      <Field label="Nome completo" required error={errors?.full_name}>
        <Input
          name="full_name"
          autoComplete="name"
          maxLength={PROFILE_LIMITS.fullName.max}
          defaultValue={values.full_name}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field
          label="Título curto"
          optional
          hint="Uma linha sobre você. Ex.: Mestranda em ecologia · polinização"
          error={errors?.headline}
        >
          <Input
            name="headline"
            maxLength={PROFILE_LIMITS.headline}
            defaultValue={values.headline}
          />
        </Field>
        <Field label="Pronomes" optional hint="Ex.: ela/dela" error={errors?.pronouns}>
          <Input
            name="pronouns"
            maxLength={PROFILE_LIMITS.pronouns}
            defaultValue={values.pronouns}
          />
        </Field>
      </div>

      <Field
        label="Fase da carreira"
        required
        hint="Usamos para sugerir mentoras alguns passos à frente de você."
        error={errors?.career_stage}
      >
        <Select
          name="career_stage"
          placeholder="Selecione…"
          options={CAREER_STAGE_OPTIONS}
          defaultValue={values.career_stage ?? ""}
        />
      </Field>

      <Field
        label="Instituição"
        optional
        hint="Onde você estuda ou trabalha."
        error={errors?.institution}
      >
        <Input
          name="institution"
          autoComplete="organization"
          maxLength={PROFILE_LIMITS.institution}
          defaultValue={values.institution}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Field label="Cidade" optional error={errors?.city}>
          <Input
            name="city"
            autoComplete="address-level2"
            maxLength={PROFILE_LIMITS.city}
            defaultValue={values.city}
          />
        </Field>
        <Field label="Estado" optional error={errors?.state}>
          <Select
            name="state"
            placeholder="Selecione…"
            options={UF_OPTIONS}
            defaultValue={values.state ?? ""}
          />
        </Field>
      </div>

      <TrajectoryFields defaultValue={values.trajectory_tags} error={errors?.trajectory_tags} />
    </div>
  );
}
