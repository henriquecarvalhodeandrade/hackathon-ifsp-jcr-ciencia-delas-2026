import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { getLandingData } from "@/components/landing/data";
import { FeaturedPapers } from "@/components/landing/featured-papers";
import { firstName } from "@/components/landing/featured";
import { HackathonCredit } from "@/components/landing/hackathon-credit";
import { LandingHero, type LandingViewer } from "@/components/landing/hero";
import { MentorshipSteps } from "@/components/landing/mentorship-steps";
import { NewsletterCta } from "@/components/landing/newsletter-cta";
import { Pillars } from "@/components/landing/pillars";
import { LandingStats } from "@/components/landing/platform-stats";
import { WhySection } from "@/components/landing/why-section";
import { getCurrentProfile } from "@/lib/auth";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  // A home usa o título completo (sem o template "· Artemis").
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `?visao=publica`: quem já é membra pode rever a página pública (link no rodapé do /painel). */
const PUBLIC_VIEW_PARAM = "visao";
const PUBLIC_VIEW_VALUE = "publica";

async function loadViewer(): Promise<LandingViewer | null> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return null;
    return {
      firstName: firstName(profile.full_name),
      onboarded: Boolean(profile.onboarded_at),
      seeksMentorship: profile.seeks_mentorship,
      isMentor: profile.is_mentor,
    };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = params[PUBLIC_VIEW_PARAM];
  const wantsPublicView = (Array.isArray(view) ? view[0] : view) === PUBLIC_VIEW_VALUE;

  // Membra com perfil completo não precisa ver a apresentação de novo: o início dela é o
  // /painel. A checagem vem ANTES de carregar os dados da landing (e fora do try/catch).
  const viewer = await loadViewer();
  if (viewer?.onboarded && !wantsPublicView) redirect("/painel");

  const data = await getLandingData();
  return (
    <>
      <LandingHero viewer={viewer} />
      <LandingStats stats={data.stats} />
      <WhySection />
      <Pillars />
      <MentorshipSteps viewer={viewer} />
      <FeaturedPapers papers={data.papers} period={data.papersPeriod} />
      <NewsletterCta latestEdition={data.latestEdition} />
      <HackathonCredit />
    </>
  );
}
