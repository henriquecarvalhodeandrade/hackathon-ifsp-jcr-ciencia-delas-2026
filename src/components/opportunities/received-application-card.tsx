import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar, ButtonLink, Card } from "@/components/ui";
import { firstName } from "@/lib/mentorship/presentation";
import { careerStageLabel } from "@/lib/mentorship/view-models";
import { locationLabel } from "@/lib/opportunities/presentation";
import type { ReceivedApplication } from "@/lib/opportunities/types";
import { AcademicLinks } from "./academic-links";
import { QuotedMessage } from "./quoted-message";
import { RespondApplicationForm } from "./respond-form";
import { ApplicationStatusBadge } from "./status-badges";
import { TimeAgo } from "./time-ago";

/**
 * Candidatura recebida (dona da vaga): quem é a candidata (→ perfil), a carta, o status e as
 * decisões. Aprovada, a conversa direta já está aberta — o atalho leva até ela.
 */
export function ReceivedApplicationCard({ application }: { application: ReceivedApplication }) {
  const person = application.applicant;
  const fullName = person?.full_name || "Candidata";
  const name = firstName(fullName) || fullName;
  const headingId = `candidatura-${application.id}`;
  const meta = person
    ? [
        careerStageLabel(person.career_stage),
        person.institution,
        locationLabel(person.city, person.state),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Avatar name={fullName} src={person?.avatar_url} seed={person?.id ?? application.id} />
          <div className="grid min-w-0 gap-0.5">
            <h3 id={headingId} className="font-display text-lg leading-snug font-semibold text-fg">
              {person ? (
                <Link
                  href={`/pesquisadoras/${person.id}`}
                  className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
                >
                  {fullName}
                </Link>
              ) : (
                fullName
              )}
            </h3>
            {person?.headline && (
              <p className="line-clamp-2 text-sm text-fg-muted">{person.headline}</p>
            )}
            {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <ApplicationStatusBadge status={application.status} viewer="owner" />
          <TimeAgo date={application.created_at} prefix="Recebida" />
        </div>
      </div>

      {person && (
        <AcademicLinks lattes_url={person.lattes_url} orcid={person.orcid} viewer="other" />
      )}

      <QuotedMessage label="Carta de apresentação">{application.message}</QuotedMessage>

      {application.status === "withdrawn" ? (
        <p className="border-t border-border pt-4 text-sm text-fg-muted">
          {name} desistiu desta candidatura.
        </p>
      ) : (
        <div className="grid gap-4 border-t border-border pt-4">
          {application.status === "accepted" && person && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-success-soft p-3.5 text-success-soft-fg">
              <p className="text-sm font-semibold">
                Aprovada! Combine os próximos passos com {name}.
              </p>
              <ButtonLink href={`/mensagens?com=${person.id}`} variant="secondary" size="sm">
                <MessageCircle aria-hidden="true" />
                Mandar mensagem
              </ButtonLink>
            </div>
          )}
          <RespondApplicationForm
            applicationId={application.id}
            opportunityId={application.opportunity_id}
            status={application.status}
            applicantName={name}
            currentNote={application.owner_note}
          />
        </div>
      )}
    </Card>
  );
}
