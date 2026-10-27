import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Lock, MessagesSquare, Star } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  CardLink,
  Chip,
  ConstellationPattern,
  EmptyState,
  Section,
  Stat,
  StatGroup,
} from "@/components/ui";
import { isEditionEmpty, type NewsletterContent } from "@/lib/newsletter/content";
import type { EditionDetail, EditionLink } from "@/lib/newsletter/queries";
import { formatEditionPeriod } from "@/lib/newsletter/week";
import { formatAuthorsList } from "@/lib/newsletter/format";
import { formatDate, pluralize, truncate } from "@/lib/utils";

/**
 * Versão web de uma edição, renderizada em React a partir do mesmo `content` do e-mail
 * (nunca injetamos o HTML do e-mail na página).
 */

function EditionHeader({ edition }: { edition: EditionDetail }) {
  const period = formatEditionPeriod(edition.period_start, edition.period_end);
  return (
    <header
      data-theme="dark"
      className="relative isolate mt-6 overflow-hidden rounded-dialog bg-violeta-950 px-6 py-10 text-white sm:mt-10 sm:px-10 sm:py-14"
    >
      <ConstellationPattern
        density="medium"
        align="end"
        className="absolute inset-0 -z-10 size-full [mask-image:linear-gradient(to_bottom_left,black,transparent_55%)] text-violeta-300/60 sm:[mask-image:linear-gradient(100deg,transparent_40%,black_85%)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow text-violeta-200">Boletim Delas{period ? ` · ${period}` : ""}</p>
        {edition.status === "draft" && (
          <Badge variant="warning">Rascunho — visível só para a administração</Badge>
        )}
      </div>
      <h1 className="mt-3 max-w-xl font-serif text-4xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-[1.1]">
        {edition.title}
      </h1>
      {edition.published_at && (
        <p className="mt-4 text-sm text-violeta-200">
          Publicada em{" "}
          <time dateTime={edition.published_at}>
            {formatDate(edition.published_at, { dateStyle: "long" })}
          </time>
        </p>
      )}
    </header>
  );
}

function PapersSection({ papers }: { papers: NewsletterContent["papers"] }) {
  if (!papers.length) return null;
  return (
    <Section
      title="Papers em destaque na Vitrine"
      description="Os trabalhos que a comunidade mais destacou."
      spacing="sm"
    >
      <ol className="grid gap-4">
        {papers.map((paper, index) => (
          <li key={paper.id}>
            <Card as="article" variant="interactive" padding="md" className="grid gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-subtle">
                <span className="font-display text-base font-semibold text-primary tabular">
                  #{index + 1}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
                  <Star aria-hidden="true" className="size-4 fill-accent text-accent-strong" />
                  {pluralize(paper.votes, "destaque")}
                </span>
                {paper.area && (
                  <Chip size="sm" variant="primary">
                    {paper.area}
                  </Chip>
                )}
              </div>
              <h3 className="font-serif text-2xl leading-snug font-semibold text-fg">
                <CardLink href={paper.url} className="hover:text-primary">
                  {paper.title}
                </CardLink>
              </h3>
              {paper.authors.length > 0 && (
                <p className="text-fg-muted">{formatAuthorsList(paper.authors)}</p>
              )}
              {paper.plain_summary && (
                <div className="rounded-control bg-surface-2 p-4">
                  <p className="eyebrow text-primary">Resumo acessível</p>
                  <p className="mt-1.5 font-serif text-lg leading-relaxed text-fg">
                    {truncate(paper.plain_summary, 320)}
                  </p>
                </div>
              )}
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Ler na Vitrine <ArrowRight aria-hidden="true" className="size-4" />
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Aviso para visitantes; o login volta para `next` (caminho interno fixo). */
function MembersOnlyNote({ what, next }: { what: string; next: string }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-sm text-fg-muted">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {what} são abertos só para membras.{" "}
        <Link
          href={`/entrar?next=${encodeURIComponent(next)}`}
          className="font-semibold text-primary underline underline-offset-2"
        >
          Entre
        </Link>{" "}
        ou{" "}
        <Link href="/cadastro" className="font-semibold text-primary underline underline-offset-2">
          crie sua conta
        </Link>{" "}
        para participar.
      </span>
    </p>
  );
}

function ThreadsSection({
  threads,
  viewerIsMember,
}: {
  threads: NewsletterContent["threads"];
  viewerIsMember: boolean;
}) {
  if (!threads.length) return null;
  return (
    <Section
      title="Conversas no fórum"
      description="O que movimentou a comunidade nesta semana."
      spacing="sm"
    >
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {threads.map((thread) => (
          <li
            key={thread.id}
            className="relative flex items-start gap-3 p-4 transition-colors hover:bg-surface-2 sm:p-5"
          >
            <MessagesSquare aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
            <div className="grid min-w-0 gap-1.5">
              <CardLink
                href={thread.url}
                className="font-semibold text-fg after:rounded-none hover:text-primary"
              >
                {thread.title}
              </CardLink>
              <p className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
                {thread.category && <Chip size="sm">{thread.category}</Chip>}
                <span>{pluralize(thread.replies, "resposta")}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!viewerIsMember && <MembersOnlyNote what="O fórum e os perfis" next="/forum" />}
    </Section>
  );
}

function MentorsSection({
  mentors,
  viewerIsMember,
}: {
  mentors: NewsletterContent["mentors"];
  viewerIsMember: boolean;
}) {
  if (!mentors.length) return null;
  return (
    <Section
      title="Mentoras na rede"
      description="Pesquisadoras disponíveis para orientar quem está começando."
      spacing="sm"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {mentors.map((mentor) => (
          <li key={mentor.id}>
            <Card
              as="article"
              variant="interactive"
              padding="sm"
              className="flex h-full items-start gap-3"
            >
              <Avatar name={mentor.full_name} seed={mentor.id} size="md" />
              <div className="grid min-w-0 gap-0.5">
                <h3 className="font-semibold text-fg">
                  <CardLink href={mentor.url} className="hover:text-primary">
                    {mentor.full_name}
                  </CardLink>
                </h3>
                {mentor.headline && <p className="text-sm text-fg-muted">{mentor.headline}</p>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {!viewerIsMember && (
        <p className="mt-4 text-sm text-fg-muted">
          Para pedir mentoria, entre na sua conta e acesse a página Mentoria.
        </p>
      )}
    </Section>
  );
}

function AdjacentNav({ older, newer }: { older: EditionLink | null; newer: EditionLink | null }) {
  if (!older && !newer) return null;
  return (
    <nav
      aria-label="Outras edições"
      className="grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
    >
      {older ? (
        <Link
          href={`/newsletter/${older.slug}`}
          className="group grid gap-1 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-fg-subtle">
            <ArrowLeft aria-hidden="true" className="size-4" /> Edição anterior
          </span>
          <span className="font-serif text-lg leading-snug font-semibold text-fg group-hover:text-primary">
            {older.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {newer && (
        <Link
          href={`/newsletter/${newer.slug}`}
          className="group grid gap-1 rounded-card border border-border bg-surface p-4 text-right transition-colors hover:border-border-strong"
        >
          <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-fg-subtle">
            Próxima edição <ArrowRight aria-hidden="true" className="size-4" />
          </span>
          <span className="font-serif text-lg leading-snug font-semibold text-fg group-hover:text-primary">
            {newer.title}
          </span>
        </Link>
      )}
    </nav>
  );
}

export interface EditionViewProps {
  edition: EditionDetail;
  viewerIsMember: boolean;
  older: EditionLink | null;
  newer: EditionLink | null;
  /** Bloco de inscrição no fim (ex.: link para /newsletter#assinar). */
  footer?: React.ReactNode;
}

export function EditionView({ edition, viewerIsMember, older, newer, footer }: EditionViewProps) {
  const { content } = edition;
  const { stats } = content;
  return (
    <article className="pb-14">
      <EditionHeader edition={edition} />

      {edition.summary && (
        <p className="mt-8 max-w-3xl font-serif text-xl leading-relaxed text-pretty text-fg sm:text-2xl sm:leading-relaxed">
          {edition.summary}
        </p>
      )}

      <section aria-label="Números da semana" className="mt-8">
        <StatGroup className="md:grid-cols-3">
          <Stat
            label={stats.new_members === 1 ? "Nova integrante" : "Novas integrantes"}
            value={stats.new_members}
          />
          <Stat
            label={stats.new_papers === 1 ? "Novo paper na Vitrine" : "Novos papers na Vitrine"}
            value={stats.new_papers}
          />
          <Stat
            label={stats.mentorships === 1 ? "Mentoria iniciada" : "Mentorias iniciadas"}
            value={stats.mentorships}
          />
        </StatGroup>
      </section>

      {isEditionEmpty(content) ? (
        <EmptyState
          className="mt-10"
          icon={<BookOpen />}
          title="Semana tranquila por aqui"
          description="Esta edição não teve destaques. Que tal indicar um paper de uma pesquisadora que você admira?"
        />
      ) : (
        <div className="mt-4">
          <PapersSection papers={content.papers} />
          <ThreadsSection threads={content.threads} viewerIsMember={viewerIsMember} />
          <MentorsSection mentors={content.mentors} viewerIsMember={viewerIsMember} />
        </div>
      )}

      {footer && <div className="mt-6 mb-10">{footer}</div>}
      <AdjacentNav older={older} newer={newer} />
    </article>
  );
}
