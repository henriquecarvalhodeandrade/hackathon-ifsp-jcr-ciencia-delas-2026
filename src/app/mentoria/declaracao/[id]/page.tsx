import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { z } from "zod";
import { Alert, ButtonLink, Card, Container } from "@/components/ui";
import { CopyLine } from "@/components/recognition/copy-line";
import { DeclarationSheet } from "@/components/recognition/declaration-sheet";
import { PrintButton } from "@/components/recognition/print-button";
import { completionHref } from "@/components/recognition/recognition-panel";
import { requireOnboardedProfile } from "@/lib/auth";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { isDeclarationCode, verificationPath, verificationUrl } from "@/lib/recognition/code";
import { buildCvLine } from "@/lib/recognition/declaration-text";
import { renderQrSvg } from "@/lib/recognition/qr";
import { getDeclarationSheet } from "@/lib/recognition/queries";

type Params = Promise<{ id: string }>;

const idSchema = z.guid();

export const metadata: Metadata = {
  title: "Declaração de participação",
  robots: { index: false, follow: false },
};

/**
 * Impressão: some todo o "cromo" do site (cabeçalho, rodapé, link de pular, avisos) sem mexer no
 * layout compartilhado — só esta página carrega a regra. A folha já é uma ilha de tema claro.
 */
const PRINT_CSS = `
@page { size: A4; margin: 16mm 18mm; }
@media print {
  html, body { background: #fff !important; }
  body > :not(main) { display: none !important; }
  main#conteudo { padding: 0 !important; margin: 0 !important; }
  .declaration-sheet { break-inside: avoid; }
}
`;

export default async function DeclarationPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mentoria/declaracao/${id}`);
  if (!isSupabaseConfigured() || !idSchema.safeParse(id).success) notFound();

  const result = await getDeclarationSheet(id, profile.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <Container size="narrow" className="py-14">
        <h1 className="sr-only">Declaração de participação</h1>
        <Alert
          variant="danger"
          title="Não conseguimos carregar a declaração agora"
          actions={<ButtonLink href={`/mentoria/declaracao/${id}`}>Tentar de novo</ButtonLink>}
        >
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      </Container>
    );
  }

  const { sheet } = result;
  // O QR só recebe URLs montadas aqui, a partir de um código no formato canônico.
  if (!isDeclarationCode(sheet.code)) notFound();
  const siteUrl = getSiteUrl();
  const qrSvg = await renderQrSvg(verificationUrl(siteUrl, sheet.code));
  const cvLine = buildCvLine({
    role: sheet.role,
    periodStart: sheet.periodStart,
    periodEnd: sheet.periodEnd,
    siteUrl,
    code: sheet.code,
  });

  return (
    <Container className="grid gap-8 py-8 sm:py-10 print:block print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href={completionHref(sheet.requestId, "declaracao")}
          className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para a mentoria
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <ButtonLink href={verificationPath(sheet.code)} variant="outline">
            <ExternalLink aria-hidden="true" />
            Ver página pública
          </ButtonLink>
        </div>
      </div>

      <DeclarationSheet sheet={sheet} siteUrl={siteUrl} qrSvg={qrSvg} />

      <div className="mx-auto grid w-full max-w-[210mm] gap-6 print:hidden">
        <Card as="section" aria-labelledby="linha-curriculo" className="grid gap-3 p-5 sm:p-6">
          <h2 id="linha-curriculo" className="font-display text-lg font-semibold text-fg">
            Linha sugerida para o currículo
          </h2>
          <p className="text-sm text-fg-muted">
            Para o Lattes, o LinkedIn ou um relatório institucional. Quem ler pode conferir pelo
            link.
          </p>
          <CopyLine text={cvLine} label="Copiar linha" />
        </Card>
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>
            A declaração confirma a participação na mentoria. Ela não fala em horas (a Artemis não
            as registra) e não mostra nada das conversas nem dos retornos de vocês.
          </span>
        </p>
      </div>
    </Container>
  );
}
