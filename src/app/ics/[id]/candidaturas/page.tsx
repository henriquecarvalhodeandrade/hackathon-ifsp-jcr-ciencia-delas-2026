import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inbox, Share2 } from "lucide-react";
import { ReceivedApplicationCard } from "@/components/opportunities/received-application-card";
import { OpportunityStateBadge } from "@/components/opportunities/status-badges";
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
import {
  RECEIVED_FILTER_LABELS,
  RECEIVED_FILTERS,
  opportunityKindLabel,
} from "@/lib/opportunities/labels";
import { isUuid, parseReceivedFilter, receivedFilterHref } from "@/lib/opportunities/params";
import { deadlineLabel, opportunityState } from "@/lib/opportunities/presentation";
import { getOpportunity, listReceivedApplications } from "@/lib/opportunities/queries";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Candidaturas recebidas",
  robots: { index: false },
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReceivedApplicationsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const me = await requireOnboardedProfile(`/ics/${id}/candidaturas`);

  const opportunity = await getOpportunity(id);
  // Só a dona vê as candidaturas; para as demais pessoas a página "não existe".
  if (!opportunity || opportunity.owner_id !== me.id) notFound();

  const filter = parseReceivedFilter((await searchParams).status);
  const result = await listReceivedApplications(opportunity.id);
  const now = new Date();

  const counts = new Map<string, number>();
  for (const application of result.items) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  }
  const visible =
    filter === "todas" ? result.items : result.items.filter((a) => a.status === filter);
  const tabs = RECEIVED_FILTERS.filter(
    (f) => f === "todas" || f === filter || (counts.get(f) ?? 0) > 0,
  ).map((f) => ({
    href: receivedFilterHref(opportunity.id, f),
    label: RECEIVED_FILTER_LABELS[f],
    count: f === "todas" ? result.items.length : (counts.get(f) ?? 0),
    active: f === filter,
  }));

  return (
    <Container className="pb-16">
      <PageHeader
        back={{ href: `/ics/${opportunity.id}`, label: "Voltar para a vaga", preferHistory: true }}
        eyebrow={`Candidaturas · ${opportunityKindLabel(opportunity.kind)}`}
        title={opportunity.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <OpportunityStateBadge state={opportunityState(opportunity, now)} />
            <span className="text-base">{deadlineLabel(opportunity, now)}</span>
          </span>
        }
        actions={
          <ButtonLink href={`/ics/${opportunity.id}/editar`} variant="outline">
            Editar vaga
          </ButtonLink>
        }
      >
        {result.ok && result.items.length > 0 && (
          <TabNav label="Filtrar candidaturas por status" items={tabs} />
        )}
      </PageHeader>

      <Section spacing="sm" aria-labelledby="lista-candidaturas">
        <h2 id="lista-candidaturas" className="sr-only">
          {RECEIVED_FILTER_LABELS[filter]} —{" "}
          {pluralize(visible.length, "candidatura", "candidaturas")}
        </h2>
        {!result.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar as candidaturas agora.">
            Atualize a página em instantes.
          </Alert>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            headingLevel="h3"
            title="Nenhuma candidatura ainda"
            description="Quando alguém se candidatar, a candidatura aparece aqui e você recebe uma notificação. Divulgue o link da vaga para quem pode se interessar."
            action={
              <ButtonLink href={`/ics/${opportunity.id}`}>
                <Share2 aria-hidden="true" />
                Ver a página da vaga
              </ButtonLink>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            headingLevel="h3"
            title={`Nenhuma candidatura em “${RECEIVED_FILTER_LABELS[filter]}”`}
            description="Veja todas as candidaturas desta vaga."
            action={
              <ButtonLink href={receivedFilterHref(opportunity.id, "todas")}>Ver todas</ButtonLink>
            }
          />
        ) : (
          <ul className="grid gap-4">
            {visible.map((application) => (
              <ReceivedApplicationCard key={application.id} application={application} />
            ))}
          </ul>
        )}
      </Section>
    </Container>
  );
}
