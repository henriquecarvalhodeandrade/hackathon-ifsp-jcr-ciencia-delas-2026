import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Footprints,
  HeartHandshake,
  Languages,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Pencil,
  Star,
  Video,
} from "lucide-react";
import { RecentPosts } from "@/components/feed/recent-posts";
import { MessageButton } from "@/components/messages/message-button";
import { ReportButton } from "@/components/moderation/report-button";
import { ProfileNetwork } from "@/components/network/profile-network";
import { PortfolioSection } from "@/components/portfolio/portfolio-section";
import { MentorStatus } from "@/components/profile/mentor-status";
import { formatPlace } from "@/components/profile/profile-card";
import { ProfileLinks } from "@/components/profile/profile-links";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, ChipLink } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedProfile } from "@/lib/auth";
import {
  CAREER_STAGES,
  LANGUAGES,
  MEETING_FORMATS,
  MENTORSHIP_TOPICS,
  type MentorshipTopic,
} from "@/lib/constants";
import {
  getMemberPapers,
  getMemberProfile,
  getMemberThreads,
  getMentorAvailability,
  getOpenRequestBetween,
  getOwnOpenSlots,
} from "@/lib/profile/queries";
import {
  normalizeTrajectoryTags,
  sharedTrajectory,
  sharedTrajectorySentence,
  trajectoryMark,
} from "@/lib/trajectory/catalog";
import { formatDate, formatNumber, formatRelativeTime, pluralize, toIsoString } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getMemberProfile(id);
  if (!profile) return { title: "Perfil não encontrado", robots: { index: false } };
  return { title: profile.full_name || "Pesquisadora", robots: { index: false } };
}

function ProfileSection({
  id,
  title,
  icon,
  children,
  action,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card as="section" aria-labelledby={id} padding="md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 font-display text-xl font-semibold text-fg">
          <span aria-hidden="true" className="text-primary [&_svg]:size-5">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default async function PesquisadoraPage({ params }: { params: Params }) {
  const { id } = await params;
  const me = await requireOnboardedProfile(`/pesquisadoras/${id}`);
  const profile = await getMemberProfile(id);
  if (!profile) notFound();

  const isSelf = profile.id === me.id;
  const [papers, threads, availability, ownSlots, openRequest] = await Promise.all([
    getMemberPapers(profile.id),
    getMemberThreads(profile.id),
    profile.is_mentor && !isSelf ? getMentorAvailability([profile.id]) : Promise.resolve(null),
    profile.is_mentor && isSelf
      ? getOwnOpenSlots(profile.id, profile.mentor_capacity)
      : Promise.resolve(null),
    isSelf ? Promise.resolve(null) : getOpenRequestBetween(me.id, profile.id),
  ]);
  const mentorInfo = availability?.get(profile.id) ?? null;
  const openSlots = isSelf ? ownSlots : (mentorInfo?.openSlots ?? null);
  const canRequest =
    profile.is_mentor && !isSelf && profile.mentor_available && (openSlots ?? 0) > 0;
  const requestCta = openRequest
    ? openRequest.status === "accepted"
      ? { href: "/mentoria?aba=ativas", label: "Ver nossa mentoria" }
      : openRequest.myRole === "mentor"
        ? { href: "/mentoria?aba=recebidas", label: "Responder ao pedido dela" }
        : { href: "/mentoria?aba=enviadas", label: "Acompanhar seu pedido" }
    : null;
  const place = formatPlace(profile.city, profile.state);
  const firstName = profile.full_name.split(/\s+/)[0] || "Ela";
  // Trajetória (docs/17): só membras chegam aqui (requireOnboardedProfile + RLS).
  const marks = normalizeTrajectoryTags(profile.trajectory_tags);
  const sharedMarks = isSelf ? [] : sharedTrajectory(me.trajectory_tags, marks);
  const sharedSentence = sharedTrajectorySentence(sharedMarks, 2);

  return (
    <Container className="pb-16">
      <div className="pt-6 sm:pt-10">
        <Link
          href="/pesquisadoras"
          className="inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Pesquisadoras
        </Link>
      </div>

      <header className="flex flex-col gap-5 py-6 sm:flex-row sm:items-start sm:gap-7 sm:py-8">
        <Avatar name={profile.full_name} src={profile.avatar_url} seed={profile.id} size="2xl" />
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-1.5">
            {profile.career_stage && (
              <p className="eyebrow text-primary">{CAREER_STAGES[profile.career_stage].label}</p>
            )}
            <h1 className="font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance text-fg sm:text-4xl">
              {profile.full_name || "Pesquisadora"}
              {profile.pronouns && (
                <span className="ml-3 align-middle font-sans text-base font-medium tracking-normal text-fg-subtle">
                  ({profile.pronouns})
                </span>
              )}
            </h1>
            {profile.headline && <p className="text-lg text-fg-muted">{profile.headline}</p>}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-fg-subtle">
            {profile.institution && (
              <li className="flex items-start gap-1.5">
                <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {profile.institution}
              </li>
            )}
            {place && (
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {place}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
              Na comunidade desde{" "}
              {formatDate(profile.created_at, { month: "long", year: "numeric" })}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <MentorStatus
              isMentor={profile.is_mentor}
              available={profile.mentor_available}
              openSlots={openSlots}
              size="md"
            />
            {isSelf && (
              <Badge variant="primary" size="md">
                Este é o seu perfil
              </Badge>
            )}
          </div>
          {/* Rede (docs/18): números e, no perfil de outra pessoa, Conectar, Seguir e Mensagem. */}
          <ProfileNetwork profileId={profile.id} viewerId={me.id}>
            <MessageButton profileId={profile.id} />
          </ProfileNetwork>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-56 sm:flex-col sm:items-stretch">
          {isSelf && (
            <ButtonLink href="/perfil">
              <Pencil aria-hidden="true" />
              Editar meu perfil
            </ButtonLink>
          )}
          {requestCta && (
            <ButtonLink href={requestCta.href} variant="secondary">
              <HeartHandshake aria-hidden="true" />
              {requestCta.label}
            </ButtonLink>
          )}
          {!requestCta && canRequest && (
            <ButtonLink href={`/mentoria?mentora=${profile.id}`}>
              <HeartHandshake aria-hidden="true" />
              Pedir mentoria
            </ButtonLink>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <ProfileSection id="sobre-titulo" title="Sobre" icon={<MessageCircle />}>
            {profile.bio ? (
              <p className="whitespace-pre-line text-fg">{profile.bio}</p>
            ) : (
              <p className="text-fg-muted">
                {isSelf ? (
                  <>
                    Você ainda não escreveu uma apresentação.{" "}
                    <Link
                      href="/perfil#pesquisa"
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Escrever agora
                    </Link>
                  </>
                ) : (
                  `${firstName} ainda não escreveu uma apresentação.`
                )}
              </p>
            )}

            {(profile.areas.length > 0 || profile.keywords.length > 0) && (
              <div className="mt-6 grid gap-4">
                {profile.areas.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold text-fg">Áreas de pesquisa</h3>
                    <ul className="flex flex-wrap gap-2">
                      {profile.areas.map((area) => (
                        <li key={area.id} className="max-w-full">
                          <ChipLink href={`/pesquisadoras?area=${area.slug}`}>{area.name}</ChipLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {profile.keywords.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold text-fg">Palavras-chave</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {profile.keywords.map((keyword) => (
                        <li key={keyword} className="max-w-full">
                          <Chip size="sm">{keyword}</Chip>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </ProfileSection>

          {marks.length > 0 && (
            <ProfileSection id="trajetoria-titulo" title="Trajetória" icon={<Footprints />}>
              <div className="grid gap-4">
                {sharedSentence && (
                  <p className="flex items-start gap-2.5 rounded-control bg-accent-soft p-3.5 font-semibold text-accent-soft-fg">
                    <HeartHandshake aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                    <span>{sharedSentence}</span>
                  </p>
                )}
                <ul aria-labelledby="trajetoria-titulo" className="flex flex-wrap gap-2">
                  {marks.map((slug) => {
                    const shared = sharedMarks.includes(slug);
                    return (
                      <li key={slug} className="max-w-full">
                        <Chip
                          variant={shared ? "accent" : "neutral"}
                          icon={shared ? <Check aria-hidden="true" /> : undefined}
                        >
                          {trajectoryMark(slug)?.chip ?? slug}
                          {shared && <span className="sr-only"> (em comum com você)</span>}
                        </Chip>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-fg-subtle">
                  {isSelf ? (
                    <>
                      Opcional e visível só para membras da Artemis.{" "}
                      <Link
                        href="/perfil#sobre"
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        Mudar minhas marcas
                      </Link>
                    </>
                  ) : (
                    `Caminhos que ${firstName} escolheu contar à comunidade. Só membras veem.`
                  )}
                </p>
              </div>
            </ProfileSection>
          )}

          {profile.is_mentor && (
            <ProfileSection
              id="mentoria-titulo"
              title="Como posso ajudar"
              icon={<HeartHandshake />}
            >
              <div className="grid gap-5">
                {profile.mentoring_offer ? (
                  <p className="whitespace-pre-line text-fg">{profile.mentoring_offer}</p>
                ) : (
                  <p className="text-fg-muted">Ela ainda não descreveu como orienta.</p>
                )}
                {profile.mentorship_topics.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold text-fg">Temas em que orienta</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {profile.mentorship_topics.map((topic) => (
                        <li key={topic} className="max-w-full">
                          <Chip size="sm" variant="secondary">
                            {MENTORSHIP_TOPICS[topic as MentorshipTopic] ?? topic}
                          </Chip>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div className="grid gap-1">
                    <dt className="flex items-center gap-1.5 text-fg-subtle">
                      <Video aria-hidden="true" className="size-4" /> Formatos
                    </dt>
                    <dd className="font-semibold text-fg">
                      {profile.meeting_formats
                        .map((format) => MEETING_FORMATS[format])
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="flex items-center gap-1.5 text-fg-subtle">
                      <Languages aria-hidden="true" className="size-4" /> Idiomas
                    </dt>
                    <dd className="font-semibold text-fg">
                      {profile.languages
                        .map((code) => LANGUAGES[code as keyof typeof LANGUAGES] ?? code)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="flex items-center gap-1.5 text-fg-subtle">
                      <HeartHandshake aria-hidden="true" className="size-4" /> Acompanha até
                    </dt>
                    <dd className="font-semibold text-fg">
                      {pluralize(profile.mentor_capacity, "mentoranda")} ao mesmo tempo
                    </dd>
                  </div>
                </dl>
                {!profile.mentor_available && (
                  <p className="text-sm text-fg-muted">
                    {isSelf
                      ? "Você pausou novos pedidos. Para voltar a aparecer nas sugestões, ative a disponibilidade no perfil."
                      : `${firstName} pausou novos pedidos por enquanto. Volte mais tarde ou converse com ela no fórum.`}
                  </p>
                )}
              </div>
            </ProfileSection>
          )}

          <PortfolioSection ownerId={profile.id} isOwner={isSelf} />

          <ProfileSection
            id="papers-titulo"
            title="Papers na Vitrine"
            icon={<BookOpen />}
            action={
              papers.total > papers.items.length ? (
                <span className="text-sm text-fg-subtle">
                  {pluralize(papers.total, "paper")} no total
                </span>
              ) : undefined
            }
          >
            {papers.items.length === 0 ? (
              <EmptyState
                variant="compact"
                headingLevel="h3"
                icon={<BookOpen />}
                title={isSelf ? "Você ainda não divulgou papers" : "Nenhum paper divulgado ainda"}
                description={
                  isSelf
                    ? "Divulgue um trabalho seu (ou de outra pesquisadora) na Vitrine Delas."
                    : "Quando ela divulgar trabalhos na Vitrine Delas, eles aparecem aqui."
                }
                action={
                  isSelf ? (
                    <ButtonLink href="/papers/novo">Divulgar um paper</ButtonLink>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {papers.items.map((paper) => (
                  <li key={paper.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/papers/${paper.id}`}
                      className="font-serif text-lg leading-snug font-semibold text-fg hover:text-primary hover:underline"
                    >
                      {paper.title}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-subtle">
                      {[paper.venue, paper.year].filter(Boolean).join(" · ") || paper.area?.name}
                      <span className="inline-flex items-center gap-1">
                        <Star aria-hidden="true" className="size-3.5 text-accent-strong" />
                        <span className="tabular">{pluralize(paper.vote_count, "destaque")}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle aria-hidden="true" className="size-3.5" />
                        <span className="tabular">
                          {pluralize(paper.comment_count, "comentário")}
                        </span>
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="feed-titulo" title="No feed" icon={<Newspaper />}>
            <RecentPosts authorId={profile.id} viewerId={me.id} />
          </ProfileSection>

          <ProfileSection id="forum-titulo" title="No fórum" icon={<MessagesSquare />}>
            {threads.items.length === 0 ? (
              <p className="text-fg-muted">
                {isSelf
                  ? "Você ainda não abriu tópicos com seu nome. (Tópicos anônimos nunca aparecem no perfil.)"
                  : `${firstName} ainda não abriu tópicos públicos no fórum.`}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {threads.items.map((thread) => (
                  <li key={thread.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/forum/t/${thread.id}`}
                      className="font-semibold text-fg hover:text-primary hover:underline"
                    >
                      {thread.title}
                    </Link>
                    <p className="flex flex-wrap gap-x-3 text-sm text-fg-subtle">
                      {thread.category && <span>{thread.category.name}</span>}
                      <time dateTime={toIsoString(thread.created_at)}>
                        {formatRelativeTime(thread.created_at)}
                      </time>
                      <span className="tabular">{pluralize(thread.reply_count, "resposta")}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {threads.total > threads.items.length && (
              <p className="mt-3 text-sm text-fg-subtle">
                Mostrando os {formatNumber(threads.items.length)} mais recentes de{" "}
                {formatNumber(threads.total)}.
              </p>
            )}
          </ProfileSection>
        </div>

        <aside aria-label="Mais sobre ela" className="grid content-start gap-6">
          <Card padding="md" as="section" aria-labelledby="links-titulo">
            <h2 id="links-titulo" className="mb-3 font-display text-lg font-semibold text-fg">
              Links acadêmicos
            </h2>
            {profile.lattes_url || profile.orcid || profile.linkedin_url || profile.website_url ? (
              <ProfileLinks
                lattes_url={profile.lattes_url}
                orcid={profile.orcid}
                linkedin_url={profile.linkedin_url}
                website_url={profile.website_url}
              />
            ) : (
              <p className="text-sm text-fg-muted">
                {isSelf ? (
                  <>
                    Adicione Lattes, ORCID ou LinkedIn em{" "}
                    <Link
                      href="/perfil#pesquisa"
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Meu perfil
                    </Link>
                    .
                  </>
                ) : (
                  "Nenhum link informado."
                )}
              </p>
            )}
          </Card>

          {!isSelf && (
            <Card padding="md" variant="muted" as="section" aria-labelledby="denunciar-titulo">
              <h2 id="denunciar-titulo" className="font-display text-base font-semibold text-fg">
                Algo errado neste perfil?
              </h2>
              <p className="mt-1 mb-3 text-sm text-fg-muted">
                Perfis falsos, assédio ou conteúdo ofensivo podem ser denunciados. A moderação
                analisa em sigilo.
              </p>
              <ReportButton targetType="profile" targetId={profile.id} />
            </Card>
          )}
        </aside>
      </div>
    </Container>
  );
}
