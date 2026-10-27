import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, EyeOff, LogIn, MessageCircle } from "lucide-react";
import { ReportButton } from "@/components/moderation/report-button";
import { CommentForm } from "@/components/papers/comment-form";
import { CommentList } from "@/components/papers/comment-list";
import { PaperOwnerActions } from "@/components/papers/paper-owner-actions";
import { PlainSummary } from "@/components/papers/plain-summary";
import { VitrineUnavailable } from "@/components/papers/vitrine-unavailable";
import { VoteButton } from "@/components/papers/vote-button";
import {
  Alert,
  Avatar,
  ButtonLink,
  Card,
  Chip,
  Container,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/ui";
import { isAiEnabled } from "@/lib/ai";
import { getCurrentProfile, getCurrentUser, isModerator } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { doiUrl } from "@/lib/papers/doi";
import { isUuid, relationDisplay, relationSentence } from "@/lib/papers/params";
import {
  getPaperComments,
  getPaperDetail,
  getPaperSubmitter,
  getVotedPaperIds,
} from "@/lib/papers/queries";
import { formatDate, pluralize, toIsoString, truncate } from "@/lib/utils";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  // Com loading.tsx a resposta já começou a ser enviada (status 200): notFound() mostra a
  // página 404 com <meta name="robots" content="noindex"> (docs/05 §11). Aqui ele também
  // evita gerar título/descrição de um paper inexistente ou oculto.
  if (!isUuid(id)) notFound();
  if (!isSupabaseConfigured()) return { title: "Paper" };
  const paper = await getPaperDetail(id).catch(() => null);
  if (!paper) notFound();
  const description = truncate(paper.plain_summary ?? paper.abstract, 160);
  return {
    title: truncate(paper.title, 70),
    description,
    openGraph: { type: "article", title: paper.title, description },
    ...(paper.is_hidden ? { robots: { index: false } } : {}),
  };
}

export default async function PaperPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();

  if (!isSupabaseConfigured()) {
    return (
      <Container className="pb-16">
        <PageHeader title="Paper" back={{ href: "/papers", label: "Voltar para a Vitrine" }} />
        <VitrineUnavailable />
      </Container>
    );
  }

  const [paper, user, profile] = await Promise.all([
    getPaperDetail(id),
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!paper) notFound();

  const isOwner = user?.id === paper.submitted_by;
  const canModerate = isModerator(profile);
  const [votedIds, submitter, commentsResult] = await Promise.all([
    getVotedPaperIds(user?.id ?? null, [paper.id]),
    user ? getPaperSubmitter(paper.submitted_by) : Promise.resolve(null),
    user ? getPaperComments(paper.id) : Promise.resolve(null),
  ]);

  const path = `/papers/${paper.id}`;
  const loginHref = `/entrar?next=${encodeURIComponent(path)}`;
  const relation = relationDisplay(paper.submitter_relation);
  const primaryLink = paper.doi ? doiUrl(paper.doi) : paper.url;
  const meta = [paper.venue, paper.year].filter(Boolean).join(" · ");

  return (
    <Container className="pb-16">
      <PageHeader
        back={{ href: "/papers", label: "Voltar para a Vitrine" }}
        eyebrow={paper.area ? `Vitrine Delas · ${paper.area.name}` : "Vitrine Delas"}
        title={<span className="font-serif font-semibold tracking-normal">{paper.title}</span>}
        description={
          <>
            <span className="block break-words">{paper.authors.join(", ")}</span>
            {meta && <span className="mt-1 block text-base text-fg-subtle">{meta}</span>}
          </>
        }
      />

      <div className="mb-8 grid gap-3 empty:hidden">
        {query.enviado === "1" && (
          <Alert variant="success" title="Paper publicado na Vitrine!">
            Obrigada por dar visibilidade a esse trabalho. Compartilhe o link desta página com quem
            pode se interessar.
          </Alert>
        )}
        {query.atualizado === "1" && <Alert variant="success" title="Alterações salvas." />}
        {paper.is_hidden && (
          <Alert variant="warning" icon={<EyeOff />} title="Este paper está oculto pela moderação.">
            Ele não aparece na Vitrine nem no ranking. Só quem enviou e a moderação conseguem ver
            esta página.
          </Alert>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-4">
        <section
          aria-label="Destacar e ler o paper"
          className="grid content-start gap-4 lg:col-start-2 lg:row-start-1"
        >
          <Card padding="md" className="grid gap-4">
            <VoteButton
              paperId={paper.id}
              paperTitle={paper.title}
              voted={votedIds.has(paper.id)}
              count={paper.vote_count}
              viewer={!user ? "guest" : isOwner ? "owner" : "member"}
              loginHref={loginHref}
              layout="horizontal"
            />
            <p className="text-sm text-fg-muted">
              Destaques levam o paper ao{" "}
              <Link
                href="/ranking"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                ranking
              </Link>{" "}
              e ao boletim semanal.
            </p>
          </Card>

          <Card padding="md" className="grid gap-3">
            <h2 className="font-display text-base font-semibold text-fg">Onde ler</h2>
            {primaryLink ? (
              <ButtonLink href={primaryLink} external variant="secondary" fullWidth>
                <BookOpen aria-hidden="true" />
                Ler o paper completo
              </ButtonLink>
            ) : null}
            {paper.doi && (
              <p className="grid gap-0.5 text-sm">
                <span className="text-fg-subtle">DOI</span>
                <a
                  href={doiUrl(paper.doi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs break-all text-primary hover:underline"
                >
                  {paper.doi}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </p>
            )}
            {paper.doi && paper.url && (
              <p className="grid gap-0.5 text-sm">
                <span className="text-fg-subtle">Outro link</span>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="break-all text-primary hover:underline"
                >
                  {truncate(paper.url.replace(/^https?:\/\//, ""), 60)}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </p>
            )}
            <p className="text-xs text-fg-subtle">
              A Vitrine guarda só o link: o texto completo fica com a revista ou o repositório,
              respeitando os direitos autorais.
            </p>
          </Card>
        </section>

        <div className="grid min-w-0 content-start gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {paper.plain_summary ? (
            <PlainSummary summary={paper.plain_summary} source={paper.plain_summary_source} />
          ) : (
            isOwner && (
              <Alert variant="info" title="Este paper ainda não tem resumo acessível.">
                Um resumo em linguagem simples ajuda estudantes e pessoas de outras áreas a entender
                o trabalho. <Link href={`${path}/editar`}>Escrever o resumo</Link>
              </Alert>
            )
          )}

          <section aria-labelledby="abstract" className="grid gap-3">
            <h2 id="abstract" className="font-display text-xl font-semibold text-fg">
              Resumo do paper (abstract)
            </h2>
            <p className="font-serif text-lg leading-relaxed break-words whitespace-pre-line text-fg">
              {paper.abstract}
            </p>
          </section>

          {paper.keywords.length > 0 && (
            <section aria-labelledby="palavras-chave" className="grid gap-3">
              <h2 id="palavras-chave" className="font-display text-base font-semibold text-fg">
                Palavras-chave
              </h2>
              <ul className="flex flex-wrap gap-2">
                {paper.keywords.map((keyword) => (
                  <li key={keyword}>
                    <Chip size="sm">{keyword}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Section
            id="comentarios"
            spacing="sm"
            title="Conversa sobre o paper"
            description={pluralize(paper.comment_count, "comentário")}
            className="scroll-mt-24 border-t border-border"
          >
            {!user || !commentsResult ? (
              <EmptyState
                variant="compact"
                headingLevel="h3"
                icon={<MessageCircle />}
                title="A conversa é só para membros"
                description="Entre na sua conta para ler os comentários e participar com perguntas, leituras e elogios."
                action={
                  <ButtonLink href={loginHref}>
                    <LogIn aria-hidden="true" />
                    Entrar para comentar
                  </ButtonLink>
                }
              />
            ) : (
              <div className="grid gap-6">
                {!commentsResult.ok ? (
                  <Alert variant="danger" title="Não conseguimos carregar os comentários agora.">
                    Atualize a página em instantes.
                  </Alert>
                ) : commentsResult.comments.length === 0 ? (
                  <p className="text-fg-muted">Ninguém comentou ainda. Que tal abrir a conversa?</p>
                ) : (
                  <CommentList
                    comments={commentsResult.comments}
                    paperId={paper.id}
                    viewerId={user.id}
                    canModerate={canModerate}
                    submitterId={paper.submitted_by}
                  />
                )}
                {profile?.onboarded_at ? (
                  <Card padding="md">
                    <CommentForm paperId={paper.id} />
                  </Card>
                ) : (
                  <Alert
                    variant="info"
                    title="Complete seu perfil para comentar."
                    actions={
                      <ButtonLink href={`/onboarding?next=${encodeURIComponent(path)}`} size="sm">
                        Completar perfil
                      </ButtonLink>
                    }
                  />
                )}
              </div>
            )}
          </Section>
        </div>

        <aside
          aria-label="Sobre quem indicou"
          className="grid content-start gap-4 lg:col-start-2 lg:row-start-2"
        >
          <Card padding="md" className="grid gap-3">
            <h2 className="font-display text-base font-semibold text-fg">Quem indicou</h2>
            {submitter ? (
              <div className="flex items-start gap-3">
                <Avatar
                  name={submitter.full_name}
                  src={submitter.avatar_url}
                  seed={submitter.id}
                  size="md"
                />
                <div className="grid min-w-0 gap-0.5 text-sm">
                  <Link
                    href={`/pesquisadoras/${submitter.id}`}
                    className="font-semibold break-words text-fg hover:text-primary hover:underline"
                  >
                    {submitter.full_name || "Pesquisadora"}
                  </Link>
                  {relation && (
                    <span className="text-fg-muted">
                      {relation[0]!.toUpperCase() + relation.slice(1)}
                    </span>
                  )}
                  {submitter.institution && (
                    <span className="text-fg-subtle">{submitter.institution}</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                {relationSentence(paper.submitter_relation)}{" "}
                {!user && (
                  <Link href={loginHref} className="font-semibold text-primary hover:underline">
                    Entre para ver o perfil.
                  </Link>
                )}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Na Vitrine desde{" "}
              <time dateTime={toIsoString(paper.created_at)}>{formatDate(paper.created_at)}</time>
            </p>
          </Card>

          {(isOwner || canModerate) && (
            <Card padding="md" className="grid gap-3">
              <h2 className="font-display text-base font-semibold text-fg">
                {isOwner ? "Seu paper" : "Moderação"}
              </h2>
              <PaperOwnerActions
                paperId={paper.id}
                isOwner={isOwner}
                canDelete={isOwner || canModerate}
                aiEnabled={isAiEnabled()}
                hasSummary={Boolean(paper.plain_summary)}
              />
            </Card>
          )}

          {!isOwner && (
            <div className="flex justify-end">
              <ReportButton
                targetType="paper"
                targetId={paper.id}
                signedIn={Boolean(user)}
                label="Denunciar paper"
              />
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
