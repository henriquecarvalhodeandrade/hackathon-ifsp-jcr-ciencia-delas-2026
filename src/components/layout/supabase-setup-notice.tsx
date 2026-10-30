import { Wrench } from "lucide-react";
import { SITE } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";

const SETUP_DOC_URL = `${SITE.repoUrl}/blob/main/docs/07-setup-e-deploy.md`;

/**
 * Faixa amigável exibida quando o Supabase ainda não foi configurado (.env.local ausente).
 * O site continua navegável; login, fórum e mentoria ficam indisponíveis.
 */
export function SupabaseSetupNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="border-b border-warning/25 bg-warning-soft text-warning-soft-fg">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 text-sm sm:items-center sm:px-6 lg:px-8">
        <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <p>
          <strong className="font-semibold">Modo demonstração:</strong> o Supabase ainda não foi
          configurado, então login, fórum e mentoria estão desligados. Siga o passo a passo em{" "}
          <a
            href={SETUP_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:decoration-2"
          >
            docs/07-setup-e-deploy.md
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          .
        </p>
      </div>
    </div>
  );
}
