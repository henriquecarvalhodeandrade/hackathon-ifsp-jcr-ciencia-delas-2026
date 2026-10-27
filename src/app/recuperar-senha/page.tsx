import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LocalMailboxNotice } from "@/components/auth/local-mailbox-notice";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Receba por e-mail um link para criar uma nova senha.",
};

const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      eyebrow="Acontece com todas"
      title="Esqueceu a senha?"
      description="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
      footer={
        <>
          <p>
            Lembrou?{" "}
            <Link href="/entrar" className={linkClass}>
              Voltar para entrar
            </Link>
          </p>
          <p>Dica: na tela de entrar, você também pode receber um link de acesso sem senha.</p>
        </>
      }
    >
      <ForgotPasswordForm />
      <LocalMailboxNotice />
    </AuthShell>
  );
}
