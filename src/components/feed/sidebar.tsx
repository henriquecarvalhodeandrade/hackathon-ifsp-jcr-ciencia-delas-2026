import Link from "next/link";
import { ArrowRight, CircleAlert, FolderOpen, Settings, Users } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { careerStageLabel } from "@/lib/feed/presentation";
import type {
  ConnectionSuggestion,
  NetworkCounts,
  RecentOpportunity,
  Settled,
} from "@/lib/feed/queries";
import { opportunityKindLabel } from "@/lib/opportunities/labels";
import { formatCompactNumber, pluralize } from "@/lib/utils";

const footerLinkClass =
  "inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline";

/** Um bloco não carregou: aviso calmo no lugar de um "nada aqui" que não seria verdade. */
function Unavailable() {
  return (
    <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-sm text-fg-muted">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>Não conseguimos carregar esta parte agora. Recarregue a página em instantes.</span>
    </p>
  );
}

function SideSection({
  titleId,
  title,
  footer,
  children,
}: {
  titleId: string;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 id={titleId} className="font-display text-lg leading-snug font-semibold text-fg">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coluna esquerda: meu perfil
// ---------------------------------------------------------------------------

export interface ProfileSummaryProps {
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    headline: string | null;
    career_stage: string | null;
  };
  counts: Settled<NetworkCounts>;
}

/** Mini perfil da usuária: foto, nome, título, números da rede e atalhos. */
export function ProfileSummary({ profile, counts }: ProfileSummaryProps) {
  const name = profile.full_name || "Você";
  const subtitle = profile.headline || careerStageLabel(profile.career_stage);
  const stats = counts.ok
    ? [
        { label: "Seguidoras", value: counts.data.followers, href: "/rede?aba=seguidoras" },
        { label: "Seguindo", value: counts.data.following, href: "/rede?aba=seguindo" },
        { label: "Conexões", value: counts.data.connections, href: "/rede?aba=conexoes" },
      ]
    : null;

  return (
    <section
      aria-labelledby="meu-perfil-titulo"
      className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      <div aria-hidden="true" className="h-14 bg-primary-soft" />
      <div className="-mt-8 grid justify-items-center gap-1 px-4 pb-4 text-center">
        <Avatar
          name={name}
          src={profile.avatar_url}
          seed={profile.id}
          size="lg"
          className="ring-4 ring-surface"
        />
        <h2
          id="meu-perfil-titulo"
          className="mt-1 font-display text-lg leading-snug font-semibold text-balance text-fg"
        >
          <Link
            href={`/pesquisadoras/${profile.id}`}
            className="underline-offset-4 hover:text-primary hover:underline"
          >
            {name}
          </Link>
        </h2>
        {subtitle && <p className="line-clamp-3 text-sm text-fg-muted">{subtitle}</p>}
      </div>

      {stats ? (
        <ul aria-label="Sua rede" className="grid grid-cols-3 border-y border-border">
          {stats.map((stat) => (
            <li key={stat.label} className="grid text-center">
              <Link
                href={stat.href}
                className="grid gap-0.5 px-1 py-3 transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2"
              >
                <span className="font-display text-lg font-semibold text-fg tabular">
                  {formatCompactNumber(stat.value)}
                </span>
                <span className="text-xs text-fg-muted">{stat.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-y border-border p-3">
          <Unavailable />
        </div>
      )}

      <nav aria-label="Atalhos do seu perfil" className="p-2">
        <ul className="grid gap-0.5">
          {[
            { href: "/perfil", label: "Editar perfil", icon: <Settings /> },
            { href: "/portfolio", label: "Meu portfólio", icon: <FolderOpen /> },
            { href: "/rede", label: "Minha rede", icon: <Users /> },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-4 [&_svg]:text-fg-subtle"
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coluna direita: vagas de IC e pessoas para conectar
// ---------------------------------------------------------------------------

export function RecentOpportunitiesCard({
  opportunities,
}: {
  opportunities: Settled<RecentOpportunity[]>;
}) {
  return (
    <SideSection
      titleId="vagas-recentes-titulo"
      title="Vagas de IC recentes"
      footer={
        <Link href="/ics" className={footerLinkClass}>
          Ver todas as vagas
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      {!opportunities.ok ? (
        <Unavailable />
      ) : opportunities.data.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nenhuma vaga aberta agora. Quando uma pesquisadora publicar, ela aparece aqui.
        </p>
      ) : (
        <ul className="grid gap-3.5">
          {opportunities.data.map((opportunity) => (
            <li key={opportunity.id} className="grid gap-1">
              <Link
                href={`/ics/${opportunity.id}`}
                className="rounded-control leading-snug font-semibold text-pretty text-fg underline-offset-4 hover:text-primary hover:underline"
              >
                {opportunity.title}
              </Link>
              <p className="text-xs text-fg-muted">
                {[
                  opportunityKindLabel(opportunity.kind),
                  opportunity.institution ?? opportunity.areaName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {opportunity.hasScholarship && (
                <Badge variant="secondary" className="w-fit">
                  Com bolsa
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </SideSection>
  );
}

/** Motivo curto da sugestão (conexões em comum, mesma instituição, áreas em comum). */
function suggestionReason(person: ConnectionSuggestion): string | null {
  if (person.mutualConnections > 0)
    return pluralize(person.mutualConnections, "conexão em comum", "conexões em comum");
  if (person.sharedAreas > 0)
    return pluralize(person.sharedAreas, "área em comum", "áreas em comum");
  return null;
}

export function SuggestionsCard({ suggestions }: { suggestions: Settled<ConnectionSuggestion[]> }) {
  return (
    <SideSection
      titleId="sugestoes-titulo"
      title="Pessoas para conectar"
      footer={
        <Link href="/rede?aba=sugestoes" className={footerLinkClass}>
          Ver mais sugestões
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      {!suggestions.ok ? (
        <Unavailable />
      ) : suggestions.data.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Sem sugestões por enquanto. Complete as áreas do seu perfil para encontrarmos pessoas com
          interesses parecidos.
        </p>
      ) : (
        <ul className="grid gap-3.5">
          {suggestions.data.map((person) => {
            const subtitle = person.headline || careerStageLabel(person.career_stage);
            const reason = suggestionReason(person);
            return (
              <li key={person.id} className="flex items-start gap-3">
                <Avatar
                  name={person.full_name}
                  src={person.avatar_url}
                  seed={person.id}
                  size="sm"
                  className="mt-0.5"
                />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <Link
                    href={`/pesquisadoras/${person.id}`}
                    className="rounded-control text-sm leading-snug font-semibold text-fg underline-offset-4 hover:text-primary hover:underline"
                  >
                    {person.full_name}
                  </Link>
                  {subtitle && <p className="line-clamp-2 text-xs text-fg-muted">{subtitle}</p>}
                  {reason && <p className="text-xs text-fg-subtle">{reason}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SideSection>
  );
}
