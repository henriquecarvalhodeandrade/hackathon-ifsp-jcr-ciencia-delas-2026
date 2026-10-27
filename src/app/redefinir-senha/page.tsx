import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nova senha",
  description: "Crie uma nova senha para a sua conta.",
};

const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";

export default async function RedefinirSenhaPage() {
  const user = await getCurrentUser();

  return (
    <AuthShell
      eyebrow="Sua conta"
      title="Crie uma nova senha"
      description={
        user?.email ? (
          <>
            Para a conta <strong className="break-all text-fg">{user.email}</strong>.
          </>
        ) : (
          "Escolha uma senha que você ainda não usou aqui."
        )
      }
      footer={
        <p>
          Prefere não trocar agora?{" "}
          <Link href={user ? "/perfil" : "/entrar"} className={linkClass}>
            {user ? "Voltar para o perfil" : "Voltar para entrar"}
          </Link>
        </p>
      }
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert
          variant="warning"
          title="Este link expirou ou já foi usado"
          actions={
            <ButtonLink href="/recuperar-senha" size="sm">
              <RotateCcw aria-hidden="true" />
              Pedir um novo link
            </ButtonLink>
          }
        >
          Por segurança, os links de redefinição valem por 1 hora e só funcionam uma vez. Peça outro — leva menos de um
          minuto.
        </Alert>
      )}
    </AuthShell>
  );
}
