import Link from "next/link";
import { ArrowUpRight, CalendarClock, CalendarRange, Globe, Newspaper } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Stat, StatGroup, SubmitButton } from "@/components/ui";
import { generateEditionAction, publishEditionAction } from "@/lib/admin/actions";
import type { EditionsList } from "@/lib/admin/queries";
import type { NewsletterOverview } from "@/lib/newsletter/service";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { ActionForm } from "./action-form";
import { SendEditionControl } from "./send-edition-control";

const STATUS = {
  draft: { label: "Rascunho", variant: "neutral" },
  published: { label: "Publicada", variant: "info" },
  sent: { label: "Enviada", variant: "success" },
} as const;

function period(start: string | null, end: string | null) {
  if (!start || !end) return null;
  // Datas "YYYY-MM-DD": meio-dia UTC evita virar o dia no fuso de São Paulo.
  return `${formatDate(`${start}T12:00:00Z`, { day: "numeric", month: "short" })} – ${formatDate(`${end}T12:00:00Z`)}`;
}

function EmailStatus({ overview }: { overview: NewsletterOverview | null }) {
  if (!overview) {
    return (
      <Alert variant="warning" title="Não conseguimos ler a configuração da newsletter">
        Confira se a <code className="font-mono">SUPABASE_SECRET_KEY</code> está definida no servidor.
      </Alert>
    );
  }
  const { email, maxPerRun } = overview;
  const limit = `Cada envio processa até ${formatNumber(maxPerRun)} e-mails; o restante segue na próxima execução.`;
  if (email.transport === "resend") {
    return (
      <Alert variant={email.usingResendTestSender ? "warning" : "success"} title="Envio por e-mail ativo (Resend)">
        <p>
          Remetente: <span className="font-mono">{email.from}</span>. {limit}
        </p>
        {email.usingResendTestSender && (
          <p>
            O remetente de teste <span className="font-mono">onboarding@resend.dev</span> só entrega para a dona da
            conta Resend. Para enviar às inscritas, verifique um domínio e ajuste{" "}
            <code className="font-mono">NEWSLETTER_FROM</code>.
          </p>
        )}
      </Alert>
    );
  }
  if (email.transport === "mailpit") {
    return (
      <Alert variant="info" title="Modo de desenvolvimento: e-mails vão para o Mailpit">
        Nada chega a caixas reais. Veja as mensagens em{" "}
        {email.devInboxUrl ? <span className="font-mono">{email.devInboxUrl}</span> : "o Mailpit local"}. {limit}
      </Alert>
    );
  }
  return (
    <Alert variant="warning" title="E-mail ainda não configurado">
      Sem a variável <code className="font-mono">RESEND_API_KEY</code>, nenhum e-mail sai da plataforma: você pode gerar
      e publicar edições, e a prévia do envio só conta as inscritas. Veja{" "}
      <code className="font-mono">docs/08-newsletter.md</code>.
    </Alert>
  );
}

export function NewsletterPanel({ data, overview }: { data: EditionsList; overview: NewsletterOverview | null }) {
  return (
    <div className="grid gap-6">
      <EmailStatus overview={overview} />

      {overview && (
        <StatGroup className="md:grid-cols-3">
          <Stat label="Inscritas ativas" value={overview.subscribers.active} />
          <Stat label="Aguardando confirmação" value={overview.subscribers.pending} />
          <Stat label="Descadastradas" value={overview.subscribers.unsubscribed} />
        </StatGroup>
      )}

      <Card padding="md" className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-1">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
            <CalendarClock aria-hidden="true" className="size-5 text-primary" />
            Edição da semana
          </h3>
          <p className="text-[0.9375rem] text-fg-muted">
            Reúne os papers mais destacados, as conversas abertas do fórum e as novas mentoras dos últimos 7 dias, e
            publica no arquivo. Se a edição desta semana já existir, nada é duplicado. O cron faz isso toda segunda às
            9h (Brasília).
          </p>
        </div>
        <ActionForm action={generateEditionAction}>
          <SubmitButton pendingText="Gerando…">
            <Newspaper aria-hidden="true" />
            Gerar edição da semana
          </SubmitButton>
        </ActionForm>
      </Card>

      {data.error ? (
        <Alert variant="danger" title="Não conseguimos carregar as edições">
          Recarregue a página em instantes.
        </Alert>
      ) : data.editions.length === 0 ? (
        <EmptyState
          icon={<Newspaper />}
          title="Nenhuma edição ainda"
          description="Gere a primeira edição com o botão acima. Ela fica publicada no arquivo do Boletim."
        />
      ) : (
        <section aria-labelledby="edicoes-titulo" className="grid gap-3">
          <h3 id="edicoes-titulo" className="font-display text-xl font-semibold text-fg">
            Edições
          </h3>
          <ul className="grid gap-3">
            {data.editions.map((edition) => {
              const status = STATUS[edition.status];
              const range = period(edition.period_start, edition.period_end);
              const isPublic = edition.status !== "draft";
              return (
                <li key={edition.id}>
                  <Card padding="md" className="grid gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid min-w-0 gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={status.variant} size="md">
                            {status.label}
                          </Badge>
                          <span className="font-mono text-xs text-fg-subtle">{edition.slug}</span>
                        </div>
                        <p className="font-serif text-lg leading-snug font-semibold text-fg">{edition.title}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                          {range && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarRange aria-hidden="true" className="size-4" />
                              {range}
                            </span>
                          )}
                          {edition.published_at && <span>Publicada em {formatDateTime(edition.published_at)}</span>}
                          {edition.sent_at && <span>Enviada em {formatDateTime(edition.sent_at)}</span>}
                          <span>
                            {formatNumber(edition.recipients_count)}{" "}
                            {edition.recipients_count === 1 ? "destinatária" : "destinatárias"}
                          </span>
                        </p>
                      </div>
                      {isPublic && (
                        <Link
                          href={`/newsletter/${edition.slug}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Ver edição
                          <ArrowUpRight aria-hidden="true" className="size-3.5" />
                        </Link>
                      )}
                    </div>
                    {isPublic ? (
                      <SendEditionControl
                        editionId={edition.id}
                        label={edition.status === "sent" ? "Enviar para quem ainda não recebeu" : "Preparar envio"}
                      />
                    ) : (
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                        <ActionForm action={publishEditionAction} hiddenFields={{ editionId: edition.id }}>
                          <SubmitButton variant="outline" size="sm" pendingText="Publicando…">
                            <Globe aria-hidden="true" />
                            Publicar no arquivo
                          </SubmitButton>
                        </ActionForm>
                        <p className="pt-1.5 text-sm text-fg-subtle">
                          Rascunho: publique antes de enviar. A edição passa a aparecer no arquivo público do Boletim.
                        </p>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
