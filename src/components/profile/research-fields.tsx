"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KeywordInput } from "@/components/ui/keyword-input";
import { Textarea } from "@/components/ui/textarea";
import type { AreaGroup } from "@/lib/profile/areas";
import { PROFILE_LIMITS } from "@/lib/profile/schemas";
import type { SectionFieldsProps } from "./about-fields";
import { AreaPicker } from "./area-picker";

export interface ResearchFieldsProps extends SectionFieldsProps {
  areaGroups: readonly AreaGroup[];
}

/** Seção 2 — Sua pesquisa (áreas, palavras-chave, apresentação e links acadêmicos). */
export function ResearchFields({ values, errors, areaGroups }: ResearchFieldsProps) {
  return (
    <div className="grid gap-6">
      <AreaPicker
        groups={areaGroups}
        defaultValue={values.area_ids}
        max={PROFILE_LIMITS.areas.max}
        error={errors?.area_ids}
      />

      <Field
        label="Palavras-chave"
        optional
        hint="Temas, métodos, organismos, ferramentas… até 15. Ajudam a encontrar afinidades."
        error={errors?.keywords}
      >
        <KeywordInput
          name="keywords"
          max={PROFILE_LIMITS.keywords.max}
          maxLength={PROFILE_LIMITS.keywords.maxLength}
          defaultValue={values.keywords}
          placeholder="Ex.: visão computacional"
        />
      </Field>

      <Field
        label="Sobre você e sua pesquisa"
        optional
        hint="Em poucas linhas: o que você pesquisa, o que te move, o que procura na comunidade."
        error={errors?.bio}
      >
        <Textarea name="bio" maxLength={PROFILE_LIMITS.bio} showCount rows={5} defaultValue={values.bio} />
      </Field>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold text-fg">Links acadêmicos</legend>
        <p className="-mt-1 text-sm text-fg-muted">
          Opcionais. Aparecem no seu perfil para outras membros e nunca são enviados para a IA.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Currículo Lattes" optional error={errors?.lattes_url}>
            <Input
              name="lattes_url"
              inputMode="url"
              autoComplete="url"
              placeholder="lattes.cnpq.br/0000000000000000"
              defaultValue={values.lattes_url}
            />
          </Field>
          <Field label="ORCID iD" optional error={errors?.orcid}>
            <Input
              name="orcid"
              placeholder="0000-0000-0000-0000"
              autoCapitalize="characters"
              defaultValue={values.orcid}
              className="font-mono"
            />
          </Field>
          <Field label="LinkedIn" optional error={errors?.linkedin_url}>
            <Input
              name="linkedin_url"
              inputMode="url"
              placeholder="linkedin.com/in/seu-perfil"
              defaultValue={values.linkedin_url}
            />
          </Field>
          <Field label="Site ou portfólio" optional error={errors?.website_url}>
            <Input
              name="website_url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://"
              defaultValue={values.website_url}
            />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
