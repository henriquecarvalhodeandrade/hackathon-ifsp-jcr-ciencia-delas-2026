/**
 * Valores do formulário de perfil (onboarding e /perfil) como o navegador envia:
 * strings, listas de strings e booleanos. As Server Actions devolvem esses valores no
 * estado para que nada se perca quando a validação falha (o React 19 reseta o <form>).
 * Módulo puro.
 */
import type { Tables } from "@/lib/database.types";

export const PROFILE_SECTIONS = ["sobre", "pesquisa", "mentoria", "privacidade"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export function isProfileSection(value: unknown): value is ProfileSection {
  return typeof value === "string" && (PROFILE_SECTIONS as readonly string[]).includes(value);
}

export interface ProfileFormValues {
  // 1) Sobre você
  full_name: string;
  pronouns: string;
  headline: string;
  institution: string;
  city: string;
  state: string;
  career_stage: string;
  // 2) Sua pesquisa
  area_ids: string[];
  keywords: string[];
  bio: string;
  lattes_url: string;
  orcid: string;
  linkedin_url: string;
  website_url: string;
  // 3) Mentoria
  seeks_mentorship: boolean;
  is_mentor: boolean;
  mentoring_goals: string;
  mentoring_offer: string;
  mentor_capacity: string;
  mentor_available: boolean;
  mentorship_topics: string[];
  meeting_formats: string[];
  languages: string[];
  // 4) Privacidade e IA
  ai_consent: boolean;
}

export type ProfileFieldName = keyof ProfileFormValues;
export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string[]>>;

/** Campos de cada seção (a mesma divisão das etapas do onboarding e dos cartões do /perfil). */
export const SECTION_FIELDS: Record<ProfileSection, readonly ProfileFieldName[]> = {
  sobre: ["full_name", "pronouns", "headline", "institution", "city", "state", "career_stage"],
  pesquisa: ["area_ids", "keywords", "bio", "lattes_url", "orcid", "linkedin_url", "website_url"],
  mentoria: [
    "seeks_mentorship",
    "is_mentor",
    "mentoring_goals",
    "mentoring_offer",
    "mentor_capacity",
    "mentor_available",
    "mentorship_topics",
    "meeting_formats",
    "languages",
  ],
  privacidade: ["ai_consent"],
};

export const EMPTY_PROFILE_VALUES: ProfileFormValues = {
  full_name: "",
  pronouns: "",
  headline: "",
  institution: "",
  city: "",
  state: "",
  career_stage: "",
  area_ids: [],
  keywords: [],
  bio: "",
  lattes_url: "",
  orcid: "",
  linkedin_url: "",
  website_url: "",
  seeks_mentorship: false,
  is_mentor: false,
  mentoring_goals: "",
  mentoring_offer: "",
  mentor_capacity: "2",
  mentor_available: true,
  mentorship_topics: [],
  meeting_formats: ["online"],
  languages: ["pt"],
  ai_consent: false,
};

type ProfileRow = Pick<
  Tables<"profiles">,
  | "full_name"
  | "pronouns"
  | "headline"
  | "institution"
  | "city"
  | "state"
  | "career_stage"
  | "keywords"
  | "bio"
  | "lattes_url"
  | "orcid"
  | "linkedin_url"
  | "website_url"
  | "seeks_mentorship"
  | "is_mentor"
  | "mentoring_goals"
  | "mentoring_offer"
  | "mentor_capacity"
  | "mentor_available"
  | "mentorship_topics"
  | "meeting_formats"
  | "languages"
  | "ai_consent"
>;

/** Valores iniciais do formulário a partir do perfil salvo. */
export function profileToFormValues(
  profile: ProfileRow,
  areaIds: readonly number[],
): ProfileFormValues {
  return {
    full_name: profile.full_name ?? "",
    pronouns: profile.pronouns ?? "",
    headline: profile.headline ?? "",
    institution: profile.institution ?? "",
    city: profile.city ?? "",
    state: profile.state?.trim() ?? "",
    career_stage: profile.career_stage ?? "",
    area_ids: areaIds.map(String),
    keywords: [...(profile.keywords ?? [])],
    bio: profile.bio ?? "",
    lattes_url: profile.lattes_url ?? "",
    orcid: profile.orcid ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    website_url: profile.website_url ?? "",
    seeks_mentorship: profile.seeks_mentorship,
    is_mentor: profile.is_mentor,
    mentoring_goals: profile.mentoring_goals ?? "",
    mentoring_offer: profile.mentoring_offer ?? "",
    mentor_capacity: String(profile.mentor_capacity > 0 ? profile.mentor_capacity : 2),
    mentor_available: profile.mentor_available,
    mentorship_topics: [...(profile.mentorship_topics ?? [])],
    meeting_formats: profile.meeting_formats?.length ? [...profile.meeting_formats] : ["online"],
    languages: profile.languages?.length ? [...profile.languages] : ["pt"],
    ai_consent: profile.ai_consent,
  };
}

const FORM_FIELDS = new Set<string>(Object.keys(EMPTY_PROFILE_VALUES));

/**
 * Converte o `update` já validado/normalizado (ORCID com hífens, links com https://, tags sem
 * repetição…) de volta para valores de formulário — assim a tela mostra o que foi gravado.
 */
export function updateToFormValues(
  update: Readonly<Record<string, unknown>>,
  areaIds?: readonly number[],
): Partial<ProfileFormValues> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (!FORM_FIELDS.has(key)) continue;
    if (value === null || value === undefined) out[key] = "";
    else if (typeof value === "number") out[key] = String(value);
    else if (Array.isArray(value)) out[key] = value.map(String);
    else out[key] = value;
  }
  if (areaIds) out.area_ids = areaIds.map(String);
  return out as Partial<ProfileFormValues>;
}

/** Marca enviada pelo /perfil junto do campo "disponível para novos pedidos". */
export const AVAILABILITY_MARKER = "_has_availability";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function list(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

/** Lê do FormData só os campos da seção enviada. */
export function readSectionValues(
  section: ProfileSection,
  formData: FormData,
): Partial<ProfileFormValues> {
  switch (section) {
    case "sobre":
      return {
        full_name: text(formData, "full_name"),
        pronouns: text(formData, "pronouns"),
        headline: text(formData, "headline"),
        institution: text(formData, "institution"),
        city: text(formData, "city"),
        state: text(formData, "state"),
        career_stage: text(formData, "career_stage"),
      };
    case "pesquisa":
      return {
        area_ids: list(formData, "area_ids"),
        keywords: list(formData, "keywords"),
        bio: text(formData, "bio"),
        lattes_url: text(formData, "lattes_url"),
        orcid: text(formData, "orcid"),
        linkedin_url: text(formData, "linkedin_url"),
        website_url: text(formData, "website_url"),
      };
    case "mentoria": {
      const values: Partial<ProfileFormValues> = {
        seeks_mentorship: checked(formData, "seeks_mentorship"),
        is_mentor: checked(formData, "is_mentor"),
        mentoring_goals: text(formData, "mentoring_goals"),
        mentoring_offer: text(formData, "mentoring_offer"),
        mentor_capacity: text(formData, "mentor_capacity"),
        mentorship_topics: list(formData, "mentorship_topics"),
        meeting_formats: list(formData, "meeting_formats"),
        languages: list(formData, "languages"),
      };
      // O onboarding não mostra a disponibilidade: sem a marca, não mexemos no valor salvo.
      if (formData.has(AVAILABILITY_MARKER))
        values.mentor_available = checked(formData, "mentor_available");
      return values;
    }
    case "privacidade":
      return { ai_consent: checked(formData, "ai_consent") };
  }
}
