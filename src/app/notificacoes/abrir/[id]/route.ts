import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { NOTIFICATIONS_PATH, safeInternalPath } from "@/lib/notifications/meta";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /notificacoes/abrir/<id> — marca a notificação como lida e leva ao destino.
 * Só aceita links internos (sem open redirect). A lista usa <a> comum (sem prefetch),
 * então só um clique real chega aqui. O RLS limita tudo às notificações da própria usuária.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const user = await getCurrentUser();
  if (!user) return back(`/entrar?next=${encodeURIComponent(NOTIFICATIONS_PATH)}`);
  if (!z.uuid().safeParse(id).success) return back(NOTIFICATIONS_PATH);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, link, read_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return back(NOTIFICATIONS_PATH);

  if (data.read_at === null) {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", user.id);
    if (updateError) console.error("[notificacoes] falha ao marcar como lida", updateError.code);
  }

  return back(safeInternalPath(data.link) ?? NOTIFICATIONS_PATH);
}
