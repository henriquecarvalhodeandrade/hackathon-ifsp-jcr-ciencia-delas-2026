/**
 * Validação (zod) das seções do perfil — a mesma no onboarding e no /perfil.
 * Converte os valores do formulário no `update` de `profiles` (só colunas com GRANT de
 * UPDATE para a usuária) e, na seção de pesquisa, na lista de áreas.
 * Módulo puro (testado em schemas.test.ts). Os limites espelham os CHECKs do banco.
 */
import { z } from "zod";
import type { TablesUpdate } from "@/lib/database.types";
import {
  BR_STATES,
  CAREER_STAGES,
  LANGUAGES,
  MEETING_FORMATS,
  MENTORSHIP_TOPICS,
  type BrState,
  type CareerStage,
  type MeetingFormat,
  type MentorshipTopic,
} from "@/lib/constants";
import {
  TRAJECTORY_MAX,
  TRAJECTORY_SLUGS,
  normalizeTrajectoryTags,
  type TrajectorySlug,
} from "@/lib/trajectory/catalog";
import type { ProfileFieldErrors, ProfileFormValues, ProfileSection } from "./form-values";
import { normalizeOrcid, normalizeProfileUrl, type ProfileLinkKind } from "./links";

export const PROFILE_LIMITS = {
  fullName: { min: 3, max: 120 },
  pronouns: 30,
  headline: 160,
  institution: 160,
  city: 80,
  bio: 2000,
  areas: { min: 1, max: 5 },
  keywords: { max: 15, maxLength: 60 },
  mentoringGoals: 1000,
  mentoringOffer: { min: 20, max: 1000 },
  mentorCapacity: { min: 1, max: 20 },
  mentorshipTopics: { max: 8 },
  languages: { max: 5 },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

const careerStages = Object.keys(CAREER_STAGES) as [CareerStage, ...CareerStage[]];
const states = Object.keys(BR_STATES) as [BrState, ...BrState[]];
const topics = Object.keys(MENTORSHIP_TOPICS) as [MentorshipTopic, ...MentorshipTopic[]];
const formats = Object.keys(MEETING_FORMATS) as [MeetingFormat, ...MeetingFormat[]];
const languages = Object.keys(LANGUAGES) as [LanguageCode, ...LanguageCode[]];
const trajectorySlugs = TRAJECTORY_SLUGS as [TrajectorySlug, ...TrajectorySlug[]];

/** Colunas que a própria usuária pode alterar (o banco recusa id, role, created_at, updated_at). */
export type ProfileUpdate = Omit<
  TablesUpdate<"profiles">,
  "id" | "role" | "created_at" | "updated_at"
>;

export type SectionParseResult =
  | { success: true; update: ProfileUpdate; areaIds?: number[] }
  | { success: false; fieldErrors: ProfileFieldErrors };

const maxChars = (max: number) => `Use no máximo ${max.toLocaleString("pt-BR")} caracteres.`;

/** Texto opcional: vazio vira null (o banco também normaliza). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: maxChars(max) })
    .transform((value) => (value === "" ? null : value));

const optionalUrl = (kind: ProfileLinkKind) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const result = normalizeProfileUrl(value, kind);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: result.error });
        return z.NEVER;
      }
      return result.value;
    });

const optionalOrcid = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const result = normalizeOrcid(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.value;
  });

/** Lista sem itens vazios nem repetidos (comparação sem diferenciar maiúsculas). */
export function uniqueTags(items: readonly string[], lowercase = true): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = item.replace(/\s+/g, " ").trim();
    const value = lowercase ? clean.toLocaleLowerCase("pt-BR") : clean;
    const key = value.toLocaleLowerCase("pt-BR");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const aboutSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(PROFILE_LIMITS.fullName.min, { error: "Conte seu nome completo (pelo menos 3 letras)." })
    .max(PROFILE_LIMITS.fullName.max, { error: maxChars(PROFILE_LIMITS.fullName.max) }),
  pronouns: optionalText(PROFILE_LIMITS.pronouns),
  headline: optionalText(PROFILE_LIMITS.headline),
  institution: optionalText(PROFILE_LIMITS.institution),
  city: optionalText(PROFILE_LIMITS.city),
  state: z
    .union([z.literal(""), z.enum(states)], { error: "Escolha um estado da lista." })
    .transform((value) => (value === "" ? null : value)),
  career_stage: z.enum(careerStages, { error: "Escolha em que fase da carreira você está." }),
  // Opcional: ausente = o formulário não mostrou o grupo (as marcas salvas ficam como estão).
  trajectory_tags: z
    .array(
      z.enum(trajectorySlugs, {
        error:
          "Uma das opções de trajetória não existe mais. Recarregue a página e escolha de novo.",
      }),
    )
    .max(TRAJECTORY_MAX, { error: `Escolha no máximo ${TRAJECTORY_MAX} opções.` })
    .transform((items) => normalizeTrajectoryTags(items))
    .optional(),
});

const researchSchema = z.object({
  area_ids: z
    .array(z.string())
    .transform((ids) => [...new Set(ids.map((id) => id.trim()).filter(Boolean))])
    .pipe(
      z
        .array(
          z
            .string()
            .regex(/^\d{1,5}$/, { error: "Recebemos uma área inválida. Recarregue a página." }),
        )
        .min(PROFILE_LIMITS.areas.min, { error: "Escolha pelo menos uma área de pesquisa." })
        .max(PROFILE_LIMITS.areas.max, {
          error: `Escolha no máximo ${PROFILE_LIMITS.areas.max} áreas.`,
        }),
    )
    .transform((ids) => ids.map(Number)),
  keywords: z
    .array(z.string())
    .transform((items) => uniqueTags(items))
    .pipe(
      z
        .array(
          z.string().max(PROFILE_LIMITS.keywords.maxLength, {
            error: `Cada palavra-chave pode ter até ${PROFILE_LIMITS.keywords.maxLength} caracteres.`,
          }),
        )
        .max(PROFILE_LIMITS.keywords.max, {
          error: `Use no máximo ${PROFILE_LIMITS.keywords.max} palavras-chave.`,
        }),
    ),
  bio: optionalText(PROFILE_LIMITS.bio),
  lattes_url: optionalUrl("lattes"),
  orcid: optionalOrcid,
  linkedin_url: optionalUrl("linkedin"),
  website_url: optionalUrl("website"),
});

const mentorshipSchema = z
  .object({
    seeks_mentorship: z.boolean(),
    is_mentor: z.boolean(),
    mentoring_goals: optionalText(PROFILE_LIMITS.mentoringGoals),
    mentoring_offer: optionalText(PROFILE_LIMITS.mentoringOffer.max),
    mentor_capacity: z.string().trim(),
    mentor_available: z.boolean().optional(),
    mentorship_topics: z
      .array(z.enum(topics, { error: "Escolha temas da lista." }))
      .max(PROFILE_LIMITS.mentorshipTopics.max, {
        error: `Escolha no máximo ${PROFILE_LIMITS.mentorshipTopics.max} temas.`,
      })
      .transform((items) => [...new Set(items)]),
    meeting_formats: z
      .array(z.enum(formats, { error: "Escolha formatos da lista." }))
      .transform((items) => [...new Set(items)]),
    languages: z
      .array(z.enum(languages, { error: "Escolha idiomas da lista." }))
      .max(PROFILE_LIMITS.languages.max, {
        error: `Escolha no máximo ${PROFILE_LIMITS.languages.max} idiomas.`,
      })
      .transform((items) => [...new Set(items)]),
  })
  .superRefine((data, ctx) => {
    const participates = data.is_mentor || data.seeks_mentorship;
    if (data.is_mentor) {
      const offer = data.mentoring_offer ?? "";
      if (offer.length < PROFILE_LIMITS.mentoringOffer.min) {
        ctx.addIssue({
          code: "custom",
          path: ["mentoring_offer"],
          message:
            "Conte em pelo menos 20 caracteres como você pode ajudar — é isso que as mentorandas leem primeiro.",
        });
      }
      const capacity = Number(data.mentor_capacity);
      const { min, max } = PROFILE_LIMITS.mentorCapacity;
      if (!/^\d+$/.test(data.mentor_capacity) || capacity < min || capacity > max) {
        ctx.addIssue({
          code: "custom",
          path: ["mentor_capacity"],
          message: `Informe um número entre ${min} e ${max}.`,
        });
      }
    }
    if (participates) {
      if (data.mentorship_topics.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["mentorship_topics"],
          message: "Escolha pelo menos um tema.",
        });
      }
      if (data.meeting_formats.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["meeting_formats"],
          message: "Escolha pelo menos um formato de encontro.",
        });
      }
      if (data.languages.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["languages"],
          message: "Escolha pelo menos um idioma.",
        });
      }
    }
  });

const privacySchema = z.object({ ai_consent: z.boolean() });

function fieldErrorsOf(error: z.ZodError): ProfileFieldErrors {
  return z.flattenError(error).fieldErrors as ProfileFieldErrors;
}

/**
 * Valida uma seção e devolve o `update` para `profiles`.
 * Campos condicionais (ex.: oferta de mentora) só entram no update quando a opção está ligada,
 * para não apagar o que a pessoa escreveu antes de desligar a opção.
 */
export function parseProfileSection(
  section: ProfileSection,
  values: Partial<ProfileFormValues>,
): SectionParseResult {
  switch (section) {
    case "sobre": {
      const parsed = aboutSchema.safeParse(values);
      if (!parsed.success) return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
      const { trajectory_tags, ...update } = parsed.data;
      return {
        success: true,
        update: trajectory_tags === undefined ? update : { ...update, trajectory_tags },
      };
    }
    case "pesquisa": {
      const parsed = researchSchema.safeParse(values);
      if (!parsed.success) return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
      const { area_ids, ...update } = parsed.data;
      return { success: true, update, areaIds: area_ids };
    }
    case "mentoria": {
      const parsed = mentorshipSchema.safeParse(values);
      if (!parsed.success) return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
      const data = parsed.data;
      const update: ProfileUpdate = {
        seeks_mentorship: data.seeks_mentorship,
        is_mentor: data.is_mentor,
      };
      if (data.seeks_mentorship) update.mentoring_goals = data.mentoring_goals;
      if (data.is_mentor) {
        update.mentoring_offer = data.mentoring_offer;
        update.mentor_capacity = Number(data.mentor_capacity);
        if (data.mentor_available !== undefined) update.mentor_available = data.mentor_available;
      }
      if (data.is_mentor || data.seeks_mentorship) {
        update.mentorship_topics = data.mentorship_topics;
        update.meeting_formats = data.meeting_formats as MeetingFormat[];
        update.languages = data.languages;
      }
      return { success: true, update };
    }
    case "privacidade": {
      const parsed = privacySchema.safeParse(values);
      if (!parsed.success) return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
      return { success: true, update: { ai_consent: parsed.data.ai_consent } };
    }
  }
}

/** O que falta para concluir o onboarding (etapa a revisar), ou null se está tudo certo. */
export function missingOnboardingStep(profile: {
  full_name: string | null;
  career_stage: string | null;
  areaCount: number;
}): { step: 1 | 2; message: string } | null {
  if (
    !profile.full_name ||
    profile.full_name.trim().length < PROFILE_LIMITS.fullName.min ||
    !profile.career_stage
  ) {
    return { step: 1, message: "Falta completar a etapa “Sobre você” (nome e fase da carreira)." };
  }
  if (profile.areaCount < 1) {
    return { step: 2, message: "Falta escolher pelo menos uma área na etapa “Sua pesquisa”." };
  }
  return null;
}
