import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { BR_STATES, CAREER_STAGES, type BrState, type CareerStage } from "@/lib/constants";
import type { NetworkPerson } from "@/lib/network/queries";
import { cn } from "@/lib/utils";

/** "Graduação · IFSP · SP" (só o que existir). */
export function personMeta(
  person: Pick<NetworkPerson, "career_stage" | "institution" | "state">,
): string {
  const stage = person.career_stage
    ? (CAREER_STAGES[person.career_stage as CareerStage]?.label ?? null)
    : null;
  const state = person.state && person.state in BR_STATES ? (person.state as BrState) : null;
  return [stage, person.institution, state].filter(Boolean).join(" · ");
}

export interface PersonCardProps {
  person: NetworkPerson;
  /** Id do título (o cartão é rotulado por ele). */
  headingId: string;
  /** Linha de contexto abaixo do nome (motivo da sugestão, "Conectadas desde…"). */
  detail?: React.ReactNode;
  /** Conteúdo do corpo (ex.: recado do convite). */
  children?: React.ReactNode;
  /** Botões do rodapé. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cartão de pessoa das listas da /rede: avatar, nome (link para o perfil), título, etapa ·
 * instituição · UF, uma linha de contexto e as ações. Sem link esticado: o cartão tem vários
 * botões, então só o nome leva ao perfil.
 */
export function PersonCard({
  person,
  headingId,
  detail,
  children,
  actions,
  className,
}: PersonCardProps) {
  const meta = personMeta(person);
  return (
    <Card
      as="li"
      aria-labelledby={headingId}
      padding="md"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <Avatar name={person.full_name} src={person.avatar_url} seed={person.id} size="lg" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3
            id={headingId}
            className="font-display text-lg leading-snug font-semibold break-words text-fg"
          >
            <Link
              href={`/pesquisadoras/${person.id}`}
              className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
            >
              {person.full_name}
            </Link>
          </h3>
          {person.headline && (
            <p className="line-clamp-2 text-sm text-fg-muted">{person.headline}</p>
          )}
          {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
          {detail && <div className="mt-1 text-sm text-fg-muted">{detail}</div>}
        </div>
      </div>
      {children}
      {actions && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {actions}
        </div>
      )}
    </Card>
  );
}
