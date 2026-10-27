import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { env, isAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET, ownAvatarFileName } from "./avatar";
import { dbErrorMessage } from "./errors";
import { NOT_CONFIGURED_ERROR, SESSION_EXPIRED_ERROR } from "./save";

/**
 * Avatar e exclusão de conta (somente servidor).
 * O upload da foto acontece no navegador (Storage + RLS da própria pasta); aqui só
 * validamos a URL resultante, gravamos no perfil e limpamos fotos antigas.
 */

export type AvatarOutcome = { ok: true; avatarUrl: string | null } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Apaga da pasta da usuária todos os arquivos, exceto `keep` (melhor esforço). */
async function cleanupAvatarFolder(supabase: ServerClient, userId: string, keep: string | null): Promise<void> {
  try {
    const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
    const stale = (data ?? []).map((file) => file.name).filter((name) => name && name !== keep);
    if (stale.length > 0) {
      await supabase.storage.from(AVATAR_BUCKET).remove(stale.map((name) => `${userId}/${name}`));
    }
  } catch {
    // Arquivos órfãos não atrapalham ninguém; o próximo envio tenta de novo.
  }
}

export async function setAvatarForCurrentUser(publicUrl: unknown): Promise<AvatarOutcome> {
  if (!isSupabaseConfigured() || !env.supabaseUrl) return { ok: false, error: NOT_CONFIGURED_ERROR };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const url = typeof publicUrl === "string" ? publicUrl.trim() : "";
  const fileName = ownAvatarFileName(url, env.supabaseUrl, user.id);
  if (!fileName) return { ok: false, error: "Não reconhecemos esse arquivo. Envie a foto de novo, por favor." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  await cleanupAvatarFolder(supabase, user.id, fileName);
  return { ok: true, avatarUrl: url };
}

export async function removeAvatarForCurrentUser(): Promise<AvatarOutcome> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  await cleanupAvatarFolder(supabase, user.id, null);
  return { ok: true, avatarUrl: null };
}

/** Exclusão pelo próprio app só é possível com a chave secreta configurada no servidor. */
export function canSelfDeleteAccount(): boolean {
  return isAdminConfigured();
}

export const DELETE_CONFIRMATION_WORD = "EXCLUIR";

export type DeleteAccountOutcome = { ok: true } | { ok: false; error: string };

/**
 * Exclui definitivamente a conta da usuária logada (LGPD, art. 18): apaga as fotos e o
 * usuário do Auth — o banco remove em cascata perfil, áreas, mentorias, tópicos e respostas
 * (inclusive anônimos), papers, votos, comentários e notificações.
 */
export async function deleteCurrentUserAccount(confirmation: unknown): Promise<DeleteAccountOutcome> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const typed = typeof confirmation === "string" ? confirmation.trim().toLocaleUpperCase("pt-BR") : "";
  if (typed !== DELETE_CONFIRMATION_WORD) {
    return { ok: false, error: `Para confirmar, digite ${DELETE_CONFIRMATION_WORD} no campo.` };
  }
  if (!canSelfDeleteAccount()) {
    return {
      ok: false,
      error: "A exclusão automática não está disponível neste ambiente. Escreva para a equipe (veja a página de Privacidade).",
    };
  }

  const admin = createAdminClient();
  try {
    const { data: files } = await admin.storage.from(AVATAR_BUCKET).list(user.id, { limit: 100 });
    const paths = (files ?? []).map((file) => `${user.id}/${file.name}`);
    if (paths.length > 0) await admin.storage.from(AVATAR_BUCKET).remove(paths);
  } catch {
    // Seguimos com a exclusão mesmo se a limpeza das fotos falhar.
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.warn(`[perfil] falha ao excluir conta (${error.status ?? ""} ${error.code ?? ""})`);
    return { ok: false, error: "Não conseguimos excluir sua conta agora. Tente de novo em alguns minutos." };
  }
  return { ok: true };
}
