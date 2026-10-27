import type { Metadata } from "next";
import { PaperForm } from "@/components/papers/paper-form";
import { Container, PageHeader } from "@/components/ui";
import { isAiEnabled } from "@/lib/ai";
import { requireOnboardedProfile } from "@/lib/auth";
import { getResearchAreas } from "@/lib/papers/queries";
import { EMPTY_PAPER_VALUES } from "@/lib/papers/schema";

export const metadata: Metadata = {
  title: "Divulgar um paper",
  robots: { index: false },
};

export default async function NewPaperPage() {
  await requireOnboardedProfile("/papers/novo");
  const areas = await getResearchAreas();

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
      />
    </Container>
  );
}
