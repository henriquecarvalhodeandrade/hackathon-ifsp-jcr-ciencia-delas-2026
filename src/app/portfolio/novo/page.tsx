import type { Metadata } from "next";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { EMPTY_PORTFOLIO_VALUES } from "@/lib/portfolio/schema";

export const metadata: Metadata = {
  title: "Adicionar ao portfólio",
  robots: { index: false },
};

export default async function NewPortfolioItemPage() {
  await requireOnboardedProfile("/portfolio/novo");
  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: "/portfolio", label: "Voltar para o portfólio" }}
        eyebrow="Portfólio"
        title="Adicionar ao portfólio"
        description="Artigo, projeto, apresentação, pôster, TCC, prêmio ou curso: conte o que você fez. O item aparece no seu perfil para as membras da Artemis."
      />
      <PortfolioForm mode="create" initialValues={EMPTY_PORTFOLIO_VALUES} />
    </Container>
  );
}
