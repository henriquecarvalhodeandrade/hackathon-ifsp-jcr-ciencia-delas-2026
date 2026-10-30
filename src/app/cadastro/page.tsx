import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LocalMailboxNotice } from "@/components/auth/local-mailbox-notice";
import { SignupForm } from "@/components/auth/signup-form";
import { Separator } from "@/components/ui/separator";
import { isGoogleAuthEnabled } from "@/lib/profile/auth-config";
import { safeNextPath, withNext } from "@/lib/profile/redirect";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Artemis: fórum, mentoria e vitrine de pesquisadoras.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";

export default async function CadastroPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext, "/onboarding");

  return (
    <AuthShell
      eyebrow="Faça parte"
      title="Crie sua conta"
      description="É gratuito. Depois, você conta um pouco da sua pesquisa para encontrarmos mentoras e conexões."
      footer={
        <p>
          Já tem conta?{" "}
          <Link href={withNext("/entrar", next, "/onboarding")} className={linkClass}>
            Entrar
          </Link>
        </p>
      }
    >
      {isGoogleAuthEnabled() && (
        <>
          <GoogleSignIn next={next === "/onboarding" ? "/painel" : next} />
          <Separator label="ou com e-mail" />
        </>
      )}
      <SignupForm next={next} devNotice={<LocalMailboxNotice />} />
    </AuthShell>
  );
}
