import {
  CalendarClock,
  CircleCheck,
  Clock,
  GraduationCap,
  MapPin,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Card, CardLink } from "@/components/ui";
import { opportunityKindLabel, type ApplicationStatus } from "@/lib/opportunities/labels";
import {
  applicationCountLabel,
  deadlineLabel,
  locationLabel,
  modalityLabel,
  opportunityState,
  vacanciesLabel,
  weeklyHoursLabel,
} from "@/lib/opportunities/presentation";
import type { OpportunityListItem } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

export interface OpportunityCardProps {
  opportunity: OpportunityListItem;
  /** Status da candidatura da usuária nesta vaga (selo "Você se candidatou"). */
  myApplication?: ApplicationStatus | null;
  /** É a própria usuária quem publicou (selo "Sua vaga"). */
  isOwn?: boolean;
  headingLevel?: "h2" | "h3";
  now?: Date;
  className?: string;
}

function Fact({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-1.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/** Vaga no Explorar ICs: tipo, título, quem publicou, condições e prazo. */
export function OpportunityCard({
  opportunity: o,
  myApplication = null,
  isOwn = false,
  headingLevel: Heading = "h3",
  now = new Date(),
  className,
}: OpportunityCardProps) {
  const state = opportunityState(o, now);
  const place = locationLabel(o.city, o.state);
  const modality = modalityLabel(o.modality);
  const hours = weeklyHoursLabel(o.weekly_hours);
  const institution = o.institution || o.owner?.institution;

  return (
    <Card
      as="article"
      variant="interactive"
      className={cn("flex h-full flex-col gap-3 p-4 sm:p-5", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">
          <GraduationCap aria-hidden="true" />
          {opportunityKindLabel(o.kind)}
        </Badge>
        {o.has_scholarship && (
          <Badge variant="success">
            <Wallet aria-hidden="true" />
            Com bolsa
          </Badge>
        )}
        {o.area && <Badge variant="outline">{o.area.name}</Badge>}
        {isOwn && <Badge variant="secondary">Sua vaga</Badge>}
        {myApplication && myApplication !== "withdrawn" && (
          <Badge variant="info">
            <CircleCheck aria-hidden="true" />
            Você se candidatou
          </Badge>
        )}
        {myApplication === "withdrawn" && (
          <Badge variant="neutral">
            <Undo2 aria-hidden="true" />
            Você desistiu
          </Badge>
        )}
      </div>

      <div className="grid gap-1">
        <Heading className="font-display text-lg leading-snug font-semibold text-pretty break-words text-fg">
          <CardLink href={`/ics/${o.id}`}>{o.title}</CardLink>
        </Heading>
        <p className="text-sm text-fg-muted">
          <span className="font-semibold text-fg">{o.owner?.full_name || "Pesquisadora"}</span>
          {institution && <span> · {institution}</span>}
        </p>
      </div>

      <ul className="grid gap-1.5 text-sm text-fg-muted sm:grid-cols-2">
        {(modality || place) && (
          <Fact icon={MapPin}>{[modality, place].filter(Boolean).join(" · ")}</Fact>
        )}
        {hours && <Fact icon={Clock}>{hours}</Fact>}
        <Fact icon={Users}>{vacanciesLabel(o.vacancies)}</Fact>
        {o.has_scholarship && o.scholarship_info && (
          <Fact icon={Wallet}>
            <span className="sr-only">Bolsa: </span>
            {o.scholarship_info}
          </Fact>
        )}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-semibold",
            state === "open" ? "text-fg" : "text-fg-subtle",
          )}
        >
          <CalendarClock aria-hidden="true" className="size-4" />
          {deadlineLabel(o, now)}
        </span>
        <span className="text-fg-subtle">{applicationCountLabel(o.application_count)}</span>
      </div>
    </Card>
  );
}
