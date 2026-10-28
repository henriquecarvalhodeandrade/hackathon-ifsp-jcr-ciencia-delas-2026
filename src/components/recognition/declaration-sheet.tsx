import { Logo } from "@/components/ui";
import { verificationUrl } from "@/lib/recognition/code";
import {
  DECLARATION_DISCLAIMER,
  buildDeclarationText,
  displayHost,
  themeLabels,
} from "@/lib/recognition/declaration-text";
import type { DeclarationSheet as SheetData } from "@/lib/recognition/queries";
import { formatDate } from "@/lib/utils";

/**
 * A folha A4 da declaração. É sempre uma "ilha" de tema claro (data-theme="light"): papel
 * branco na tela (inclusive no tema escuro) e na impressão. Só a marca da Artemis — nada de
 * logos ou selos de instituições ou do governo.
 */
export function DeclarationSheet({
  sheet,
  siteUrl,
  qrSvg,
}: {
  sheet: SheetData;
  siteUrl: string;
  /** SVG do QR code (renderQrSvg) para a URL de verificação deste código. */
  qrSvg: string;
}) {
  const url = verificationUrl(siteUrl, sheet.code);
  const host = displayHost(siteUrl);
  const text = buildDeclarationText({
    menteeName: sheet.menteeName,
    mentorName: sheet.mentorName,
    periodStart: sheet.periodStart,
    periodEnd: sheet.periodEnd,
    themes: themeLabels(sheet.themes),
  });

  return (
    <article
      data-theme="light"
      aria-labelledby="declaracao-titulo"
      className="declaration-sheet mx-auto grid w-full max-w-[210mm] gap-8 rounded-card bg-surface p-6 text-fg shadow-raised ring-1 ring-border sm:gap-10 sm:p-12 print:max-w-none print:gap-8 print:rounded-none print:p-0 print:shadow-none print:ring-0"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <Logo size={30} />
        <p className="text-right text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          Declaração nº <span className="font-mono tracking-normal text-fg">{sheet.code}</span>
        </p>
      </header>

      <div className="grid gap-6">
        <h1
          id="declaracao-titulo"
          className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl"
        >
          Declaração de participação em mentoria
        </h1>
        <p className="font-serif text-lg leading-relaxed text-pretty sm:text-xl sm:leading-relaxed">
          {text}
        </p>
        <p className="text-sm text-fg-muted">
          Emitida em{" "}
          {formatDate(sheet.issuedAt, { day: "numeric", month: "long", year: "numeric" })}, com a
          autorização das duas participantes.
        </p>
      </div>

      <section
        aria-label="Verificação"
        className="grid gap-5 rounded-control border border-border p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-5 print:grid-cols-[auto_minmax(0,1fr)] print:items-center"
      >
        <div
          role="img"
          aria-label="QR code para verificar a declaração"
          data-qr-url={url}
          className="size-32 bg-surface text-fg print:size-[32mm]"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="grid min-w-0 gap-2">
          <p className="grid gap-0.5">
            <span className="text-xs font-bold tracking-wide text-fg-subtle uppercase">
              Código de verificação
            </span>
            <span className="font-mono text-lg font-semibold tracking-wide sm:text-xl">
              {sheet.code}
            </span>
          </p>
          <p className="text-sm text-fg-muted">
            Confira a autenticidade em{" "}
            <span className="font-semibold text-fg">{host}/verificar</span>
          </p>
          <p className="font-mono text-xs break-all text-fg-subtle">
            <a href={url} className="underline-offset-2 hover:underline">
              {url}
            </a>
          </p>
        </div>
      </section>

      <footer className="border-t border-border pt-5 text-xs leading-relaxed text-fg-muted">
        {DECLARATION_DISCLAIMER}
      </footer>
    </article>
  );
}
