import Link from "next/link";
import { Crown, ShieldCheck } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui";
import { CAREER_STAGES, type CareerStage } from "@/lib/constants";
import type { LeaderboardEntry } from "@/lib/papers/queries";
import { LEADERBOARD_RULES, formatPoints } from "@/lib/ranking/leaderboard";
import { cn, formatNumber, pluralize } from "@/lib/utils";

function stageLabel(stage: string | null): string | null {
  return stage && stage in CAREER_STAGES ? CAREER_STAGES[stage as CareerStage].label : null;
}

function breakdown(entry: LeaderboardEntry): string[] {
  const parts: string[] = [];
  if (entry.mentorships > 0) parts.push(pluralize(entry.mentorships, "mentoria"));
  if (entry.papers > 0) parts.push(pluralize(entry.papers, "paper"));
  if (entry.votes_received > 0)
    parts.push(pluralize(entry.votes_received, "destaque recebido", "destaques recebidos"));
  if (entry.solutions > 0) parts.push(pluralize(entry.solutions, "solução", "soluções"));
  if (entry.posts > 0)
    parts.push(pluralize(entry.posts, "participação no fórum", "participações no fórum"));
  return parts;
}

/** Ranking da comunidade (só membros): pontos e de onde eles vêm. */
export function Leaderboard({
  entries,
  viewerId,
}: {
  entries: LeaderboardEntry[];
  viewerId: string;
}) {
  return (
    <ol aria-label="Ranking da comunidade" className="grid gap-3">
      {entries.map((entry, index) => {
        const isViewer = entry.profile_id === viewerId;
        const stage = stageLabel(entry.career_stage);
        const position = index + 1;
        return (
          <li key={entry.profile_id}>
            <Card
              as="article"
              className={cn(
                "flex items-center gap-3 p-4 sm:gap-4 sm:px-5",
                isViewer && "border-primary bg-primary-soft/40",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full font-display text-base font-bold tabular",
                  position === 1
                    ? "bg-accent text-accent-fg"
                    : position <= 3
                      ? "bg-primary-soft text-primary-soft-fg"
                      : "bg-surface-2 text-fg-muted",
                )}
              >
                <span className="sr-only">Posição </span>
                {position}
              </span>
              <Avatar
                name={entry.full_name}
                src={entry.avatar_url}
                seed={entry.profile_id}
                size="md"
                className="hidden sm:inline-flex"
              />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/pesquisadoras/${entry.profile_id}`}
                    className="font-semibold break-words text-fg hover:text-primary hover:underline"
                  >
                    {entry.full_name || "Pesquisadora"}
                  </Link>
                  {position === 1 && (
                    <Crown aria-hidden="true" className="size-4 text-accent-strong" />
                  )}
                  {isViewer && <Badge variant="primary">Você</Badge>}
                </p>
                {stage && <p className="text-sm text-fg-subtle">{stage}</p>}
                <p className="text-sm text-fg-muted">{breakdown(entry).join(" · ")}</p>
              </div>
              <p className="grid shrink-0 text-right">
                <span className="font-display text-2xl leading-none font-semibold text-fg tabular">
                  {formatNumber(entry.points)}
                </span>
                <span className="text-xs text-fg-subtle">
                  {entry.points === 1 ? "ponto" : "pontos"}
                </span>
              </p>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

/** Legenda "Como funciona a pontuação" (as regras vêm de src/lib/ranking/leaderboard.ts). */
export function LeaderboardRules() {
  return (
    <Card padding="md" as="section" aria-labelledby="como-pontua" className="grid gap-4">
      <h2 id="como-pontua" className="font-display text-lg font-semibold text-fg">
        Como funciona a pontuação
      </h2>
      <ul className="grid gap-3">
        {LEADERBOARD_RULES.map((rule) => (
          <li key={rule.key} className="flex gap-3">
            <Badge variant="accent" size="md" className="h-fit shrink-0 tabular">
              +{formatPoints(rule.points)}
            </Badge>
            <span className="grid gap-0.5 text-sm">
              <span className="font-semibold text-fg">{rule.label}</span>
              <span className="text-fg-muted">{rule.description}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          Publicações anônimas nunca contam pontos: assim ninguém descobre a autoria pelo ranking.
        </span>
      </p>
    </Card>
  );
}
