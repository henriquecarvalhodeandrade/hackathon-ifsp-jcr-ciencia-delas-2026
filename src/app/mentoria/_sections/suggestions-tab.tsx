import { HeartHandshake, Telescope, Users } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { AiConsentCard } from "@/components/mentorship/ai-consent-card";
import { DeepLinkCard } from "@/components/mentorship/deep-link-card";
import { FindMentorsPanel } from "@/components/mentorship/find-mentors-panel";
import { MatchCard } from "@/components/mentorship/match-card";
import type { Profile } from "@/lib/auth";
import type { MentorshipStatus } from "@/lib/constants";
import { getMySavedSuggestions } from "@/lib/matching/service";
import { suggestionSourceLabel } from "@/lib/mentorship/presentation";
import {
  loadAreaIdsByProfile,
  loadCandidateAvailability,
  loadDeepLinkMentor,
  type RequestItem,
  type ServerClient,
} from "@/lib/mentorship/queries";
import { buildMatchCards, resolveDeepLink } from "@/lib/mentorship/view-models";
import { formatRelativeTime } from "@/lib/utils";

interface SuggestionsTabProps {
  supabase: ServerClient;
  profile: Profile;
  sent: readonly RequestItem[];
  areaNames: ReadonlyMap<number, string>;
  deepLinkId: string | null;
}

function openRequestsByMentor(sent: readonly RequestItem[]): Map<string, MentorshipStatus> {
  const map = new Map<string, MentorshipStatus>();
  for (const r of sent) {
    if (r.status === "pending" || r.status === "accepted") map.set(r.other.id, r.status);
  }
  return map;
}

export async function SuggestionsTab({
  supabase,
  profile,
  sent,
  areaNames,
  deepLinkId,
}: SuggestionsTabProps) {
  const openRequests = openRequestsByMentor(sent);
  const canMatch = profile.seeks_mentorship && profile.ai_consent;
  const needsCandidates = Boolean(deepLinkId) || canMatch;

  const [candidates, deepLinkMentor] = await Promise.all([
    needsCandidates ? loadCandidateAvailability(supabase) : Promise.resolve(null),
    deepLinkId ? loadDeepLinkMentor(supabase, deepLinkId) : Promise.resolve(null),
  ]);

  const deepLink = deepLinkId ? (
    <DeepLinkCard
      mentor={deepLinkMentor}
      state={resolveDeepLink({
        mentor: deepLinkMentor,
        viewerId: profile.id,
        candidates,
        openRequests,
      })}
    />
  ) : null;

  if (!profile.seeks_mentorship) {
    return (
      <div className="grid gap-6">
        {deepLink}
        <EmptyState
          icon={<HeartHandshake />}
          title="Quer receber sugestões de mentoras?"
          description={
            profile.is_mentor
              ? "Você está como mentora. Se também quiser ser mentorada, ative “Quero ser mentorada” no seu perfil e conte o que você busca."
              : "Ative “Quero ser mentorada” no seu perfil e conte o que você busca. Com isso, sugerimos mentoras com vagas abertas que combinam com você."
          }
          action={
            <>
              <ButtonLink href="/perfil">Ativar no meu perfil</ButtonLink>
              <ButtonLink href="/pesquisadoras?mentoras=1" variant="outline">
                <Users aria-hidden="true" />
                Explorar mentoras
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  if (!profile.ai_consent) {
    return (
      <div className="grid gap-6">
        {deepLink}
        <AiConsentCard />
      </div>
    );
  }

  const [saved, myAreas] = await Promise.all([
    getMySavedSuggestions({ supabase, userId: profile.id }),
    loadAreaIdsByProfile(supabase, [profile.id]),
  ]);

  const cards = saved
    ? buildMatchCards(saved.suggestions, {
        menteeAreaIds: myAreas.get(profile.id) ?? [],
        menteeTopics: profile.mentorship_topics ?? [],
        areaNames,
        model: saved.model,
        candidates,
        openRequests,
      })
    : [];

  const summary = saved
    ? `Geradas ${formatRelativeTime(saved.generatedAt)} · ${suggestionSourceLabel(saved.source, saved.model)}. Atualize depois de mudar seu perfil.`
    : undefined;

  return (
    <div className="grid gap-6">
      {deepLink}
      <FindMentorsPanel hasSuggestions={cards.length > 0} summary={summary}>
        {cards.length > 0 ? (
          <ul aria-label="Sugestões de mentoras" className="grid gap-5 lg:grid-cols-2">
            {cards.map((match) => (
              <li key={match.mentorId} className="grid">
                <MatchCard match={match} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            headingLevel="h3"
            icon={<Telescope />}
            title="Ainda não buscamos mentoras para você"
            description="Clique em “Encontrar mentoras”: comparamos suas áreas, temas e etapa da carreira com as mentoras que têm vagas. Quanto mais completo o seu perfil, melhores as sugestões."
            action={
              <ButtonLink href="/perfil" variant="outline">
                Revisar meu perfil
              </ButtonLink>
            }
          />
        )}
      </FindMentorsPanel>
    </div>
  );
}
