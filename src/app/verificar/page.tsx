import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EyeOff, ScanLine, ShieldCheck } from "lucide-react";
import { Card, Container, PageHeader } from "@/components/ui";
import { VerifyForm } from "@/components/recognition/verify-form";
import { normalizeDeclarationCode, verificationPath } from "@/lib/recognition/code";

export const metadata: Metadata = {
  title: "Verificar declaração",
  description:
    "Confira a autenticidade de uma declaração de participação em mentoria emitida pela Artemis.",
  alternates: { canonical: "/verificar" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Página pública de verificação. O formulário é um GET nativo (?codigo=…): o código digitado é
 * normalizado (minúsculas, espaços, O/0, I/L/1) e, se tiver o formato certo, vai para
 * /verificar/<código>.
 */
export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const typed = first((await searchParams).codigo)?.slice(0, 64);
  let error: string | undefined;
  if (typed !== undefined) {
    const code = normalizeDeclarationCode(typed);
    if (code) redirect(verificationPath(code));
    error = typed.trim()
      ? "Esse código não está no formato da declaração (ART-XXXX-XXXX-XXXX). Confira e tente de novo."
      : "Digite o código que aparece na declaração.";
  }

  return (
    <Container size="narrow">
      <PageHeader
        eyebrow="Declarações da Artemis"
        title="Verificar uma declaração"
        description="Toda declaração de participação em mentoria emitida pela Artemis tem um código. Digite-o abaixo — ou aponte a câmera para o QR code da declaração — para conferir se ela é autêntica."
      />

      <div className="grid gap-8 pb-14">
        <Card as="section" aria-label="Verificar código" className="p-5 sm:p-6">
          <VerifyForm defaultValue={typed} error={error} autoFocus={Boolean(error)} />
        </Card>

        <section aria-labelledby="como-funciona" className="grid gap-4">
          <h2 id="como-funciona" className="font-display text-xl font-semibold text-fg">
            Como funciona
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            <li className="grid content-start gap-2">
              <ScanLine aria-hidden="true" className="size-5 text-primary" />
              <p className="font-semibold text-fg">Um código por declaração</p>
              <p className="text-sm text-fg-muted">
                O código é gerado pela plataforma e aparece junto do QR code, na própria declaração.
              </p>
            </li>
            <li className="grid content-start gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              <p className="font-semibold text-fg">Só com as duas autorizações</p>
              <p className="text-sm text-fg-muted">
                A declaração só é emitida quando a mentora e a mentoranda autorizam os próprios
                nomes. Qualquer uma pode revogar depois.
              </p>
            </li>
            <li className="grid content-start gap-2">
              <EyeOff aria-hidden="true" className="size-5 text-primary" />
              <p className="font-semibold text-fg">O mínimo necessário</p>
              <p className="text-sm text-fg-muted">
                Mostramos nomes, papéis, período e temas. Nunca{" "}
                <span className="whitespace-nowrap">e-mails</span>, instituição, mensagens ou
                avaliações.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </Container>
  );
}
