import Link from "next/link";
import { CalendarClock, MessageCircle, Pencil, Users } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { firstName } from "@/lib/mentorship/presentation";
import { opportunityKindLabel } from "@/lib/opportunities/labels";
import {
  applicationCountLabel,
  deadlineLabel,
  opportunityState,
} from "@/lib/opportunities/presentation";
import type { MyApplicationItem, MyOpportunityItem } from "@/lib/opportunities/types";
import { formatNumber, pluralize } from "@/lib/utils";
import { applicantStatusText } from "./my-application";
import { QuotedMessage } from "./quoted-message";
import { ApplicationStatusBadge, OpportunityStateBadge } from "./status-badges";
import { TimeAgo } from "./time-ago";

/** Uma candidatura da usuária (/ics/minhas): a vaga, o status e o próximo passo. */
export function MyApplicationCard({
  application,
  now = new Date(),
}: {
  application: MyApplicationItem;
  now?: Date;
}) {
  const o = application.opportunity;
  const headingId = `minha-candidatura-${application.id}`;
  const ownerFull = o?.owner?.full_name || "a pesquisadora";
  const ownerName = firstName(ownerFull) || ownerFull;
  const OwnerName = ownerName[0]!.toUpperCase() + ownerName.slice(1);

  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-3 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 gap-1">
          {o && <p className="eyebrow text-primary">{opportunityKindLabel(o.kind)}</p>}
          <h3 id={headingId} className="font-display text-lg leading-snug font-semibold text-fg">
            {o ? (
              <Link
                href={`/ics/${o.id}`}
                className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
              >
                {o.title}
              </Link>
            ) : (
              "Vaga removida"
            )}
          </h3>
          {o && (
            <p className="text-sm text-fg-muted">
              {ownerFull}
              {o.institution && <> · {o.institution}</>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <ApplicationStatusBadge status={application.status} />
          <TimeAgo date={application.created_at} prefix="Enviada" />
        </div>
      </div>

      <p className="text-[0.9375rem] text-fg-muted">
        {applicantStatusText(application.status, OwnerName)}
      </p>
      {application.owner_note && (
        <QuotedMessage label={`Recado de ${OwnerName}`}>{application.owner_note}</QuotedMessage>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
        {o && (
          <span className="inline-flex items-center gap-1.5 text-fg-subtle">
            <CalendarClock aria-hidden="true" className="size-4" />
            {deadlineLabel(o, now)}
          </span>
        )}
        {application.status === "accepted" && o && (
          <ButtonLink href={`/mensagens?com=${o.owner_id}`} variant="secondary" size="sm">
            <MessageCircle aria-hidden="true" />
            Mande uma mensagem para {OwnerName}
          </ButtonLink>
        )}
        {o && (
          <Link
            href={`/ics/${o.id}#candidatar`}
            className="font-semibold text-primary underline-offset-2 hover:underline sm:ml-auto"
          >
            Ver candidatura
          </Link>
        )}
      </div>
    </Card>
  );
}

/** Uma vaga publicada pela usuária (/ics/minhas?aba=publicadas). */
export function MyOpportunityCard({
  opportunity: o,
  now = new Date(),
}: {
  opportunity: MyOpportunityItem;
  now?: Date;
}) {
  const headingId = `minha-vaga-${o.id}`;
  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-3 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 gap-1">
          <p className="eyebrow text-primary">{opportunityKindLabel(o.kind)}</p>
          <h3 id={headingId} className="font-display text-lg leading-snug font-semibold text-fg">
            <Link
              href={`/ics/${o.id}`}
              className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
            >
              {o.title}
            </Link>
          </h3>
          <p className="inline-flex items-center gap-1.5 text-sm text-fg-subtle">
            <CalendarClock aria-hidden="true" className="size-4" />
            {deadlineLabel(o, now)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <OpportunityStateBadge state={opportunityState(o, now)} />
          {o.new_applications > 0 && (
            <Badge variant="warning" size="md">
              {pluralize(o.new_applications, "candidatura nova", "candidaturas novas")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <ButtonLink href={`/ics/${o.id}/candidaturas`} size="sm">
          <Users aria-hidden="true" />
          Ver candidaturas ({formatNumber(o.application_count)})
        </ButtonLink>
        <ButtonLink href={`/ics/${o.id}/editar`} variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          Editar
        </ButtonLink>
        <span className="text-sm text-fg-subtle sm:ml-auto">
          {applicationCountLabel(o.application_count)} no total
        </span>
      </div>
    </Card>
  );
}
