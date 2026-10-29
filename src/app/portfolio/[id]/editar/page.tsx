import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { getOwnPortfolioItem } from "@/lib/portfolio/queries";
import { portfolioToFormValues } from "@/lib/portfolio/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Editar item do portfólio",
  robots: { index: false },
};

type Params = Promise<{ id: string }>;

const itemId = z.guid();

export default async function EditPortfolioItemPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!itemId.safeParse(id).success) notFound();
  const profile = await requireOnboardedProfile(`/portfolio/${id}/editar`);

  const supabase = await createClient();
  const item = await getOwnPortfolioItem(supabase, id, profile.id);
  // Só a dona edita; para as demais pessoas (ou item apagado) a página "não existe".
  if (!item) notFound();

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: `/portfolio#item-${item.id}`, label: "Voltar para o portfólio" }}
        eyebrow="Portfólio"
        title="Editar item"
        description="As mudanças aparecem no seu perfil assim que você salvar. Publicações do feed que mostram este item passam a mostrar a versão nova."
      />
      <PortfolioForm
        mode="edit"
        itemId={item.id}
        initialValues={portfolioToFormValues(item)}
        cancelHref={`/portfolio#item-${item.id}`}
      />
    </Container>
  );
}
