import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Profile = Tables<"profiles">;

function loginUrl(next?: string) {
  return next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar";
}

/**
 * Usuária autenticada da requisição atual (ou null).
 * Usa getUser() — valida o token no servidor de Auth — e é memoizado por requisição.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Perfil da usuária autenticada (ou null). Memoizado por requisição. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ?? null;
});

/** Exige sessão; caso contrário redireciona para /entrar?next=... */
export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(next));
  return user;
}

/**
 * Exige sessão E onboarding concluído (perfil preenchido).
 * Quem ainda não completou o perfil é enviada para /onboarding.
 */
export async function requireOnboardedProfile(next?: string): Promise<Profile> {
  await requireUser(next);
  const profile = await getCurrentProfile();
  if (!profile || !profile.onboarded_at) {
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }
  return profile;
}

/** Exige papel de moderadora ou admin; para as demais, a rota "não existe". */
export async function requireModerator(): Promise<Profile> {
  const profile = await requireOnboardedProfile("/admin");
  if (profile.role !== "moderator" && profile.role !== "admin") notFound();
  return profile;
}

export function isModerator(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return profile?.role === "moderator" || profile?.role === "admin";
}
