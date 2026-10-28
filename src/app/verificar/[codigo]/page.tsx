import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, FileQuestion, ShieldAlert } from "lucide-react";
import { Alert, Badge, ButtonLink, Card, Chip, Container, EmptyState } from "@/components/ui";
import { VerifyForm } from "@/components/recognition/verify-form";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeDeclarationCode, verificationPath } from "@/lib/recognition/code";
import { formatPeriodRange, themeLabels } from "@/lib/recognition/declaration-text";
import { verifyDeclaration, type VerificationResult } from "@/lib/recognition/queries";
import { formatDate, toIsoString } from "@/lib/utils";

type Params = Promise<{ codigo: string }>;

/** Fora dos buscadores e sem mandar o código como Referer para outros sites. */
export const metadata: Metadata = {
  title: "Verificação de declaração",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function VerifyCodePage({ params }: { params: Params }) {
  const raw = decode((await params).codigo).slice(0, 64);
  const code = normalizeDeclarationCode(raw);
  // Endereço canônico (ex.: digitado em minúsculas): uma URL por declaração.
  if (code && code !== raw) redirect(verificationPath(code));

  // Formato inválido nem chega ao banco.
  const result: VerificationResult =
    code && isSupabaseConfigured() ? await verifyDeclaration(code) : { kind: "not-found" };

  return (
    <Container size="narrow" className="grid gap-8 py-10 sm:py-14">
      {result.kind === "found" && result.verification.status === "valida" && (
        <Card as="article" aria-labelledby="verificacao-titulo" className="grid gap-6 p-6 sm:p-8">
          <header className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" size="md">
                <BadgeCheck aria-hidden="true" />
                Válida
              </Badge>
              <span className="font-mono text-sm font-semibold tracking-wide text-fg-muted">
                {code}
              </span>
            </div>
            <h1
              id="verificacao-titulo"
              className="font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl"
            >
              Declaração válida
            </h1>
            <p className="text-fg-muted">
              Emitida pela plataforma Artemis, com a autorização das duas participantes.
            </p>
          </header>
          <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div className="grid gap-0.5">
              <dt className="text-sm font-semibold text-fg-subtle">Mentora</dt>
              <dd className="text-lg font-semibold text-fg">{result.verification.mentorName}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-sm font-semibold text-fg-subtle">Mentoranda</dt>
              <dd className="text-lg font-semibold text-fg">{result.verification.menteeName}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-sm font-semibold text-fg-subtle">Período</dt>
              <dd className="text-fg">
                {formatPeriodRange(
                  result.verification.periodStart,
                  result.verification.periodEnd,
                ) || "—"}
              </dd>
            </div>
            {result.verification.issuedAt && (
              <div className="grid gap-0.5">
                <dt className="text-sm font-semibold text-fg-subtle">Emitida em</dt>
                <dd className="text-fg">
                  <time dateTime={toIsoString(result.verification.issuedAt)}>
                    {formatDate(result.verification.issuedAt, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </dd>
              </div>
            )}
            {themeLabels(result.verification.themes).length > 0 && (
              <div className="grid gap-1.5 sm:col-span-2">
                <dt className="text-sm font-semibold text-fg-subtle">Temas</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {themeLabels(result.verification.themes).map((theme) => (
                    <Chip key={theme} size="sm" variant="secondary">
                      {theme}
                    </Chip>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <p className="border-t border-border pt-5 text-sm text-fg-muted">
            A declaração confirma a participação numa mentoria entre pesquisadoras pela{" "}
            <Link
              href="/sobre"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Artemis
            </Link>
            . Não é certificado institucional e não registra horas.
          </p>
        </Card>
      )}

      {result.kind === "found" && result.verification.status === "revogada" && (
        <section aria-labelledby="verificacao-titulo" className="grid gap-4">
          <h1
            id="verificacao-titulo"
            className="font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl"
          >
            Declaração revogada
          </h1>
          <Alert variant="warning" icon={<ShieldAlert />} title="Esta declaração não vale mais">
            Uma das participantes revogou a declaração <span className="font-mono">{code}</span>.
            Por isso, os nomes e os detalhes da mentoria não são mostrados.
          </Alert>
        </section>
      )}

      {result.kind === "not-found" && (
        <section aria-labelledby="verificacao-titulo">
          <h1 id="verificacao-titulo" className="sr-only">
            Verificação de declaração
          </h1>
          <EmptyState
            icon={<FileQuestion />}
            title="Declaração não encontrada"
            description="Confira se digitou o código como está na declaração."
          />
        </section>
      )}

      {result.kind === "error" && (
        <section aria-labelledby="verificacao-titulo" className="grid gap-4">
          <h1 id="verificacao-titulo" className="font-display text-3xl font-semibold text-fg">
            Verificação indisponível
          </h1>
          <Alert
            variant="danger"
            title="Não conseguimos consultar a declaração agora"
            actions={
              code ? <ButtonLink href={verificationPath(code)}>Tentar de novo</ButtonLink> : null
            }
          >
            Isso não diz nada sobre a declaração: tente de novo em instantes.
          </Alert>
        </section>
      )}

      <Card as="section" aria-labelledby="outro-codigo" className="grid gap-4 p-5 sm:p-6">
        <h2 id="outro-codigo" className="font-display text-lg font-semibold text-fg">
          Verificar outro código
        </h2>
        <VerifyForm defaultValue={result.kind === "not-found" ? raw : undefined} />
      </Card>
    </Container>
  );
}
