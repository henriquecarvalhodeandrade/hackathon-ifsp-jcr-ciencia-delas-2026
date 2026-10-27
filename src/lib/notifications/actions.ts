"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, SESSION_EXPIRED, type ActionState } from "@/lib/admin/action-state";
import { friendlyDbError } from "@/lib/admin/errors";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions das notificações. O RLS garante que cada pessoa só altera as
 * próprias linhas (e só a coluna `read_at`); mesmo assim, toda action confere a
 * sessão e filtra por `user_id` da sessão — nunca por um id vindo do formulário.
 */

const idSchema = z.uuid({ error: "Notificação inválida." });

/** O sino do cabeçalho (layout raiz) também mostra a contagem: revalida tudo. */
function revalidateNotifications() {
  revalidatePath("/", "layout");
}

export async function markNotificationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return actionError(SESSION_EXPIRED);

  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return actionError("Notificação inválida. Recarregue a página e tente de novo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return actionError(friendlyDbError(error, "Não conseguimos marcar como lida. Tente de novo."));

  revalidateNotifications();
  return { ok: true, message: "Notificação marcada como lida." };
}

export async function markAllNotificationsRead(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return actionError(SESSION_EXPIRED);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return actionError(friendlyDbError(error, "Não conseguimos marcar as notificações como lidas."));

  revalidateNotifications();
  return {
    ok: true,
    message: count ? "Pronto! Todas as notificações foram marcadas como lidas." : "Você já estava em dia.",
  };
}

export async function deleteReadNotifications(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return actionError(SESSION_EXPIRED);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .not("read_at", "is", null);
  if (error) return actionError(friendlyDbError(error, "Não conseguimos apagar as notificações lidas."));

  revalidateNotifications();
  return {
    ok: true,
    message: count ? `${count === 1 ? "1 notificação lida apagada" : `${count} notificações lidas apagadas`}.` : "Não havia notificações lidas para apagar.",
  };
}
