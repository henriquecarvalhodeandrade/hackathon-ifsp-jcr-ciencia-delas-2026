"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

// ─── createProject ───────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  title: z.string().trim().min(5, "Título deve ter pelo menos 5 caracteres").max(140),
  description: z
    .string()
    .trim()
    .min(20, "Descrição deve ter pelo menos 20 caracteres")
    .max(3000, "Descrição muito longa (máx. 3000 caracteres)"),
  area: z.string().trim().min(2, "Informe a área de atuação").max(80),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10, "Máximo de 10 tags")
    .default([]),
  slots: z.coerce.number().int().min(1, "Mínimo de 1 vaga").max(20, "Máximo de 20 vagas"),
  is_open: z.boolean(),
});

export type CreateProjectInput = {
  title: string;
  description: string;
  area: string;
  tags: string[];
  slots: number;
  is_open: boolean;
};

export async function createProject(input: CreateProjectInput): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  // Regra de negócio: só contas Cientista publicam IC.
  // Reforçada no RLS pela migration 005 (validação em dois lugares).
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (profile?.account_type !== "scientist") {
    return {
      ok: false,
      error: "Apenas contas Cientista podem publicar projetos de Iniciação Científica.",
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      creator_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      area: parsed.data.area,
      tags: parsed.data.tags,
      slots: parsed.data.slots,
      is_open: parsed.data.is_open,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar projeto:", error);
    return { ok: false, error: "Erro ao criar o projeto. Tente novamente." };
  }

  revalidatePath("/explore");
  return { ok: true, id: data.id };
}

// ─── requestInterest ─────────────────────────────────────────────────────────

const projectIdSchema = z.object({ projectId: z.string().uuid() });

export async function requestInterest(projectId: string): Promise<ActionResult> {
  const parsed = projectIdSchema.safeParse({ projectId });
  if (!parsed.success) return { ok: false, error: "Projeto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id, is_open")
    .eq("id", projectId)
    .single();

  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (project.creator_id === user.id)
    return { ok: false, error: "Este projeto é seu — não é possível solicitar interesse." };
  if (!project.is_open)
    return { ok: false, error: "Este projeto não está com vagas abertas." };

  // Já existe algum registro (pending/accepted/rejected)?
  const { data: existing } = await supabase
    .from("project_interests")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { ok: false, error: "Você já participa deste projeto." };
    if (existing.status === "pending") return { ok: false, error: "Solicitação já enviada." };
    // rejected — permite reenviar: remove o registro antigo
    const { error: deleteError } = await supabase
      .from("project_interests")
      .delete()
      .eq("id", existing.id);
    if (deleteError) return { ok: false, error: "Erro ao reenviar solicitação." };
  }

  const { error } = await supabase.from("project_interests").insert({
    project_id: projectId,
    user_id: user.id,
    origin: "user_request",
    status: "pending",
  });

  if (error) {
    console.error("Erro ao solicitar interesse:", error);
    return { ok: false, error: "Erro ao enviar solicitação de interesse." };
  }

  revalidatePath(`/explore/${projectId}`);
  return { ok: true };
}

// ─── respondInterest (criador aceita/recusa pedido de user_request) ───────────

const respondInterestSchema = z.object({
  interestId: z.string().uuid(),
  accept: z.boolean(),
});

export async function respondInterest(
  interestId: string,
  accept: boolean
): Promise<ActionResult> {
  const parsed = respondInterestSchema.safeParse({ interestId, accept });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: interest } = await supabase
    .from("project_interests")
    .select("id, project_id, origin, status")
    .eq("id", interestId)
    .maybeSingle();

  if (!interest) return { ok: false, error: "Solicitação não encontrada." };
  if (interest.origin !== "user_request")
    return { ok: false, error: "Esta é uma solicitação de convite (respondida pelo convidado)." };
  if (interest.status !== "pending")
    return { ok: false, error: "Esta solicitação já foi respondida." };

  // Permissão: só o criador do projeto (revalida também no RLS)
  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id, slots, is_open")
    .eq("id", interest.project_id)
    .single();

  if (!project || project.creator_id !== user.id)
    return { ok: false, error: "Apenas a pessoa criadora do projeto pode responder." };

  if (accept) {
    const { count } = await supabase
      .from("project_interests")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("status", "accepted");

    if ((count ?? 0) >= project.slots)
      return { ok: false, error: "Todas as vagas já foram preenchidas." };
  }

  const { error } = await supabase
    .from("project_interests")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", interestId);

  if (error) {
    console.error("Erro ao responder interesse:", error);
    return { ok: false, error: "Erro ao responder a solicitação." };
  }

  // Fecha o projeto automaticamente quando as vagas acabam
  if (accept) {
    const { count } = await supabase
      .from("project_interests")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("status", "accepted");

    if ((count ?? 0) >= project.slots && project.is_open) {
      await supabase.from("projects").update({ is_open: false }).eq("id", project.id);
    }
  }

  revalidatePath(`/explore/${project.id}`);
  revalidatePath("/explore");
  return { ok: true };
}

// ─── inviteUser (criador convida usuário) ────────────────────────────────────

const inviteUserSchema = z.object({
  projectId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

export async function inviteUser(
  projectId: string,
  targetUserId: string
): Promise<ActionResult> {
  const parsed = inviteUserSchema.safeParse({ projectId, targetUserId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id")
    .eq("id", projectId)
    .single();

  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (project.creator_id !== user.id)
    return { ok: false, error: "Apenas a pessoa criadora pode convidar." };
  if (targetUserId === user.id)
    return { ok: false, error: "Você não pode convidar a si mesmo." };

  const { data: existing } = await supabase
    .from("project_interests")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted")
      return { ok: false, error: "Esta pessoa já participa do projeto." };
    if (existing.status === "pending")
      return { ok: false, error: "Já existe um pedido ou convite pendente." };
    const { error: deleteError } = await supabase
      .from("project_interests")
      .delete()
      .eq("id", existing.id);
    if (deleteError) return { ok: false, error: "Erro ao reenviar convite." };
  }

  const { error } = await supabase.from("project_interests").insert({
    project_id: projectId,
    user_id: targetUserId,
    origin: "creator_invite",
    status: "pending",
  });

  if (error) {
    console.error("Erro ao convidar:", error);
    return { ok: false, error: "Erro ao enviar convite." };
  }

  revalidatePath(`/explore/${projectId}`);
  return { ok: true };
}

// ─── respondInvite (convidado aceita/recusa convite) ─────────────────────────

export async function respondInvite(
  interestId: string,
  accept: boolean
): Promise<ActionResult> {
  const parsed = respondInterestSchema.safeParse({ interestId, accept });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: interest } = await supabase
    .from("project_interests")
    .select("id, project_id, user_id, origin, status")
    .eq("id", interestId)
    .maybeSingle();

  if (!interest) return { ok: false, error: "Convite não encontrado." };
  if (interest.user_id !== user.id)
    return { ok: false, error: "Este convite não é para você." };
  if (interest.origin !== "creator_invite")
    return { ok: false, error: "Este registro não é um convite." };
  if (interest.status !== "pending")
    return { ok: false, error: "Este convite já foi respondido." };

  if (accept) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, slots, is_open")
      .eq("id", interest.project_id)
      .single();

    if (project) {
      const { count } = await supabase
        .from("project_interests")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "accepted");

      if ((count ?? 0) >= project.slots)
        return { ok: false, error: "As vagas deste projeto já foram preenchidas." };

      const { error } = await supabase
        .from("project_interests")
        .update({ status: "accepted" })
        .eq("id", interestId);

      if (error) return { ok: false, error: "Erro ao aceitar o convite." };

      if ((count ?? 0) + 1 >= project.slots && project.is_open) {
        await supabase.from("projects").update({ is_open: false }).eq("id", project.id);
      }

      revalidatePath(`/explore/${project.id}`);
      revalidatePath("/explore");
      return { ok: true };
    }
  }

  const { error } = await supabase
    .from("project_interests")
    .update({ status: "rejected" })
    .eq("id", interestId);

  if (error) return { ok: false, error: "Erro ao recusar o convite." };

  revalidatePath(`/explore/${interest.project_id}`);
  return { ok: true };
}

// ─── searchUsers (usado pelo InviteUserDialog) ───────────────────────────────

export type SearchUserResult = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_self_declared_woman: boolean;
};

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const q = query.trim().slice(0, 30);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Remove curingas do ilike para evitar erro/abuso de filtro
  const clean = q.replace(/[%_,()]/g, "");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_self_declared_woman")
    .or(`username.ilike.%${clean}%,full_name.ilike.%${clean}%`)
    .neq("id", user.id)
    .limit(8);

  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }

  return data ?? [];
}

// ─── updateProject (criador edita a IC) ──────────────────────────────────────

export async function updateProject(
  projectId: string,
  input: CreateProjectInput
): Promise<ActionResult> {
  const idParsed = projectIdSchema.safeParse({ projectId });
  if (!idParsed.success) return { ok: false, error: "Projeto inválido." };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id")
    .eq("id", projectId)
    .single();

  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (project.creator_id !== user.id)
    return { ok: false, error: "Apenas a pessoa criadora pode editar o projeto." };

  const { error } = await supabase
    .from("projects")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      area: parsed.data.area,
      tags: parsed.data.tags,
      slots: parsed.data.slots,
      is_open: parsed.data.is_open,
    })
    .eq("id", projectId);

  if (error) {
    console.error("Erro ao editar projeto:", error);
    return { ok: false, error: "Erro ao salvar as alterações." };
  }

  revalidatePath(`/explore/${projectId}`);
  revalidatePath("/explore");
  return { ok: true, id: projectId };
}

// ─── deleteProject (criador exclui a IC) ─────────────────────────────────────

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const parsed = projectIdSchema.safeParse({ projectId });
  if (!parsed.success) return { ok: false, error: "Projeto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id")
    .eq("id", projectId)
    .single();

  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (project.creator_id !== user.id)
    return { ok: false, error: "Apenas a pessoa criadora pode excluir o projeto." };

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    console.error("Erro ao excluir projeto:", error);
    return { ok: false, error: "Erro ao excluir o projeto." };
  }

  revalidatePath("/explore");
  return { ok: true };
}

// ─── removeParticipant (criador remove participante aceito) ───────────────────

export async function removeParticipant(interestId: string): Promise<ActionResult> {
  const parsed = respondInterestSchema.pick({ interestId: true }).safeParse({
    interestId,
  });
  if (!parsed.success) return { ok: false, error: "Registro inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: interest } = await supabase
    .from("project_interests")
    .select("id, project_id, status")
    .eq("id", interestId)
    .maybeSingle();

  if (!interest) return { ok: false, error: "Participante não encontrado." };
  if (interest.status !== "accepted")
    return { ok: false, error: "Esta pessoa não é uma participante aceita." };

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id")
    .eq("id", interest.project_id)
    .single();

  if (!project || project.creator_id !== user.id)
    return { ok: false, error: "Apenas a pessoa criadora pode remover participantes." };

  const { error } = await supabase
    .from("project_interests")
    .delete()
    .eq("id", interestId);

  if (error) {
    console.error("Erro ao remover participante:", error);
    return { ok: false, error: "Erro ao remover a participante." };
  }

  revalidatePath(`/explore/${project.id}`);
  return { ok: true };
}
