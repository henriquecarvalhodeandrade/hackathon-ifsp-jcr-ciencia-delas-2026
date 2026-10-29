import type { CareerStage, MeetingFormat } from "@/lib/constants";
import type { ApplicationStatus, OpportunityKind, OpportunityStatus } from "./labels";
import type { OpportunityFieldErrors, OpportunityFormValues } from "./schema";

/** Formatos de leitura e estados das Server Actions do Explorar ICs. */

export interface OpportunityPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  career_stage: CareerStage | null;
}

export interface OpportunityListItem {
  id: string;
  owner_id: string;
  owner: OpportunityPerson | null;
  kind: OpportunityKind;
  title: string;
  institution: string | null;
  city: string | null;
  state: string | null;
  area: { id: number; slug: string; name: string } | null;
  modality: MeetingFormat;
  has_scholarship: boolean;
  scholarship_info: string | null;
  weekly_hours: number | null;
  vacancies: number;
  deadline: string | null;
  status: OpportunityStatus;
  application_count: number;
  created_at: string;
}

export interface OpportunityDetail extends OpportunityListItem {
  description: string;
  requirements: string | null;
  area_id: number | null;
  keywords: string[];
  target_stages: CareerStage[];
  updated_at: string;
  closed_at: string | null;
}

export interface Application {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  status: ApplicationStatus;
  message: string;
  owner_note: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

/** Candidatura recebida (dona da vaga): com o perfil público da candidata. */
export interface ReceivedApplication extends Application {
  applicant:
    | (OpportunityPerson & {
        city: string | null;
        state: string | null;
        lattes_url: string | null;
        orcid: string | null;
      })
    | null;
}

/** Candidatura da própria usuária (/ics/minhas): com a vaga e a dona. */
export interface MyApplicationItem extends Application {
  opportunity: {
    id: string;
    title: string;
    kind: OpportunityKind;
    status: OpportunityStatus;
    deadline: string | null;
    institution: string | null;
    owner_id: string;
    owner: Pick<OpportunityPerson, "id" | "full_name" | "avatar_url"> | null;
  } | null;
}

/** Vaga publicada pela própria usuária, com quantas candidaturas novas esperam resposta. */
export interface MyOpportunityItem extends OpportunityListItem {
  new_applications: number;
}

export type ListResult<T> =
  { ok: true; items: T[]; total: number } | { ok: false; items: T[]; total: 0 };

// ---------------------------------------------------------------------------
// Estados das Server Actions (formato do useActionState)
// ---------------------------------------------------------------------------

export type OpportunityFormState = {
  ok: false;
  error: string;
  fieldErrors?: OpportunityFieldErrors;
  values: OpportunityFormValues;
} | null;

export type ActionState<V extends Record<string, string> = Record<string, string>> =
  | { ok: true; message: string; values?: V }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; values?: V }
  | null;

export type ApplyValues = { message: string };
export type RespondValues = { owner_note: string };

/** Ações de um clique (ConfirmDialog): sucesso fecha o diálogo; erro fica nele. */
export type SimpleResult = { ok: true } | { ok: false; error: string };
