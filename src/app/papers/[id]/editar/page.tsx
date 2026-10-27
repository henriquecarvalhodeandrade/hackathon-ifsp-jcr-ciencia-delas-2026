import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperForm } from "@/components/papers/paper-form";
import { Container, PageHeader } from "@/components/ui";
import { isAiEnabled } from "@/lib/ai";
import { requireOnboardedProfile } from "@/lib/auth";
import { isUuid } from "@/lib/papers/params";
import { getPaperDetail, getResearchAreas } from "@/lib/papers/queries";
import { paperToFormValues } from "@/lib/papers/schema";

export const metadata: Metadata = {
  title: "Editar paper",
  robots: { index: false },
};

type Params = Promise<{ id: string }>;

export default async function EditPaperPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await requireOnboardedProfile(`/papers/${id}/editar`);

  const [paper, areas] = await Promise.all([getPaperDetail(id), getResearchAreas()]);
  // Só quem enviou edita; para as demais pessoas a página "não existe".
  if (!paper || paper.submitted_by !== profile.id) notFound();

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: `/papers/${paper.id}`, label: "Voltar para o paper" }}
        eyebrow="Vitrine Delas"
        title="Editar paper"
        description="As alterações aparecem na Vitrine assim que você salvar. Destaques e comentários continuam como estão."
      />
      <PaperForm
        mode="edit"
        paperId={paper.id}
        initialValues={paperToFormValues(paper)}
        areas={areas}
        aiEnabled={isAiEnabled()}
        cancelHref={`/papers/${paper.id}`}
      />
    </Container>
  );
}
