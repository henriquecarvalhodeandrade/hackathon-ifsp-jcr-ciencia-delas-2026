import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
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

export default async function HomePage() {
  const [viewer, data] = await Promise.all([loadViewer(), getLandingData()]);
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
