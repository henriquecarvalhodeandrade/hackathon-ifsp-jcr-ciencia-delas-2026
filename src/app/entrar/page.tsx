import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LocalMailboxNotice } from "@/components/auth/local-mailbox-notice";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { isGoogleAuthEnabled } from "@/lib/profile/auth-config";
import { safeNextPath, withNext } from "@/lib/profile/redirect";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na Artemis com seu e-mail e senha ou com um link de acesso.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";

export default async function EntrarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext, "/forum");
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
            <Link href={withNext("/cadastro", next, "/forum")} className={linkClass}>
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
    </AuthShell>
  );
}
