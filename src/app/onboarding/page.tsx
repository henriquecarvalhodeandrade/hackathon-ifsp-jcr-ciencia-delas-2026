import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/profile/onboarding-wizard";
import { Alert } from "@/components/ui/alert";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { groupAreas } from "@/lib/profile/areas";
import { profileToFormValues } from "@/lib/profile/form-values";
import { getProfileAreaIds, getResearchAreas } from "@/lib/profile/queries";
import { safeNextPath } from "@/lib/profile/redirect";

export const metadata: Metadata = {
  title: "Complete seu perfil",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/onboarding");
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = rawNext ? safeNextPath(rawNext, "") || null : null;

  const profile = await getCurrentProfile();
  if (profile?.onboarded_at) redirect(next && !next.startsWith("/onboarding") ? next : "/perfil");

  if (!profile) {
    return (
      <Container size="narrow" className="py-10">
        <h1 className="sr-only">Complete seu perfil</h1>
        <Alert variant="danger" title="Não encontramos o seu perfil">
          Isso não deveria acontecer. Saia e entre de novo; se continuar, avise a equipe pela página
          Sobre.
        </Alert>
      </Container>
    );
  }

  const [areas, areaIds] = await Promise.all([getResearchAreas(), getProfileAreaIds(profile.id)]);
  const values = profileToFormValues(profile, areaIds);
  const initialStep =
    !values.full_name.trim() || !values.career_stage ? 1 : areaIds.length === 0 ? 2 : 3;
  const firstName = values.full_name.trim().split(/\s+/)[0];

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        eyebrow="Boas-vindas"
        title={
          firstName ? `Bem-vinda à Ciência Delas, ${firstName}!` : "Bem-vinda à Ciência Delas!"
        }
        description="Conte um pouco sobre você e sua pesquisa para encontrarmos mentoras e conexões. Leva uns 5 minutos — e dá para mudar tudo depois, no seu perfil."
      />
      <OnboardingWizard
        initialValues={values}
        areaGroups={groupAreas(areas)}
        next={next}
        initialStep={initialStep}
      />
    </Container>
  );
}
