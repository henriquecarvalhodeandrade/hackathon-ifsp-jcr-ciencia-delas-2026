"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_OFF, DEMO_UNKNOWN_PERSONA } from "@/lib/demo/guard";
import { getPersona } from "@/lib/demo/personas";
import { openDemoSession } from "@/lib/demo/session";
import { env, isSupabaseConfigured } from "@/lib/env";

export interface DemoActionState {
  ok: boolean;
  error?: string;
}

const NOT_CONFIGURED = "O Supabase ainda não está configurado neste ambiente.";

/** Só o slug vem do formulário — e mesmo ele é conferido contra a lista fixa de personas. */
const personaField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z]+$/);

/**
 * Entra como uma pessoa fictícia (/demo). Confere de novo tudo no servidor: o modo
 * demonstração ligado e a persona na lista fixa (admin e moderação nunca estão nela).
 */
export async function enterDemoPersona(
  _prev: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  if (!env.demoMode) return { ok: false, error: DEMO_OFF };

  const parsed = personaField.safeParse(formData.get("persona"));
  const persona = parsed.success ? getPersona(parsed.data) : null;
  if (!persona) return { ok: false, error: DEMO_UNKNOWN_PERSONA };
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const result = await openDemoSession(persona);
  if (!result.ok) return { ok: false, error: result.error };

  // A sessão mudou: o cabeçalho e o aviso de demonstração precisam ser renderizados de novo.
  revalidatePath("/", "layout");
  redirect(persona.start);
}
