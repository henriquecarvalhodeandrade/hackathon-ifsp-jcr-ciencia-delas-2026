"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveProfileSectionAction } from "@/app/perfil/actions";
import type { AreaGroup } from "@/lib/profile/areas";
import type { ProfileFormValues, ProfileSection } from "@/lib/profile/form-values";
import type { ProfileActionState } from "@/lib/profile/types";
import { AboutFields } from "./about-fields";
import { MentorshipFields } from "./mentorship-fields";
import { PrivacyFields } from "./privacy-fields";
import { ResearchFields } from "./research-fields";

export interface ProfileSectionFormProps {
  section: ProfileSection;
  initialValues: ProfileFormValues;
  /** Necessário para a seção "pesquisa". */
  areaGroups?: readonly AreaGroup[];
  submitLabel?: string;
}

/** Um cartão do /perfil: os mesmos campos do onboarding, com o próprio botão "Salvar". */
export function ProfileSectionForm({
  section,
  initialValues,
  areaGroups = [],
  submitLabel = "Salvar",
}: ProfileSectionFormProps) {
  const [state, formAction] = useActionState<ProfileActionState, FormData>(
    saveProfileSectionAction,
    null,
  );
  const [version, setVersion] = useState(0);
  const [seenState, setSeenState] = useState<ProfileActionState>(state);
  if (state !== seenState) {
    setSeenState(state);
    setVersion((v) => v + 1);
  }

  const values: Partial<ProfileFormValues> = state
    ? { ...initialValues, ...state.values }
    : initialValues;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!errors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-6">
      <input type="hidden" name="section" value={section} />
      <div key={version}>
        {section === "sobre" && <AboutFields values={values} errors={errors} />}
        {section === "pesquisa" && (
          <ResearchFields values={values} errors={errors} areaGroups={areaGroups} />
        )}
        {section === "mentoria" && (
          <MentorshipFields values={values} errors={errors} showAvailability />
        )}
        {section === "privacidade" && <PrivacyFields values={values} errors={errors} />}
      </div>
      <div className="grid gap-3 border-t border-border pt-5 sm:flex sm:items-center sm:justify-between">
        <FormMessage tone={state?.ok ? "success" : "error"} className="sm:flex-1">
          {state ? (state.ok ? state.message : state.error) : null}
        </FormMessage>
        <SubmitButton pendingText="Salvando…" className="justify-self-start sm:ml-auto">
          <Save aria-hidden="true" />
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
