import type { Metadata } from "next";
import { PaperForm } from "@/components/papers/paper-form";
import { Container, PageHeader } from "@/components/ui";
import { isAiEnabled } from "@/lib/ai";
import { requireOnboardedProfile } from "@/lib/auth";
import { getResearchAreas } from "@/lib/papers/queries";
import { EMPTY_PAPER_VALUES } from "@/lib/papers/schema";
import { normalizeOrcid } from "@/lib/profile/links";

export const metadata: Metadata = {
  title: "Divulgar um paper",
  robots: { index: false },
};

export default async function NewPaperPage() {
  const profile = await requireOnboardedProfile("/papers/novo");
  const areas = await getResearchAreas();
  // Perfis antigos podem ter o ORCID salvo como URL: o painel recebe só o iD canônico.
  const savedOrcid = profile.orcid ? normalizeOrcid(profile.orcid) : null;

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: "/papers", label: "Voltar para a Vitrine" }}
        eyebrow="Vitrine Delas"
        title="Divulgar um paper"
        description="Indique um trabalho com autoria de mulheres — seu ou de outra pesquisadora. Ele aparece na Vitrine, pode receber destaques e entrar no boletim semanal."
      />
      <PaperForm
        mode="create"
        initialValues={EMPTY_PAPER_VALUES}
        areas={areas}
        aiEnabled={isAiEnabled()}
        cancelHref="/papers"
        orcidImport={{ defaultOrcid: savedOrcid?.ok ? savedOrcid.value : "" }}
      />
    </Container>
  );
}
