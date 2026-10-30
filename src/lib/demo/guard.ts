import "server-only";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { isDemoEmail } from "./personas";

/**
 * Travas do modo demonstração (docs/14). Várias pessoas da banca usam as MESMAS contas
 * fictícias ao mesmo tempo: nada que uma delas faça pode tirar a conta das outras.
 */

export const DEMO_OFF = "O modo demonstração está desligado neste ambiente.";
export const DEMO_UNKNOWN_PERSONA =
  "Não conhecemos essa pessoa de demonstração. Escolha uma das pessoas desta página.";

export const DEMO_DELETE_REFUSED =
  "Contas de demonstração não podem ser excluídas. Elas voltam ao normal quando a equipe reinicia os dados.";

export const DEMO_PASSWORD_REFUSED =
  "Contas de demonstração não trocam de senha: várias pessoas usam a mesma conta durante a apresentação.";

/** A conta logada é fictícia E o modo demonstração está ligado? */
export function isProtectedDemoAccount(email: string | null | undefined): boolean {
  return env.demoMode && isDemoEmail(email);
}

/** Rotas do modo demonstração: com DEMO_MODE desligado, elas simplesmente não existem (404). */
export function requireDemoMode(): void {
  if (!env.demoMode) notFound();
}
