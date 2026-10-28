import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LocalMailboxNotice } from "@/components/auth/local-mailbox-notice";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { env } from "@/lib/env";
import { isGoogleAuthEnabled } from "@/lib/profile/auth-config";
import { safeNextPath, withNext } from "@/lib/profile/redirect";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na Artemis com seu e-mail e senha ou com um link de acesso.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";

/** Sem ?next, quem entra cai no /painel (o início de quem já faz parte da rede). */
const DEFAULT_NEXT = "/painel";

export default async function EntrarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext, DEFAULT_NEXT);
  const accountDeleted = params.conta === "excluida";

  return (
    <AuthShell
      eyebrow="Boas-vindas de volta"
      title="Entrar na Artemis"
      description="Use seu e-mail e senha, ou receba um link de acesso — sem precisar lembrar a senha."
      footer={
        <>
          <p>
            Ainda não tem conta?{" "}
            <Link href={withNext("/cadastro", next, DEFAULT_NEXT)} className={linkClass}>
              Criar conta
            </Link>
          </p>
          <p>
            Ao entrar, você concorda com o{" "}
            <Link href="/conduta" className={linkClass}>
              código de conduta
            </Link>{" "}
            da comunidade.
          </p>
        </>
      }
    >
      {accountDeleted && (
        <Alert variant="success" title="Sua conta foi excluída">
          Apagamos seu perfil e o que você publicou. Obrigada por ter feito parte — as portas
          continuam abertas.
        </Alert>
      )}
      {isGoogleAuthEnabled() && (
        <>
          <GoogleSignIn next={next} />
          <Separator label="ou com e-mail" />
        </>
      )}
      <LoginForm next={next} />
      <LocalMailboxNotice />
      {env.demoMode && (
        <Card
          as="aside"
          aria-labelledby="entrar-demo"
          variant="muted"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="grid gap-0.5">
              <p id="entrar-demo" className="font-semibold text-fg">
                Só quer conhecer? Entre como uma pessoa fictícia
              </p>
              <p className="text-sm text-fg-muted">Um clique, sem senha e sem e-mail.</p>
            </div>
          </div>
          <ButtonLink href="/demo" variant="outline" size="sm" className="shrink-0">
            Modo demonstração
            <ArrowRight aria-hidden="true" />
          </ButtonLink>
        </Card>
      )}
    </AuthShell>
  );
}
