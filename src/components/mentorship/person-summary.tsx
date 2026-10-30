import Link from "next/link";
import { Avatar, type AvatarSize } from "@/components/ui";
import { BR_STATES, type BrState } from "@/lib/constants";
import { careerStageLabel } from "@/lib/mentorship/view-models";
import { cn } from "@/lib/utils";

export interface PersonSummaryData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
}

export function personMeta(
  person: Pick<PersonSummaryData, "career_stage" | "institution" | "state">,
): string {
  const state = person.state ? (BR_STATES[person.state as BrState] ? person.state : null) : null;
  return [careerStageLabel(person.career_stage), person.institution, state]
    .filter(Boolean)
    .join(" · ");
}

/** Avatar + nome (link para o perfil) + título + etapa/instituição/UF. */
export function PersonSummary({
  person,
  size = "md",
  headingLevel: Heading = "h3",
  headingId,
  children,
  className,
}: {
  person: PersonSummaryData;
  size?: Extract<AvatarSize, "md" | "lg">;
  headingLevel?: "h2" | "h3" | "h4";
  headingId?: string;
  /** Selos ao lado do nome (status, papel...). */
  children?: React.ReactNode;
  className?: string;
}) {
  const meta = personMeta(person);
  return (
    <div className={cn("flex min-w-0 items-start gap-3 sm:gap-4", className)}>
      <Avatar name={person.full_name} src={person.avatar_url} seed={person.id} size={size} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Heading id={headingId} className="font-display text-lg leading-snug font-semibold text-fg">
          <Link
            href={`/pesquisadoras/${person.id}`}
            className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
          >
            {person.full_name}
          </Link>
        </Heading>
        {person.headline && <p className="line-clamp-2 text-sm text-fg-muted">{person.headline}</p>}
        {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
        {children && <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>}
      </div>
    </div>
  );
}
