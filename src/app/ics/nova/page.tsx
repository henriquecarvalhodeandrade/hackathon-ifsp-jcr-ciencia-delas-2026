import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { canPublishOpportunities } from "@/lib/opportunities/labels";
import { todayInSaoPaulo } from "@/lib/opportunities/presentation";
import { newOpportunityValues } from "@/lib/opportunities/schema";
import { getResearchAreas } from "@/lib/papers/queries";

export const metadata: Metadata = {
  title: "Publicar oportunidade",
  robots: { index: false },
};

export default async function NewOpportunityPage() {
  const profile = await requireOnboardedProfile("/ics/nova");

  const header = (
    <PageHeader
      back={{ href: "/ics", label: "Voltar para o Explorar ICs" }}
      eyebrow="Explorar ICs"
      title="Publicar oportunidade"
      description="Abra uma vaga de iniciação científica, IC Júnior, TCC, extensão ou voluntariado. As estudantes se candidatam com uma carta, e você responde por aqui."
    />
  );

  // A regra é do banco (CD070); aqui ela só explica, em vez de deixar preencher à toa.
  if (!canPublishOpportunities(profile.career_stage)) {
    return (
      <Container size="narrow" className="pb-16">
        {header}
        <EmptyState
          icon={<GraduationCap />}
          headingLevel="h2"
          title="Vagas são publicadas por pesquisadoras do mestrado em diante"
          description="Assim quem se candidata sabe que vai ter orientação. Enquanto isso, explore as vagas abertas — e, se a sua etapa mudou, atualize o seu perfil."
          action={
            <>
              <ButtonLink href="/perfil" variant="outline">
                Atualizar meu perfil
              </ButtonLink>
              <ButtonLink href="/ics">Ver vagas abertas</ButtonLink>
            </>
          }
        />
      </Container>
    );
  }

  const areas = await getResearchAreas();
  return (
    <Container size="narrow" className="pb-16">
      {header}
      <OpportunityForm
        mode="create"
        initialValues={newOpportunityValues(profile)}
        areas={areas}
        cancelHref="/ics"
        today={todayInSaoPaulo()}
      />
    </Container>
  );
}
