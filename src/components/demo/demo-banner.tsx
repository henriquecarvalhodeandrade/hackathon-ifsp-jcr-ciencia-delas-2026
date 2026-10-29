import Link from "next/link";
import { FlaskConical, LogOut, Repeat } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isDemoEmail, personaByEmail } from "@/lib/demo/personas";
import { env } from "@/lib/env";

/** Nome exibido no aviso: o da persona; senão o do cadastro fictício; senão genérico. */
function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const persona = personaByEmail(user.email);
  if (persona) return persona.firstName;
  const meta = user.user_metadata?.full_name;
  const first = typeof meta === "string" ? meta.trim().split(/\s+/)[0] : "";
  return first || "uma pessoa fictícia";
}

const actionClass =
  "inline-flex min-h-6 shrink-0 items-center gap-1 rounded-control font-semibold underline underline-offset-2 hover:decoration-2 [&_svg]:size-3.5";

/**
 * Aviso fixo do modo demonstração, acima do cabeçalho. Só aparece com DEMO_MODE=true E uma
 * conta fictícia logada. Desligado, não faz NENHUMA chamada ao Supabase; ligado, usa a mesma
 * leitura da sessão do cabeçalho (getCurrentUser é memoizado por requisição).
 */
export async function DemoBanner() {
  if (!env.demoMode) return null;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    return null;
  }
  if (!user || !isDemoEmail(user.email)) return null;

  const name = displayName(user);

  return (
    <div
      role="region"
      aria-label="Modo demonstração"
      className="border-b border-accent-strong/30 bg-accent-soft text-accent-soft-fg"
    >
      {/*
        No celular, uma linha só ("Demonstração · Larissa · Trocar · Sair"); o texto completo
        continua para leitores de tela. Do sm em diante, a frase inteira.
      */}
      <div className="mx-auto flex w-full max-w-7xl items-center gap-x-3 gap-y-1.5 px-4 py-2 text-sm sm:flex-wrap sm:px-6 lg:px-8">
        <p className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-0.5 sm:flex-none sm:flex-wrap">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
          <strong className="shrink-0 font-semibold">
            <span aria-hidden="true" className="sm:hidden">
              Demonstração
            </span>
            <span className="max-sm:sr-only">Modo demonstração</span>
          </strong>
          <span aria-hidden="true">·</span>
          <span aria-hidden="true" className="min-w-0 truncate font-semibold sm:hidden">
            {name}
          </span>
          <span className="max-sm:sr-only">
            você está como <strong className="font-semibold">{name}</strong> (perfil fictício)
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-x-3 gap-y-1 sm:flex-wrap">
          <Link href="/demo" className={actionClass}>
            <Repeat aria-hidden="true" />
            {/* Um span só: dentro do inline-flex, o espaço antes de "persona" não some. */}
            <span>
              Trocar<span className="max-sm:sr-only"> persona</span>
            </span>
          </Link>
          <form action="/auth/sair" method="post">
            <button type="submit" className={actionClass}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
