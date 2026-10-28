"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// ─── followUser ─────────────────────────────────────────────────────────────

const followSchema = z.object({
  targetUserId: z.string().uuid(),
});

export async function followUser(targetUserId: string): Promise<ActionResult> {
  const parsed = followSchema.safeParse({ targetUserId });
  if (!parsed.success) return { ok: false, error: "ID de usuário inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };
  if (user.id === targetUserId) return { ok: false, error: "Você não pode seguir a si mesmo." };

  // Busca username do target para revalidatePath
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) return { ok: false, error: "Usuário não encontrado." };

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetUserId });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já segue este usuário." };
    return { ok: false, error: "Erro ao seguir usuário." };
  }

  revalidatePath(`/profile/${targetProfile.username}`);
  revalidatePath("/network");
  return { ok: true };
}

// ─── unfollowUser ────────────────────────────────────────────────────────────

export async function unfollowUser(targetUserId: string): Promise<ActionResult> {
  const parsed = followSchema.safeParse({ targetUserId });
  if (!parsed.success) return { ok: false, error: "ID de usuário inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) return { ok: false, error: "Usuário não encontrado." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);

  if (error) return { ok: false, error: "Erro ao deixar de seguir." };

  revalidatePath(`/profile/${targetProfile.username}`);
  revalidatePath("/network");
  return { ok: true };
}

// ─── sendConnectionRequest ───────────────────────────────────────────────────

const connectionSchema = z.object({
  targetUserId: z.string().uuid(),
});

export async function sendConnectionRequest(targetUserId: string): Promise<ActionResult> {
  const parsed = connectionSchema.safeParse({ targetUserId });
  if (!parsed.success) return { ok: false, error: "ID de usuário inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };
  if (user.id === targetUserId)
    return { ok: false, error: "Você não pode se conectar a si mesmo." };

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) return { ok: false, error: "Usuário não encontrado." };

  // Verifica se já existe uma conexão (qualquer status) entre os dois
  const { data: existing } = await supabase
    .from("connections")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { ok: false, error: "Vocês já estão conectados." };
    if (existing.status === "pending") return { ok: false, error: "Solicitação já enviada ou pendente." };
    // Se rejected, permite reenviar — deleta a antiga primeiro
    const { error: deleteError } = await supabase
      .from("connections")
      .delete()
      .eq("id", existing.id);
    if (deleteError) return { ok: false, error: "Erro ao reenviar solicitação." };
  }

  const { error } = await supabase
    .from("connections")
    .insert({ requester_id: user.id, addressee_id: targetUserId, status: "pending" });

  if (error) return { ok: false, error: "Erro ao enviar solicitação de conexão." };

  revalidatePath(`/profile/${targetProfile.username}`);
  revalidatePath("/network");
  revalidatePath("/", "layout"); // atualiza o pin de convites na Navbar
  return { ok: true };
}

// ─── respondConnectionRequest ────────────────────────────────────────────────

const respondSchema = z.object({
  connectionId: z.string().uuid(),
  accept: z.boolean(),
});

export async function respondConnectionRequest(
  connectionId: string,
  accept: boolean
): Promise<ActionResult> {
  const parsed = respondSchema.safeParse({ connectionId, accept });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  // Busca a conexão e verifica que o usuário atual é o addressee
  const { data: connection } = await supabase
    .from("connections")
    .select("id, addressee_id, status")
    .eq("id", connectionId)
    .single();

  if (!connection) return { ok: false, error: "Solicitação não encontrada." };
  if (connection.addressee_id !== user.id)
    return { ok: false, error: "Você não tem permissão para responder esta solicitação." };
  if (connection.status !== "pending")
    return { ok: false, error: "Esta solicitação já foi respondida." };

  const newStatus = accept ? "accepted" : "rejected";

  const { error } = await supabase
    .from("connections")
    .update({ status: newStatus })
    .eq("id", connectionId);

  if (error) return { ok: false, error: "Erro ao responder solicitação." };

  revalidatePath("/network");
  revalidatePath("/", "layout"); // atualiza o pin de convites na Navbar
  return { ok: true };
}
