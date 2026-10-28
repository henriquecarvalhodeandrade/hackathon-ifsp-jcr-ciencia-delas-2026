"use server";

import { z } from "zod";
import {
  CAREER_STAGES,
  MENTORSHIP_TOPICS,
  type CareerStage,
  type MentorshipTopic,
} from "@/lib/constants";

/**
 * Server Actions de DEMONSTRAÇÃO do guia vivo — validam e respondem, mas não gravam nada.
 * Servem de modelo para o padrão de formulários (zod + useActionState) descrito na documentação.
 */

export type DemoProfileValues = {
  full_name: string;
  email: string;
  career_stage: string;
  bio: string;
  topics: string[];
  keywords: string[];
};

export type DemoProfileState =
  | { ok: true; message: string; values: DemoProfileValues }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<keyof DemoProfileValues | "consent", string[]>>;
      values: DemoProfileValues;
    }
  | null;

const careerStages = Object.keys(CAREER_STAGES) as [CareerStage, ...CareerStage[]];
const topics = Object.keys(MENTORSHIP_TOPICS) as [MentorshipTopic, ...MentorshipTopic[]];

const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, { error: "Conte seu nome completo (pelo menos 3 letras)." })
    .max(120),
  email: z.email({ error: "Digite um e-mail válido, como nome@instituicao.edu.br." }),
  career_stage: z.enum(careerStages, { error: "Escolha em que fase da carreira você está." }),
  bio: z.string().trim().max(500, { error: "Use no máximo 500 caracteres." }),
  topics: z
    .array(z.enum(topics))
    .min(1, { error: "Escolha pelo menos um tema de mentoria." })
    .max(3, { error: "Escolha no máximo 3 temas." }),
  keywords: z
    .array(z.string().trim().min(2).max(40))
    .max(8, { error: "Use no máximo 8 palavras-chave." }),
  consent: z.literal("on", { error: "Precisamos do seu consentimento para continuar." }),
});

export async function submitDemoProfile(
  _prev: DemoProfileState,
  formData: FormData,
): Promise<DemoProfileState> {
  const values: DemoProfileValues = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    career_stage: String(formData.get("career_stage") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    topics: formData.getAll("topics").map(String),
    keywords: formData.getAll("keywords").map(String),
  };

  // Simula a latência de rede para mostrar o estado de carregamento.
  await new Promise((resolve) => setTimeout(resolve, 700));

  const parsed = schema.safeParse({ ...values, consent: formData.get("consent") ?? undefined });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo de cada um.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const firstName = parsed.data.full_name.split(" ")[0];
  return {
    ok: true,
    message: `Tudo certo, ${firstName}! (Demonstração: nada foi salvo.)`,
    values,
  };
}

/** Ação de demonstração do ConfirmDialog. */
export async function demoConfirmAction(formData: FormData): Promise<void> {
  void formData;
  await new Promise((resolve) => setTimeout(resolve, 900));
}

/**
 * Ação de demonstração no formato do useActionState (`stateAction` do ConfirmDialog):
 * sempre devolve um erro, para mostrar a mensagem dentro do diálogo aberto.
 */
export async function demoConfirmFailure(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: false; error: string }> {
  void formData;
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    ok: false,
    error: "Demonstração: não deu para arquivar agora. Nada foi alterado — tente de novo.",
  };
}
