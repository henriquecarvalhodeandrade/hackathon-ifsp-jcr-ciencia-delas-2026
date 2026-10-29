import type { Metadata } from "next";
import { ClipboardList, Megaphone, Plus, Search } from "lucide-react";
import { MyApplicationCard, MyOpportunityCard } from "@/components/opportunities/my-lists";
import {
  Alert,
  ButtonLink,
  Container,
  EmptyState,
  PageHeader,
  Section,
  TabNav,
} from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { canPublishOpportunities } from "@/lib/opportunities/labels";
import { MY_TAB_LABELS, MY_TABS, myTabHref, parseMyTab } from "@/lib/opportunities/params";
import { parseNotice } from "@/lib/opportunities/presentation";
import { listMyApplications, listMyOpportunities } from "@/lib/opportunities/queries";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Minhas candidaturas e vagas",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyOpportunitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tab = parseMyTab(params.aba);
  const me = await requireOnboardedProfile(myTabHref(tab));
  const notice = parseNotice(params.aviso);
  const canPublish = canPublishOpportunities(me.career_stage);
  const now = new Date();

  // As duas listas são curtas (até 100): carregamos ambas para mostrar as contagens nas abas.
  const [applications, opportunities] = await Promise.all([
    listMyApplications(me.id),
    listMyOpportunities(me.id),
  ]);

  const tabs = MY_TABS.map((value) => ({
    href: myTabHref(value),
    label: MY_TAB_LABELS[value],
    count:
      value === "candidaturas"
        ? applications.ok
          ? applications.total
          : undefined
        : opportunities.ok
          ? opportunities.total
          : undefined,
    active: value === tab,
  }));

  return (
    <Container className="pb-16">
      <PageHeader
        back={{ href: "/ics", label: "Voltar para o Explorar ICs" }}
        eyebrow="Explorar ICs"
        title="Minhas candidaturas e vagas"
        description="Acompanhe as vagas em que você se candidatou e as que você publicou."
        actions={
          canPublish && (
            <ButtonLink href="/ics/nova">
              <Plus aria-hidden="true" />
              Publicar oportunidade
            </ButtonLink>
          )
        }
      >
        <TabNav label="Seções de minhas candidaturas e vagas" items={tabs} />
      </PageHeader>

      {notice && (
        <Alert variant={notice.variant} title={notice.title} className="mb-2">
          {notice.body}
        </Alert>
      )}

      <Section spacing="sm" aria-labelledby="minhas-lista">
        <h2 id="minhas-lista" className="sr-only">
          {MY_TAB_LABELS[tab]}
        </h2>

        {tab === "candidaturas" ? (
          !applications.ok ? (
            <Alert variant="danger" title="Não conseguimos carregar suas candidaturas agora.">
              Atualize a página em instantes.
            </Alert>
          ) : applications.items.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              headingLevel="h3"
              title="Você ainda não se candidatou a nenhuma vaga"
              description="Encontre vagas de iniciação científica, IC Júnior, TCC e extensão para a sua etapa e candidate-se com uma carta de apresentação."
              action={
                <ButtonLink href="/ics">
                  <Search aria-hidden="true" />
                  Explorar vagas
                </ButtonLink>
              }
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-fg-muted" aria-live="polite">
                {pluralize(applications.total, "candidatura", "candidaturas")}
              </p>
              <ul className="grid gap-4">
                {applications.items.map((application) => (
                  <MyApplicationCard key={application.id} application={application} now={now} />
                ))}
              </ul>
            </>
          )
        ) : !opportunities.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar suas vagas agora.">
            Atualize a página em instantes.
          </Alert>
        ) : opportunities.items.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            headingLevel="h3"
            title="Você ainda não publicou vagas"
            description={
              canPublish
                ? "Tem um projeto procurando estudantes? Publique uma oportunidade: as candidaturas chegam por aqui, com notificação."
                : "Vagas são publicadas por pesquisadoras do mestrado em diante. Se a sua etapa mudou, atualize o seu perfil."
            }
            action={
              canPublish ? (
                <ButtonLink href="/ics/nova">
                  <Plus aria-hidden="true" />
                  Publicar oportunidade
                </ButtonLink>
              ) : (
                <ButtonLink href="/ics">Explorar vagas</ButtonLink>
              )
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-fg-muted">
              {pluralize(opportunities.total, "vaga publicada", "vagas publicadas")}
            </p>
            <ul className="grid gap-4">
              {opportunities.items.map((opportunity) => (
                <MyOpportunityCard key={opportunity.id} opportunity={opportunity} now={now} />
              ))}
            </ul>
          </>
        )}
      </Section>
    </Container>
  );
}
