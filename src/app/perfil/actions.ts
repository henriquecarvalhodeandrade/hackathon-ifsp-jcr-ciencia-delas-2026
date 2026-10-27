"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { refreshMyEmbedding } from "@/lib/matching/service";
import { deleteCurrentUserAccount, removeAvatarForCurrentUser, setAvatarForCurrentUser } from "@/lib/profile/account";
import { isProfileSection } from "@/lib/profile/form-values";
import { saveSectionForCurrentUser, sectionSavedMessage } from "@/lib/profile/save";
import type { AvatarActionResult, DeleteAccountState, ProfileActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

/** Salva uma seção do /perfil (campo oculto `section`). */
export async function saveProfileSectionAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const section = formData.get("section");
  if (!isProfileSection(section)) {
    return { ok: false, section: "sobre", error: "Seção desconhecida. Recarregue a página, por favor.", values: {} };
  }

  const outcome = await saveSectionForCurrentUser(section, formData);
  if (!outcome.ok) {
    return { ok: false, section, error: outcome.error, fieldErrors: outcome.fieldErrors, values: outcome.values };
  }

  after(async () => {
    await refreshMyEmbedding();
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    section,
    message: sectionSavedMessage(section, outcome.values, outcome.consentRevoked),
    values: outcome.values,
  };
}

/** Grava no perfil a URL pública da foto que o navegador acabou de enviar ao Storage. */
export async function saveAvatarAction(publicUrl: string): Promise<AvatarActionResult> {
  const outcome = await setAvatarForCurrentUser(publicUrl);
  if (!outcome.ok) return outcome;
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto atualizada.", avatarUrl: outcome.avatarUrl };
}

export async function removeAvatarAction(): Promise<AvatarActionResult> {
  const outcome = await removeAvatarForCurrentUser();
  if (!outcome.ok) return outcome;
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto removida. Suas iniciais aparecem no lugar.", avatarUrl: null };
}

/** Exclui a conta (exige digitar EXCLUIR), encerra a sessão e volta para /entrar. */
export async function deleteAccountAction(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const outcome = await deleteCurrentUserAccount(formData.get("confirmation"));
  if (!outcome.ok) return { ok: false, error: outcome.error };

  // O usuário já não existe: limpamos a sessão local (o signOut remove os cookies mesmo se a API recusar).
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // segue para a limpeza manual
  }
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (cookie.name.startsWith("sb-")) store.delete(cookie.name);
  }

  revalidatePath("/", "layout");
  redirect("/entrar?conta=excluida");
}
