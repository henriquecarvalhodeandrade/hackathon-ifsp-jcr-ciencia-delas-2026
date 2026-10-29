"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { friendlyPortfolioError } from "./errors";
import { portfolioPostBody, postKindForPortfolio, type PortfolioNoticeKey } from "./presentation";
import {
  readPortfolioForm,
  toPortfolioRow,
  validatePortfolioForm,
  type PortfolioFieldErrors,
  type PortfolioFormValues,
} from "./schema";

/**
 * Server Actions do portfólio. Toda action confere a sessão aqui dentro (o proxy é só otimista)
 * e grava com o cliente da usuária — o RLS garante que só a dona escreve. A dona vem sempre da
 * sessão (`owner_id default auth.uid()`); do formulário chega só o id do item.
 */

export type PortfolioFormState = {
  ok: false;
  error: string;
  fieldErrors?: PortfolioFieldErrors;
  values: PortfolioFormValues;
} | null;

export type PortfolioActionResult = { ok: true; message: string } | { ok: false; error: string };

const itemId = z.guid({ error: "Não encontramos este item. Recarregue a página e tente de novo." });

async function getMemberId(): Promise<{ userId: string } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão expirou. Entre de novo na sua conta para continuar." };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) {
    return { error: "Complete o seu perfil antes de montar o portfólio." };
  }
  return { userId: user.id };
}

function revalidatePortfolio({ feed = false }: { feed?: boolean } = {}) {
  revalidatePath("/portfolio", "layout");
  revalidatePath("/pesquisadoras/[id]", "page");
  if (feed) revalidatePath("/feed");
}

function logFailure(scope: string, error: { code?: string; message?: string }) {
  if (error.code?.startsWith("CD")) return;
  console.warn(`[portfólio] ${scope} — ${error.code ?? ""} ${(error.message ?? "").slice(0, 160)}`);
}

// ---------------------------------------------------------------------------
// Adicionar / editar
// ---------------------------------------------------------------------------

export async function savePortfolioItemAction(
  _prev: PortfolioFormState,
  formData: FormData,
): Promise<PortfolioFormState> {
  const values = readPortfolioForm(formData);
  const rawId = formData.get("item_id");
  const editingId = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (editingId && !itemId.safeParse(editingId).success) {
    return { ok: false, error: "Não encontramos este item. Recarregue a página.", values };
  }

  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error, values };

  const result = validatePortfolioForm(values);
  if (!result.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo de cada um.",
      fieldErrors: result.fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const row = toPortfolioRow(result.data);

  if (editingId) {
    const { data, error } = await supabase
      .from("portfolio_items")
      .update(row)
      .eq("id", editingId)
      .eq("owner_id", member.userId)
      .select("id")
      .maybeSingle();
    if (error) {
      logFailure("editar", error);
      return { ok: false, error: friendlyPortfolioError(error, "save"), values };
    }
    if (!data) {
      return {
        ok: false,
        error: "Não encontramos este item no seu portfólio. Ele pode ter sido apagado.",
        values,
      };
    }
    revalidatePortfolio();
    redirect(`/portfolio?aviso=atualizado#item-${data.id}`);
  }

  const { data, error } = await supabase.from("portfolio_items").insert(row).select("id").single();
  if (error) {
    logFailure("adicionar", error);
    return { ok: false, error: friendlyPortfolioError(error, "save"), values };
  }

  // Compartilhar no feed: uma publicação curta com o item anexado. Se falhar (ex.: limite de
  // publicações, CD081), o item continua salvo e a página avisa.
  let notice: PortfolioNoticeKey = "adicionado";
  if (result.data.share_to_feed) {
    const { error: postError } = await supabase.from("posts").insert({
      kind: postKindForPortfolio(result.data.kind),
      body: portfolioPostBody(result.data.title),
      portfolio_item_id: data.id,
    });
    if (postError) logFailure("compartilhar no feed", postError);
    notice = postError ? "sem-feed" : "compartilhado";
  }

  revalidatePortfolio({ feed: notice === "compartilhado" });
  redirect(`/portfolio?aviso=${notice}#item-${data.id}`);
}

// ---------------------------------------------------------------------------
// Apagar (ConfirmDialog com stateAction)
// ---------------------------------------------------------------------------

export async function deletePortfolioItemAction(
  _prev: PortfolioActionResult | null,
  formData: FormData,
): Promise<PortfolioActionResult> {
  const parsed = itemId.safeParse(formData.get("item_id"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", parsed.data)
    .eq("owner_id", member.userId)
    .select("id");
  if (error) {
    logFailure("apagar", error);
    return { ok: false, error: friendlyPortfolioError(error, "delete") };
  }
  // Nenhuma linha apagada = o item já não existia: o resultado desejado já vale.
  revalidatePortfolio({ feed: true });
  redirect("/portfolio?aviso=apagado");
}

// ---------------------------------------------------------------------------
// Destacar (chamada direta do botão)
// ---------------------------------------------------------------------------

export type PinResult = { ok: true; pinned: boolean } | { ok: false; error: string };

export async function togglePinnedAction(id: string, pinned: boolean): Promise<PinResult> {
  const parsed = itemId.safeParse(id);
  if (!parsed.success || typeof pinned !== "boolean") {
    return { ok: false, error: "Não encontramos este item. Recarregue a página." };
  }
  const member = await getMemberId();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_items")
    .update({ pinned })
    .eq("id", parsed.data)
    .eq("owner_id", member.userId)
    .select("pinned")
    .maybeSingle();
  if (error) {
    logFailure("destacar", error);
    return { ok: false, error: friendlyPortfolioError(error, "pin") };
  }
  if (!data) {
    return { ok: false, error: "Não encontramos este item no seu portfólio. Recarregue a página." };
  }
  revalidatePortfolio();
  return { ok: true, pinned: data.pinned };
}
