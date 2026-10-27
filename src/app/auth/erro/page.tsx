import type { Metadata } from "next";
import { AppWindow, Clock, Link2Off, Settings, ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Não foi possível entrar",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const REASONS = {
  "link-expirado": {
    icon: <Clock />,
    title: "Este link expirou",
    description:
      "Links de acesso e de confirmação valem por 1 hora e só funcionam uma vez. Peça um novo e tente de novo — leva menos de um minuto.",
  },
  "link-invalido": {
    icon: <Link2Off />,
    title: "Não conseguimos validar este link",
    description:
      "Ele pode estar incompleto (alguns aplicativos de e-mail cortam endereços longos) ou já ter sido usado. Copie o link inteiro do e-mail ou peça um novo.",
  },
  "outro-navegador": {
    icon: <AppWindow />,
    title: "Abra o link no mesmo navegador",
    description:
      "Por segurança, esse tipo de acesso precisa terminar no mesmo navegador em que começou. Volte para a tela de entrar e tente de novo.",
  },
  oauth: {
    icon: <ShieldAlert />,
    title: "Não foi possível entrar com o Google",
    description: "O acesso foi cancelado ou recusado. Você pode tentar de novo ou entrar com seu e-mail.",
  },
  configuracao: {
    icon: <Settings />,
    title: "A autenticação ainda não foi configurada",
    description: "Este ambiente está sem as chaves do Supabase. Veja o guia em docs/07-setup-e-deploy.md.",
  },
} as const;

type Reason = keyof typeof REASONS;

export default async function AuthErrorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.motivo) ? params.motivo[0] : params.motivo;
  const reason: Reason = raw && raw in REASONS ? (raw as Reason) : "link-invalido";
  const { icon, title, description } = REASONS[reason];

  return (
    <Container size="narrow" className="py-10 sm:py-16">
      <h1 className="sr-only">Não foi possível concluir o acesso</h1>
      <EmptyState
        icon={icon}
        headingLevel="h2"
        title={title}
        description={description}
        action={
          <>
            <ButtonLink href="/entrar">Voltar para entrar</ButtonLink>
            <ButtonLink href="/recuperar-senha" variant="outline">
              Recuperar senha
            </ButtonLink>
          </>
        }
      />
    </Container>
  );
}
