import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import {
  DeleteOpportunityButton,
  OpportunityStatusButton,
} from "@/components/opportunities/owner-actions";
import { OpportunityStateBadge } from "@/components/opportunities/status-badges";
import { Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { isUuid } from "@/lib/opportunities/params";
import { opportunityState, todayInSaoPaulo } from "@/lib/opportunities/presentation";
import { getOpportunity, hasOwnFeedPost } from "@/lib/opportunities/queries";
import { opportunityToFormValues } from "@/lib/opportunities/schema";
import { getResearchAreas } from "@/lib/papers/queries";

export const metadata: Metadata = {
  title: "Editar vaga",
  robots: { index: false },
};

type Params = Promise<{ id: string }>;

export default async function EditOpportunityPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await requireOnboardedProfile(`/ics/${id}/editar`);

  const [opportunity, areas] = await Promise.all([getOpportunity(id), getResearchAreas()]);
  // Só quem publicou edita; para as demais pessoas a página "não existe".
  if (!opportunity || opportunity.owner_id !== profile.id) notFound();

  const now = new Date();
  const hasFeedPost = await hasOwnFeedPost(opportunity.id, profile.id);
  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: `/ics/${opportunity.id}`, label: "Voltar para a vaga" }}
        eyebrow="Explorar ICs"
        title="Editar vaga"
        description="As alterações aparecem assim que você salvar. As candidaturas recebidas continuam como estão."
      />

      <div className="grid gap-8">
        <OpportunityForm
          mode="edit"
          opportunityId={opportunity.id}
          initialValues={opportunityToFormValues(opportunity)}
          areas={areas}
          cancelHref={`/ics/${opportunity.id}`}
          today={todayInSaoPaulo(now)}
        />

        <section
          aria-labelledby="situacao-vaga"
          className="grid gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="situacao-vaga" className="font-display text-xl font-semibold text-fg">
              Inscrições e exclusão
            </h2>
            <OpportunityStateBadge state={opportunityState(opportunity, now)} />
          </div>
          <p className="text-[0.9375rem] text-fg-muted">
            Encerrar tira a vaga da lista de vagas abertas sem perder as candidaturas; você pode
            reabrir depois. Excluir apaga a vaga e as candidaturas de vez.
          </p>
          <div className="flex flex-wrap gap-3">
            <OpportunityStatusButton opportunity={opportunity} now={now} />
            <DeleteOpportunityButton
              opportunity={opportunity}
              hasFeedPost={hasFeedPost}
              triggerVariant="outline"
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
