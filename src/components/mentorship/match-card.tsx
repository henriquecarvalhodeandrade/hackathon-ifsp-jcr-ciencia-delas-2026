import {
  Footprints,
  HeartHandshake,
  Hourglass,
  MessageCircle,
  Orbit,
  Sparkles,
} from "lucide-react";
import { Avatar, Badge, Button, ButtonLink, Card, Chip, ScoreMeter } from "@/components/ui";
import { tabHref } from "@/lib/mentorship/presentation";
import type { MatchCardData } from "@/lib/mentorship/view-models";
import { pluralize } from "@/lib/utils";
import { RequestMentorshipDialog } from "./request-dialog";
import { personMeta } from "./person-summary";

/**
 * Cartão de sugestão de mentora (padrão "Sugestão de mentoria" do design system):
 * afinidade em órbita, "Por que ela?" sinalizando a origem (IA ou afinidade), interesses e
 * trajetória em comum, perguntas para puxar conversa e a ação "Pedir mentoria".
 */
export function MatchCard({ match }: { match: MatchCardData }) {
  const headingId = `sugestao-${match.mentorId}`;
  const meta = personMeta({
    career_stage: null,
    institution: match.institution,
    state: match.state,
  });

  return (
    <Card as="article" aria-labelledby={headingId} className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Avatar menor no celular: o medidor de afinidade divide a linha com o nome. */}
        <Avatar
          name={match.name}
          src={match.avatarUrl}
          seed={match.mentorId}
          size="md"
          className="sm:hidden"
        />
        <Avatar
          name={match.name}
          src={match.avatarUrl}
          seed={match.mentorId}
          size="lg"
          className="hidden sm:inline-flex"
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 id={headingId} className="font-display text-lg leading-snug font-semibold text-fg">
            {match.name}
          </h3>
          {match.headline && <p className="line-clamp-2 text-sm text-fg-muted">{match.headline}</p>}
          {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="primary">Mentora</Badge>
            {match.careerStage && <Badge variant="outline">{match.careerStage}</Badge>}
            {match.openSlots !== null && match.openSlots > 0 && (
              <Badge variant="success">
                {pluralize(match.openSlots, "vaga aberta", "vagas abertas")}
              </Badge>
            )}
          </div>
        </div>
        <ScoreMeter value={match.score} size="sm" label={`Afinidade com ${match.name}`} />
      </div>

      <div className="rounded-control bg-surface-2 p-3.5 text-[0.9375rem] text-fg-muted">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-info uppercase">
          {match.source === "ai" ? (
            <Sparkles aria-hidden="true" className="size-3.5" />
          ) : (
            <Orbit aria-hidden="true" className="size-3.5" />
          )}
          Por que ela? · {match.sourceLabel}
        </p>
        <p>{match.reason}</p>
        {match.source === "ai" && (
          <p className="mt-2 text-xs text-fg-subtle">
            Texto gerado por IA a partir das áreas e temas dos perfis. Revise antes de enviar o
            pedido.
          </p>
        )}
      </div>

      {(match.sharedAreas.length > 0 ||
        match.sharedTopics.length > 0 ||
        match.sharedTrajectory.length > 0 ||
        match.otherTopics.length > 0) && (
        <dl className="grid gap-2.5 text-sm">
          {(match.sharedAreas.length > 0 || match.sharedTopics.length > 0) && (
            <div className="grid gap-1.5">
              <dt className="font-semibold text-fg">Em comum com você</dt>
              <dd className="flex flex-wrap gap-1.5">
                {match.sharedAreas.map((area) => (
                  <Chip key={`a-${area}`} size="sm" variant="primary">
                    {area}
                  </Chip>
                ))}
                {match.sharedTopics.map((topic) => (
                  <Chip key={`t-${topic}`} size="sm" variant="secondary">
                    {topic}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
          {match.sharedTrajectory.length > 0 && (
            <div className="grid gap-1.5">
              <dt className="flex items-center gap-1.5 font-semibold text-fg">
                <Footprints aria-hidden="true" className="size-4 text-accent-strong" />
                Em comum na trajetória
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {match.sharedTrajectory.map((mark) => (
                  <Chip key={`j-${mark}`} size="sm" variant="accent">
                    {mark}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
          {match.otherTopics.length > 0 && (
            <div className="grid gap-1.5">
              <dt className="font-semibold text-fg">Também orienta em</dt>
              <dd className="flex flex-wrap gap-1.5">
                {match.otherTopics.slice(0, 4).map((topic) => (
                  <Chip key={topic} size="sm">
                    {topic}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}

      {match.starters.length > 0 && (
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <MessageCircle aria-hidden="true" className="size-4 text-primary" />
            Para puxar conversa
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
            {match.starters.map((starter) => (
              <li key={starter}>{starter}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <MatchAction match={match} />
        <ButtonLink href={`/pesquisadoras/${match.mentorId}`} variant="ghost">
          Ver perfil
        </ButtonLink>
      </div>
    </Card>
  );
}

function MatchAction({ match }: { match: MatchCardData }) {
  if (match.requestStatus === "pending") {
    return (
      <>
        <Badge variant="warning" size="md">
          <Hourglass aria-hidden="true" />
          Pedido enviado
        </Badge>
        <ButtonLink href={tabHref("enviadas")} variant="link" size="sm">
          Ver pedido
        </ButtonLink>
      </>
    );
  }
  if (match.requestStatus === "accepted") {
    return (
      <>
        <Badge variant="success" size="md">
          <HeartHandshake aria-hidden="true" />
          Mentoria ativa
        </Badge>
        <ButtonLink href={tabHref("ativas")} variant="link" size="sm">
          Ver mentoria
        </ButtonLink>
      </>
    );
  }
  if (!match.canRequest) {
    return (
      <div className="grid gap-1">
        <Button disabled>
          <HeartHandshake aria-hidden="true" />
          Pedir mentoria
        </Button>
        {match.unavailableReason && (
          <p className="text-sm text-fg-subtle">{match.unavailableReason}</p>
        )}
      </div>
    );
  }
  return (
    <RequestMentorshipDialog
      mentorId={match.mentorId}
      mentorName={match.name}
      starters={match.starters}
    />
  );
}
