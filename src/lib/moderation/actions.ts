"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/forum/errors";
import { readReportForm, reportSchema, type ReportTarget, type ReportValues } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";

export type ReportState =
  | { ok: true; message: string; values: ReportValues }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<keyof ReportValues, string[]>>;
      values: ReportValues;
    }
  | null;

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Confere se o alvo existe e é visível para quem denuncia (o RLS faz o resto). */
async function targetExists(supabase: SupabaseServer, type: ReportTarget, id: string): Promise<boolean> {
  const table = {
    thread: "forum_threads",
    post: "forum_posts",
    paper: "papers",
    paper_comment: "paper_comments",
    profile: "profiles",
  } as const satisfies Record<ReportTarget, string>;
  const { data, error } = await supabase.from(table[type]).select("id").eq("id", id).maybeSingle();
  return !error && Boolean(data);
}

/**
 * Cria uma denúncia (tabela `reports`). Usada pelo <ReportButton /> em tópicos, respostas,
 * papers, comentários e perfis. A denunciante é sempre a usuária da sessão (default auth.uid()).
 */
export async function createReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const values = readReportForm(formData);
  const parsed = reportSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos destacados antes de enviar.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Entre na sua conta para enviar uma denúncia.", values };
  }

  const { targetType, targetId, reason, details } = parsed.data;
  const supabase = await createClient();

  if (!(await targetExists(supabase, targetType, targetId))) {
    return {
      ok: false,
      error: "Não encontramos esse conteúdo. Talvez ele já tenha sido removido.",
      values,
    };
  }

  // Evita denúncias repetidas da mesma pessoa enquanto a anterior está em análise.
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "open")
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      ok: true,
      message: "Você já tinha denunciado este conteúdo e a moderação está analisando. Obrigada por avisar.",
      values,
    };
  }

  const { error } = await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details || null,
  });
  if (error) {
    return {
      ok: false,
      error: friendlyDbError(error, "Não conseguimos enviar sua denúncia agora. Tente de novo em instantes."),
      values,
    };
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message:
      "Denúncia enviada. A moderação vai analisar com cuidado e sigilo — quem foi denunciada não sabe quem denunciou.",
    values,
  };
}
