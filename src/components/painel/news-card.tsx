import Link from "next/link";
import { ArrowRight, Mail, Newspaper } from "lucide-react";
import { Avatar, ButtonLink } from "@/components/ui";
import type { NewsData } from "@/lib/painel/queries";
import { formatDate, pluralize, toIsoString } from "@/lib/utils";
import { PainelSection } from "./painel-section";

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-xs font-bold tracking-wide text-fg-subtle uppercase">
      {children}
    </h3>
  );
}

const linkClass =
  "inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline";

export interface NewsCardProps {
  news: NewsData;
  failed?: boolean;
}

/** "Novidades da semana": papers novos, quem chegou à rede e o último Boletim Delas. */
export function NewsCard({ news, failed = false }: NewsCardProps) {
  const { papers, papersMode, members, edition } = news;

  return (
    <PainelSection
      titleId="painel-novidades"
      title="Novidades da semana"
      icon={<Newspaper />}
      failed={failed}
    >
      <div className="grid gap-6">
        <section aria-labelledby="novidades-papers" className="grid gap-2.5">
          <SubHeading id="novidades-papers">
            {papers.length > 0 && papersMode === "area"
              ? "Na Vitrine, nas suas áreas"
              : "Na Vitrine esta semana"}
          </SubHeading>
          {papers.length > 0 ? (
            <ul className="grid gap-3">
              {papers.map((paper) => (
                <li key={paper.id} className="grid gap-0.5">
                  <Link
                    href={`/papers/${paper.id}`}
                    className="rounded-control font-serif text-[1.0625rem] leading-snug font-semibold text-pretty text-fg underline-offset-4 hover:text-primary hover:underline"
                  >
                    {paper.title}
                  </Link>
                  <p className="text-sm text-fg-muted">
                    {[paper.areaName, pluralize(paper.voteCount, "destaque")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">
              Nenhum paper novo nos últimos 7 dias.{" "}
              <Link
                href="/papers"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ver a Vitrine
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="novidades-membras" className="grid gap-2.5">
          <SubHeading id="novidades-membras">Chegaram à rede</SubHeading>
          {members.length > 0 ? (
            <ul className="grid gap-3">
              {members.map((member) => (
                <li key={member.id} className="flex items-start gap-3">
                  <Avatar
                    name={member.fullName}
                    src={member.avatarUrl}
                    seed={member.id}
                    size="md"
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="leading-snug font-semibold text-fg">{member.fullName}</p>
                    {member.headline && (
                      <p className="line-clamp-2 text-sm text-fg-muted">{member.headline}</p>
                    )}
                    {member.sharedArea && (
                      <p className="text-sm text-secondary">Também pesquisa {member.sharedArea}</p>
                    )}
                    <div className="mt-1">
                      <ButtonLink href={`/pesquisadoras/${member.id}`} variant="outline" size="sm">
                        Dê as boas-vindas
                        <span className="sr-only"> a {member.fullName}</span>
                      </ButtonLink>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Ninguém novo nas últimas duas semanas.</p>
          )}
        </section>

        <section aria-labelledby="novidades-boletim" className="grid gap-2.5">
          <SubHeading id="novidades-boletim">Boletim Delas</SubHeading>
          {edition ? (
            <div className="grid gap-1.5 rounded-control bg-surface-2 p-3.5">
              <Link
                href={`/newsletter/${edition.slug}`}
                className="rounded-control leading-snug font-semibold text-pretty text-fg underline-offset-4 hover:text-primary hover:underline"
              >
                {edition.title}
              </Link>
              {edition.publishedAt && (
                <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                  <Mail aria-hidden="true" className="size-3.5" />
                  <span>
                    Publicado em{" "}
                    <time dateTime={toIsoString(edition.publishedAt)}>
                      {formatDate(edition.publishedAt)}
                    </time>
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              A primeira edição sai em breve.{" "}
              <Link href="/newsletter" className={linkClass}>
                Conheça o Boletim
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </p>
          )}
        </section>
      </div>
    </PainelSection>
  );
}
