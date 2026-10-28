import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { exportFileName } from "@/lib/profile/export";
import { ExportQueryError, loadMyDataExport } from "@/lib/profile/export-data";

/**
 * GET /perfil/exportar — "Baixar meus dados" (LGPD, art. 18, V).
 * Exige sessão (o proxy já manda visitantes para /entrar; aqui conferimos de novo) e devolve um
 * JSON como anexo, sem cache. Só onboarding não é exigido: o direito vale para qualquer conta.
 * O /perfil usa um <a> comum (sem prefetch nem atributo download), então uma falha volta para a
 * página com o aviso em vez de baixar um HTML de erro.
 */
export async function GET(request: NextRequest) {
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!isSupabaseConfigured()) return back("/perfil?exportacao=erro#dados");
  const user = await getCurrentUser();
  if (!user) return back(`/entrar?next=${encodeURIComponent("/perfil")}`);

  try {
    const now = new Date();
    const data = await loadMyDataExport(user, now);
    return new NextResponse(`${JSON.stringify(data, null, 2)}\n`, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    const detail =
      error instanceof ExportQueryError
        ? `${error.section} ${error.code ?? ""}`
        : error instanceof Error
          ? error.name
          : "erro";
    console.error(`[perfil] falha ao gerar a exportação de dados (${detail.trim()})`);
    return back("/perfil?exportacao=erro#dados");
  }
}
