"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAiEnabled } from "@/lib/ai";
import { generatePlainSummary } from "@/lib/ai/tasks";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CrossrefPaperData } from "./crossref";
import { isValidDoi, normalizeDoi } from "./doi";
import { friendlyDbError } from "./errors";
import { PAPER_LIMITS } from "./limits";
import { fetchCrossrefWork } from "./lookup";
import { isUuid } from "./params";
import { getResearchAreas } from "./queries";
import {
  commentSchema,
  filledByCrossref,
  readPaperForm,
  validatePaperForm,
  type PaperFieldErrors,
  type PaperFormValues,
} from "./schema";

/**
 * Server Actions da Vitrine. Toda action confere a sessão aqui dentro (o proxy é só uma
 * checagem otimista) e grava com o cliente da usuária — quem autoriza de verdade é o RLS.
 * Nunca aceitamos ids de usuária vindos do cliente: as colunas de dona usam auth.uid().
 */

function revalidateVitrine(paperId?: string) {
  revalidatePath("/papers", "layout");
  if (paperId) revalidatePath(`/papers/${paperId}`);
  revalidatePath("/ranking");
  revalidatePath("/");
}

const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo na sua conta para continuar.";

// ---------------------------------------------------------------------------
// Destaques (votos)
// ---------------------------------------------------------------------------

export type VoteResult =
  | { ok: true; voted: boolean; voteCount: number }
  | { ok: false; error: string; needsLogin?: boolean };

/**
 * Liga/desliga o destaque da usuária num paper. Recebe o estado desejado (idempotente:
 * cliques repetidos ou fora de ordem não invertem o resultado).
 */
export async function toggleVote(paperId: string, voted: boolean): Promise<VoteResult> {
  if (!isUuid(paperId) || typeof voted !== "boolean")
    return { ok: false, error: "Paper inválido." };
  const user = await getCurrentUser();
  if (!user)
    return { ok: false, needsLogin: true, error: "Entre na sua conta para destacar papers." };

  const supabase = await createClient();
  if (voted) {
    const { error } = await supabase.from("paper_votes").insert({ paper_id: paperId });
    if (error && error.code !== "23505")
      return { ok: false, error: friendlyDbError(error, "vote") };
  } else {
    const { error } = await supabase
      .from("paper_votes")
      .delete()
      .eq("paper_id", paperId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error, "vote") };
  }

  const { data } = await supabase
    .from("papers")
    .select("vote_count")
    .eq("id", paperId)
    .maybeSingle();
  revalidateVitrine(paperId);
  return { ok: true, voted, voteCount: data?.vote_count ?? 0 };
}

// ---------------------------------------------------------------------------
// Enviar / editar paper
// ---------------------------------------------------------------------------

export type PaperFormState = {
  ok: false;
  error: string;
  fieldErrors?: PaperFieldErrors;
  values: PaperFormValues;
} | null;

export async function savePaper(
  _prev: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const values = readPaperForm(formData);
  const rawId = formData.get("paper_id");
  const editingId = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (editingId && !isUuid(editingId)) return { ok: false, error: "Paper inválido.", values };

  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: SESSION_EXPIRED, values };
  if (!profile.onboarded_at) {
    return { ok: false, error: "Complete seu perfil antes de divulgar papers na Vitrine.", values };
  }

  const result = validatePaperForm(values);
  if (!result.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo de cada um.",
      fieldErrors: result.fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  let paperId: string;

  if (editingId) {
    const { data, error } = await supabase
      .from("papers")
      .update(result.data)
      .eq("id", editingId)
      .eq("submitted_by", profile.id)
      .select("id")
      .maybeSingle();
    if (error) return saveError(error, values);
    if (!data)
      return { ok: false, error: "Você só pode editar papers que você mesma enviou.", values };
    paperId = data.id;
  } else {
    const { data, error } = await supabase.from("papers").insert(result.data).select("id").single();
    if (error) return saveError(error, values);
    paperId = data.id;
  }

  revalidateVitrine(paperId);
  redirect(`/papers/${paperId}?${editingId ? "atualizado" : "enviado"}=1`);
}

function saveError(
  error: { code?: string; message?: string; details?: string },
  values: PaperFormValues,
) {
  const message = friendlyDbError(error, "save");
  const fieldErrors: PaperFieldErrors | undefined =
    error.code === "23505" && /doi/i.test(`${error.message} ${error.details}`)
      ? { doi: [message] }
      : error.code === "23503"
        ? { area_id: [message] }
        : undefined;
  return { ok: false as const, error: message, fieldErrors, values };
}

// ---------------------------------------------------------------------------
// Buscar dados pelo DOI (Crossref)
// ---------------------------------------------------------------------------

export type DoiLookupResult =
  | { ok: true; data: CrossrefPaperData; message: string }
  | { ok: false; error: string; existingPaperId?: string };

export async function lookupDoi(
  doiInput: string,
  currentPaperId?: string | null,
): Promise<DoiLookupResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };

  const doi = normalizeDoi(typeof doiInput === "string" ? doiInput : "");
  if (!doi) return { ok: false, error: "Digite o DOI do paper, como 10.1590/s0100-123." };
  if (!isValidDoi(doi)) {
    return {
      ok: false,
      error:
        "Esse DOI não parece válido. Ele começa com 10. e tem uma barra, como 10.1590/s0100-123.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("papers")
    .select("id")
    .eq("doi", doi)
    .maybeSingle();
  if (existing && existing.id !== currentPaperId) {
    return {
      ok: false,
      error: "Este paper já está na Vitrine. Que tal destacá-lo ou deixar um comentário?",
      existingPaperId: existing.id,
    };
  }

  const lookup = await fetchCrossrefWork(doi);
  if (!lookup.ok) {
    const errors = {
      not_found:
        "Não encontramos esse DOI no Crossref. Confira o número ou preencha os campos à mão — DOIs do DataCite (como os do Zenodo) não aparecem aqui.",
      unavailable:
        "O Crossref não respondeu agora. Tente de novo em instantes ou preencha os campos à mão.",
      invalid_response:
        "O Crossref respondeu num formato inesperado. Preencha os campos à mão, por favor.",
    } as const;
    return { ok: false, error: errors[lookup.reason] };
  }

  const filled = filledByCrossref(lookup.data);
  const message =
    filled.length > 0
      ? `Encontramos o paper no Crossref e preenchemos: ${filled.join(", ")}. Revise tudo antes de publicar${
          lookup.data.abstract ? "" : " — o resumo não veio, cole o abstract à mão"
        }.`
      : "O Crossref reconheceu o DOI, mas não trouxe título nem autoras. Preencha os campos à mão.";
  return { ok: true, data: lookup.data, message };
}

// ---------------------------------------------------------------------------
// Resumo acessível com IA
// ---------------------------------------------------------------------------

export type SummaryResult = { ok: true; summary: string } | { ok: false; error: string };

const summaryInput = z.object({
  title: z.string().trim().min(PAPER_LIMITS.titleMin).max(PAPER_LIMITS.titleMax),
  abstract: z.string().trim().min(PAPER_LIMITS.abstractMin).max(PAPER_LIMITS.abstractMax),
  areaId: z.string().trim(),
});

/** Proteção simples de cota: uma geração a cada 15 s por pessoa (melhor esforço, por instância). */
const SUMMARY_COOLDOWN_MS = 15_000;
const lastSummaryAt = new Map<string, number>();

function cooldownFor(userId: string): boolean {
  const now = Date.now();
  const last = lastSummaryAt.get(userId) ?? 0;
  if (now - last < SUMMARY_COOLDOWN_MS) return true;
  lastSummaryAt.set(userId, now);
  if (lastSummaryAt.size > 5000) lastSummaryAt.clear();
  return false;
}

const AI_FAILED =
  "A IA não conseguiu gerar o resumo agora. Tente de novo em instantes ou escreva o resumo com suas palavras.";

async function areaNameFor(areaId: string | number | null): Promise<string | null> {
  if (areaId === null || areaId === "") return null;
  const areas = await getResearchAreas();
  return areas.find((a) => a.id === Number(areaId))?.name ?? null;
}

/** Gera um rascunho de resumo acessível para o formulário (não grava nada). */
export async function generateSummary(input: {
  title: string;
  abstract: string;
  areaId: string;
}): Promise<SummaryResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };
  if (!isAiEnabled())
    return { ok: false, error: "A geração com IA não está configurada neste ambiente." };

  const parsed = summaryInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Preencha o título e o resumo (abstract, com pelo menos 50 caracteres) antes de gerar.",
    };
  }
  if (cooldownFor(user.id))
    return { ok: false, error: "Aguarde alguns segundos antes de gerar de novo." };

  const summary = await generatePlainSummary({
    title: parsed.data.title,
    abstract: parsed.data.abstract,
    area: await areaNameFor(parsed.data.areaId),
  });
  return summary ? { ok: true, summary } : { ok: false, error: AI_FAILED };
}

export type RegenerateState = { ok: true; message: string } | { ok: false; error: string } | null;

/** Quem enviou o paper pede um novo resumo acessível com IA (grava direto, marcado como IA). */
export async function regenerateSummary(
  _prev: RegenerateState,
  formData: FormData,
): Promise<RegenerateState> {
  const paperId = String(formData.get("paper_id") ?? "");
  if (!isUuid(paperId)) return { ok: false, error: "Paper inválido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };
  if (!isAiEnabled())
    return { ok: false, error: "A geração com IA não está configurada neste ambiente." };

  const supabase = await createClient();
  const { data: paper } = await supabase
    .from("papers")
    .select("id, title, abstract, area_id, submitted_by")
    .eq("id", paperId)
    .maybeSingle();
  if (!paper || paper.submitted_by !== user.id) {
    return { ok: false, error: "Só quem enviou o paper pode gerar um novo resumo." };
  }
  if (cooldownFor(user.id))
    return { ok: false, error: "Aguarde alguns segundos antes de gerar de novo." };

  const summary = await generatePlainSummary({
    title: paper.title,
    abstract: paper.abstract,
    area: await areaNameFor(paper.area_id),
  });
  if (!summary) return { ok: false, error: AI_FAILED };

  const { error } = await supabase
    .from("papers")
    .update({ plain_summary: summary, plain_summary_source: "ai" })
    .eq("id", paperId)
    .eq("submitted_by", user.id);
  if (error) return { ok: false, error: friendlyDbError(error, "save") };

  revalidateVitrine(paperId);
  return {
    ok: true,
    message: "Pronto! O novo resumo acessível já aparece na página. Revise e edite se precisar.",
  };
}

// ---------------------------------------------------------------------------
// Excluir paper
// ---------------------------------------------------------------------------

/** Falha de exclusão: o ConfirmDialog continua aberto e mostra a mensagem. */
export type DeleteResult = { ok: false; error: string };

/** Quem enviou (ou a moderação, pelo RLS) exclui o paper. Sucesso → redireciona para a Vitrine. */
export async function deletePaper(formData: FormData): Promise<DeleteResult> {
  const paperId = String(formData.get("id") ?? "");
  if (!isUuid(paperId)) return { ok: false, error: "Paper inválido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase.from("papers").delete().eq("id", paperId).select("id");
  if (error) {
    console.error("[papers] falha ao excluir paper", error.code, error.message);
    return { ok: false, error: friendlyDbError(error, "delete") };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Só quem enviou o paper (ou a moderação) pode excluí-lo." };
  }

  revalidateVitrine();
  redirect("/papers?removido=1");
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export type CommentState =
  | { ok: true; message: string; values: { body: string } }
  | { ok: false; error: string; fieldErrors?: { body?: string[] }; values: { body: string } }
  | null;

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const values = { body: String(formData.get("body") ?? "") };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: SESSION_EXPIRED, values };
  if (!profile.onboarded_at)
    return { ok: false, error: "Complete seu perfil para participar da conversa.", values };

  const parsed = commentSchema.safeParse({ paper_id: formData.get("paper_id"), body: values.body });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      error: fieldErrors.paper_id ? "Paper inválido." : "Confira o comentário antes de publicar.",
      fieldErrors: { body: fieldErrors.body },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("paper_comments").insert(parsed.data);
  if (error) return { ok: false, error: friendlyDbError(error, "comment"), values };

  revalidatePath(`/papers/${parsed.data.paper_id}`);
  revalidatePath("/papers");
  return {
    ok: true,
    message: "Comentário publicado. Obrigada por participar!",
    values: { body: "" },
  };
}

/**
 * A autora do comentário (ou a moderação, pelo RLS) apaga o comentário. Sem linha apagada
 * (RLS recusou ou o comentário já sumiu) devolve erro, para o diálogo não fechar em silêncio.
 */
export async function deleteComment(formData: FormData): Promise<DeleteResult | { ok: true }> {
  const commentId = String(formData.get("id") ?? "");
  const paperId = String(formData.get("paper_id") ?? "");
  if (!isUuid(commentId) || !isUuid(paperId)) return { ok: false, error: "Comentário inválido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paper_comments")
    .delete()
    .eq("id", commentId)
    .eq("paper_id", paperId)
    .select("id");
  if (error) {
    console.error("[papers] falha ao excluir comentário", error.code, error.message);
    return { ok: false, error: friendlyDbError(error, "delete") };
  }

  revalidatePath(`/papers/${paperId}`);
  revalidatePath("/papers");
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Não conseguimos excluir: o comentário já foi removido ou não é seu.",
    };
  }
  return { ok: true };
}
