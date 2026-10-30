import { z } from "zod";
import {
  BR_STATES,
  CAREER_STAGES,
  MEETING_FORMATS,
  type BrState,
  type CareerStage,
  type MeetingFormat,
} from "@/lib/constants";
import { OPPORTUNITY_KINDS, type OpportunityKind } from "./labels";
import { OPPORTUNITY_LIMITS as L } from "./limits";
import { addYears, formatDeadlineDate, isDateOnly, todayInSaoPaulo } from "./presentation";

/**
 * Validação (zod) dos formulários do Explorar ICs. Módulo puro — usado pelas Server Actions.
 * Ids de usuárias NUNCA vêm do formulário: `owner_id` e `applicant_id` são `auth.uid()` no banco.
 */

// ---------------------------------------------------------------------------
// Vaga (publicar / editar)
// ---------------------------------------------------------------------------

/** Valores crus do formulário, devolvidos às actions para repor os campos (React 19 reseta o form). */
export interface OpportunityFormValues {
  title: string;
  kind: string;
  description: string;
  requirements: string;
  area_id: string;
  keywords: string[];
  institution: string;
  city: string;
  state: string;
  modality: string;
  has_scholarship: boolean;
  scholarship_info: string;
  weekly_hours: string;
  vacancies: string;
  target_stages: string[];
  deadline: string;
  /** Só ao publicar: cria uma publicação no feed apontando para a vaga. */
  share_to_feed: boolean;
}

export const EMPTY_OPPORTUNITY_VALUES: OpportunityFormValues = {
  title: "",
  kind: "ic",
  description: "",
  requirements: "",
  area_id: "",
  keywords: [],
  institution: "",
  city: "",
  state: "",
  modality: "in_person",
  has_scholarship: false,
  scholarship_info: "",
  weekly_hours: "",
  vacancies: "1",
  target_stages: ["undergraduate"],
  deadline: "",
  share_to_feed: true,
};

/** Valores iniciais de uma vaga nova: instituição, cidade e UF vêm do perfil de quem publica. */
export function newOpportunityValues(profile: {
  institution: string | null;
  city: string | null;
  state: string | null;
}): OpportunityFormValues {
  return {
    ...EMPTY_OPPORTUNITY_VALUES,
    institution: (profile.institution ?? "").slice(0, L.institutionMax),
    city: (profile.city ?? "").slice(0, L.cityMax),
    state: profile.state && profile.state in BR_STATES ? profile.state : "",
  };
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};
const list = (formData: FormData, name: string) =>
  formData.getAll(name).filter((v): v is string => typeof v === "string");

export function readOpportunityForm(formData: FormData): OpportunityFormValues {
  return {
    title: text(formData, "title"),
    kind: text(formData, "kind"),
    description: text(formData, "description"),
    requirements: text(formData, "requirements"),
    area_id: text(formData, "area_id"),
    keywords: list(formData, "keywords"),
    institution: text(formData, "institution"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    modality: text(formData, "modality"),
    has_scholarship: formData.get("has_scholarship") === "on",
    scholarship_info: text(formData, "scholarship_info"),
    weekly_hours: text(formData, "weekly_hours"),
    vacancies: text(formData, "vacancies"),
    target_stages: list(formData, "target_stages"),
    deadline: text(formData, "deadline"),
    share_to_feed: formData.get("share_to_feed") === "on",
  };
}

/** O navegador envia quebras de linha do <textarea> como CRLF: viram LF antes de contar. */
const lf = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value);

const optionalText = (max: number, message: string) =>
  z.preprocess(
    lf,
    z
      .string()
      .trim()
      .max(max, { error: message })
      .transform((v) => (v === "" ? null : v)),
  );

function dedupe(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const kinds = Object.keys(OPPORTUNITY_KINDS) as [OpportunityKind, ...OpportunityKind[]];
const formats = Object.keys(MEETING_FORMATS) as [MeetingFormat, ...MeetingFormat[]];
const stages = Object.keys(CAREER_STAGES) as [CareerStage, ...CareerStage[]];

/** Inteiro opcional dentro de [min, max]; vazio → null. */
const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) >= min && Number(v) <= max), {
      error: message,
    })
    .transform((v) => (v === "" ? null : Number(v)));

export interface OpportunitySchemaOptions {
  now?: Date;
  /**
   * Prazo já salvo (edição). Mantê-lo é sempre permitido, mesmo vencido — a dona pode corrigir o
   * texto de uma vaga antiga sem ter de inventar um novo prazo.
   */
  currentDeadline?: string | null;
}

export function createOpportunitySchema(options: OpportunitySchemaOptions = {}) {
  const { now = new Date(), currentDeadline = null } = options;
  const today = todayInSaoPaulo(now);
  const latest = addYears(today, L.deadlineMaxYears);

  return z
    .object({
      title: z
        .string()
        .trim()
        .min(L.titleMin, { error: "Dê um título à vaga (pelo menos 5 caracteres)." })
        .max(L.titleMax, { error: "O título pode ter no máximo 160 caracteres." }),
      kind: z.enum(kinds, { error: "Escolha o tipo da oportunidade." }),
      description: z.preprocess(
        lf,
        z
          .string()
          .trim()
          .min(L.descriptionMin, {
            error:
              "Descreva a vaga em pelo menos 30 caracteres: o projeto, as atividades e o que a estudante vai aprender.",
          })
          .max(L.descriptionMax, { error: "A descrição pode ter no máximo 4.000 caracteres." }),
      ),
      requirements: optionalText(
        L.requirementsMax,
        "Os requisitos podem ter no máximo 2.000 caracteres.",
      ),
      area_id: z
        .string()
        .trim()
        .refine((v) => v === "" || (/^\d{1,5}$/.test(v) && Number(v) > 0), {
          error: "Escolha uma área da lista.",
        })
        .transform((v) => (v === "" ? null : Number(v))),
      keywords: z
        .array(
          z.string().trim().max(L.keywordMax, {
            error: "Cada palavra-chave pode ter no máximo 40 caracteres.",
          }),
        )
        .transform((items) =>
          dedupe(items.map((k) => k.toLocaleLowerCase("pt-BR")).filter(Boolean)),
        )
        .pipe(
          z.array(z.string()).max(L.keywordsMax, { error: "Use no máximo 10 palavras-chave." }),
        ),
      institution: optionalText(
        L.institutionMax,
        "O nome da instituição pode ter no máximo 160 caracteres.",
      ),
      city: optionalText(L.cityMax, "O nome da cidade pode ter no máximo 80 caracteres."),
      state: z
        .string()
        .trim()
        .toUpperCase()
        .refine((v) => v === "" || v in BR_STATES, { error: "Escolha um estado da lista." })
        .transform((v) => (v === "" ? null : (v as BrState))),
      modality: z.enum(formats, { error: "Escolha a modalidade: presencial, híbrida ou on-line." }),
      has_scholarship: z.boolean(),
      scholarship_info: optionalText(
        L.scholarshipInfoMax,
        "Os detalhes da bolsa podem ter no máximo 160 caracteres.",
      ),
      weekly_hours: optionalInt(
        L.weeklyHoursMin,
        L.weeklyHoursMax,
        "Informe de 1 a 40 horas por semana (ou deixe em branco).",
      ),
      vacancies: z
        .string()
        .trim()
        .refine(
          (v) => /^\d{1,2}$/.test(v) && Number(v) >= L.vacanciesMin && Number(v) <= L.vacanciesMax,
          {
            error: "Informe de 1 a 20 vagas.",
          },
        )
        .transform(Number),
      target_stages: z
        .array(z.enum(stages, { error: "Escolha etapas da lista." }))
        .transform((items) => [...new Set(items)])
        .pipe(
          z
            .array(z.enum(stages))
            .min(L.targetStagesMin, {
              error: "Marque pelo menos uma etapa de quem pode se candidatar.",
            })
            .max(L.targetStagesMax),
        ),
      deadline: z
        .string()
        .trim()
        .refine((v) => v === "" || isDateOnly(v), {
          error: "Use uma data válida, como 15/11/2026.",
        })
        .refine((v) => v === "" || v === currentDeadline || v >= today, {
          error: "O prazo não pode estar no passado. Escolha hoje ou uma data futura.",
        })
        .refine((v) => v === "" || v === currentDeadline || v <= latest, {
          error: `Escolha um prazo até ${formatDeadlineDate(latest, { now, long: true })}.`,
        })
        .transform((v) => (v === "" ? null : v)),
    })
    .transform(({ has_scholarship, scholarship_info, ...rest }) => ({
      ...rest,
      has_scholarship,
      // Sem bolsa, os detalhes da bolsa não fazem sentido (o campo some da tela).
      scholarship_info: has_scholarship ? scholarship_info : null,
    }));
}

export type OpportunityInput = z.output<ReturnType<typeof createOpportunitySchema>>;
export type OpportunityFieldErrors = Partial<Record<keyof OpportunityFormValues, string[]>>;

export function validateOpportunityForm(
  values: OpportunityFormValues,
  options: OpportunitySchemaOptions = {},
):
  | { success: true; data: OpportunityInput }
  | { success: false; fieldErrors: OpportunityFieldErrors } {
  const parsed = createOpportunitySchema(options).safeParse(values);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    fieldErrors: z.flattenError(parsed.error).fieldErrors as OpportunityFieldErrors,
  };
}

/** Uma linha do banco → valores do formulário de edição. */
export function opportunityToFormValues(row: {
  title: string;
  kind: string;
  description: string;
  requirements: string | null;
  area_id: number | null;
  keywords: string[];
  institution: string | null;
  city: string | null;
  state: string | null;
  modality: string;
  has_scholarship: boolean;
  scholarship_info: string | null;
  weekly_hours: number | null;
  vacancies: number;
  target_stages: string[];
  deadline: string | null;
}): OpportunityFormValues {
  return {
    title: row.title,
    kind: row.kind,
    description: row.description,
    requirements: row.requirements ?? "",
    area_id: row.area_id ? String(row.area_id) : "",
    keywords: [...row.keywords],
    institution: row.institution ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    modality: row.modality,
    has_scholarship: row.has_scholarship,
    scholarship_info: row.scholarship_info ?? "",
    weekly_hours: row.weekly_hours ? String(row.weekly_hours) : "",
    vacancies: String(row.vacancies),
    target_stages: [...row.target_stages],
    deadline: row.deadline ?? "",
    share_to_feed: false,
  };
}

// ---------------------------------------------------------------------------
// Candidaturas
// ---------------------------------------------------------------------------

const id = (message: string) => z.guid({ error: message });

const OPPORTUNITY_GONE = "Não encontramos esta vaga. Recarregue a página e tente de novo.";
const APPLICATION_GONE = "Não encontramos esta candidatura. Recarregue a página e tente de novo.";

export const applySchema = z.object({
  opportunity_id: id(OPPORTUNITY_GONE),
  message: z.preprocess(
    lf,
    z
      .string({ error: "Escreva sua carta de apresentação." })
      .trim()
      .min(L.messageMin, {
        error:
          "Escreva pelo menos 30 caracteres: conte quem você é e por que esta vaga combina com você.",
      })
      .max(L.messageMax, { error: "Use no máximo 2.000 caracteres." }),
  ),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const withdrawSchema = z.object({
  application_id: id(APPLICATION_GONE),
  opportunity_id: id(OPPORTUNITY_GONE),
});

export const respondSchema = z.object({
  application_id: id(APPLICATION_GONE),
  opportunity_id: id(OPPORTUNITY_GONE),
  decision: z.enum(["in_review", "accepted", "declined"], {
    error: "Escolha: em análise, aprovar ou não aprovar.",
  }),
  owner_note: optionalText(L.ownerNoteMax, "Use no máximo 1.000 caracteres."),
});
export type RespondInput = z.infer<typeof respondSchema>;

export const statusSchema = z.object({
  opportunity_id: id(OPPORTUNITY_GONE),
  status: z.enum(["open", "closed"], { error: "Escolha encerrar ou reabrir a vaga." }),
});

export const opportunityIdSchema = z.object({ opportunity_id: id(OPPORTUNITY_GONE) });

/** Primeiro erro de cada campo, no formato aceito pelo <Field error>. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value;
  }
  return out;
}
