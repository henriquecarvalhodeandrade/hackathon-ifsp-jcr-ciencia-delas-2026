import type { Metadata } from "next";
import { Inbox, MailCheck } from "lucide-react";
import {
  Alert,
  ButtonLink,
  Card,
  Container,
  EmptyState,
  PageHeader,
  Pagination,
  Section,
} from "@/components/ui";
import { EditionCard } from "@/components/newsletter/edition-card";
import { LatestEdition } from "@/components/newsletter/latest-edition";
import { NewsletterPerks } from "@/components/newsletter/newsletter-perks";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { getCurrentUser } from "@/lib/auth";
import { getEmailTransportInfo } from "@/lib/email";
import { ARCHIVE_PAGE_SIZE } from "@/lib/newsletter/constants";
import { getBigAreas, listPublishedEditions } from "@/lib/newsletter/queries";
import { canAcceptSubscriptions, getSubscriptionForEmail } from "@/lib/newsletter/subscriptions";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Boletim Delas: toda segunda-feira, os papers de pesquisadoras mais destacados pela comunidade, conversas do fórum e as novas mentoras da rede.",
};

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1;
}

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const page = parsePage((await searchParams).pagina);
  const [user, areas, archive, latestPage] = await Promise.all([
    getCurrentUser(),
    getBigAreas(),
    listPublishedEditions(page),
    page === 1 ? null : listPublishedEditions(1, 1),
  ]);
  const latest = (page === 1 ? archive.editions[0] : latestPage?.editions[0]) ?? null;
  const subscription = user?.email ? await getSubscriptionForEmail(user.email) : null;
  const accepts = canAcceptSubscriptions();
  const email = getEmailTransportInfo();
  const totalPages = Math.max(1, Math.ceil(archive.total / ARCHIVE_PAGE_SIZE));

  return (
    <Container>
      <PageHeader
        eyebrow="Newsletter semanal"
        title="Boletim Delas"
        description="Toda segunda-feira, os papers de pesquisadoras mais destacados pela comunidade, as conversas que movimentaram o fórum e as novas mentoras da rede — direto no seu e-mail."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <Card
          as="section"
          id="assinar"
          aria-labelledby="assinar-titulo"
          padding="lg"
          className="scroll-mt-24 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1"
        >
          <div className="mb-5 grid gap-1">
            <h2 id="assinar-titulo" className="font-display text-2xl font-semibold text-fg">
              Assine grátis
            </h2>
            <p className="text-fg-muted">
              Um e-mail por semana, às segundas, com o melhor da comunidade.
            </p>
          </div>

          {subscription?.status === "active" ? (
            <div className="grid gap-4">
              <Alert variant="success" title="Você já assina o Boletim Delas" icon={<MailCheck />}>
                O boletim chega toda segunda-feira em <strong>{user?.email}</strong>.
              </Alert>
              <ButtonLink
                href={`/newsletter/cancelar?token=${encodeURIComponent(subscription.unsubscribeToken)}`}
                variant="outline"
              >
                Gerenciar inscrição
              </ButtonLink>
            </div>
          ) : (
            <div className="grid gap-5">
              {!accepts && (
                <Alert variant="info" title="Inscrições em breve">
                  O envio por e-mail ainda não está ativo neste ambiente. Enquanto isso, você pode
                  ler todas as edições aqui no site.
                </Alert>
              )}
              {accepts && !email.production && email.transport !== "resend" && (
                <Alert variant="warning" title="Modo de desenvolvimento">
                  {email.transport === "mailpit" ? (
                    <>
                      Sem RESEND_API_KEY: os e-mails vão para a caixa de testes do Mailpit (
                      <a href={email.devInboxUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                        {email.devInboxUrl}
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                      ) e o link de confirmação aparece no console do servidor.
                    </>
                  ) : (
                    "Sem RESEND_API_KEY: nenhum e-mail é enviado e o link de confirmação aparece no console do servidor."
                  )}
                </Alert>
              )}
              {subscription?.status === "pending" && (
                <Alert variant="info" title="Falta confirmar sua inscrição">
                  Enviamos um link de confirmação para {user?.email}. Não chegou? Envie o formulário
                  de novo para receber outro.
                </Alert>
              )}
              <SubscribeForm areas={areas} accountEmail={user?.email ?? null} disabled={!accepts} />
            </div>
          )}
        </Card>

        <div className="grid gap-10 lg:col-start-1 lg:row-start-1">
          <LatestEdition edition={latest} />
          <NewsletterPerks />
        </div>
      </div>

      <Section
        title="Todas as edições"
        titleId="arquivo"
        description="O arquivo é aberto: leia e compartilhe as edições anteriores."
      >
        {archive.failed ? (
          <Alert variant="danger" title="Não conseguimos carregar as edições">
            Tente recarregar a página em alguns instantes.
          </Alert>
        ) : archive.editions.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={page > 1 ? "Não há edições nesta página" : "Ainda não há edições publicadas"}
            description={
              page > 1
                ? "Volte para a primeira página para ver as edições mais recentes."
                : "A primeira edição sai na próxima segunda-feira. Assine para recebê-la no seu e-mail."
            }
            action={
              page > 1 ? (
                <ButtonLink href="/newsletter">Ver as mais recentes</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {archive.editions.map((edition) => (
              <li key={edition.id}>
                <EditionCard edition={edition} />
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <Pagination className="mt-8" page={page} totalPages={totalPages} basePath="/newsletter" />
        )}
      </Section>
    </Container>
  );
}
