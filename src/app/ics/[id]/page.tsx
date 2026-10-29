import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  Clock,
  GraduationCap,
  Info,
  Lock,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { ReportButton } from "@/components/moderation/report-button";
import { AcademicLinks } from "@/components/opportunities/academic-links";
import { ApplicationStrip } from "@/components/opportunities/application-strip";
import { ApplyShortcut } from "@/components/opportunities/apply-shortcut";
import { ApplyForm } from "@/components/opportunities/apply-form";
import { MyApplication } from "@/components/opportunities/my-application";
import { NoticeToast } from "@/components/opportunities/notice-toast";
import { OwnerActions } from "@/components/opportunities/owner-actions";
import { OpportunityStateBadge } from "@/components/opportunities/status-badges";
import { Alert, Avatar, ButtonLink, Card, Chip, Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { CAREER_STAGES } from "@/lib/constants";
import { firstName } from "@/lib/mentorship/presentation";
import { careerStageLabel } from "@/lib/mentorship/view-models";
import { opportunityKindLabel } from "@/lib/opportunities/labels";
import { isUuid } from "@/lib/opportunities/params";
import {
  applicationCountLabel,
  formatDeadlineDate,
  locationLabel,
  modalityLabel,
  opportunityState,
  parseNotice,
  vacanciesLabel,
  weeklyHoursLabel,
} from "@/lib/opportunities/presentation";
import { getMyApplication, getOpportunity, hasOwnFeedPost } from "@/lib/opportunities/queries";
import { formatDate, toIsoString, truncate } from "@/lib/utils";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Só membras leem vagas: para visitantes (sem sessão) o título fica genérico e a página
  // manda entrar; o 404 de verdade sai da página, depois de conferir a sessão.
  const opportunity = await getOpportunity(id).catch(() => null);
  if (!opportunity) return { title: "Vaga", robots: { index: false } };
  return {
    title: truncate(opportunity.title, 70),
    description: truncate(opportunity.description, 160),
    robots: { index: false },
  };
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="grid min-w-0 gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{label}</dt>
        <dd className="text-[0.9375rem] break-words text-fg">{children}</dd>
      </div>
    </div>
  );
}

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const me = await requireOnboardedProfile(`/ics/${id}`);
  const query = await searchParams;

  const opportunity = await getOpportunity(id);
  if (!opportunity) notFound();

  const now = new Date();
  const isOwner = opportunity.owner_id === me.id;
  const [myApplication, hasFeedPost] = await Promise.all([
    isOwner ? null : getMyApplication(opportunity.id, me.id),
    isOwner ? hasOwnFeedPost(opportunity.id, me.id) : false,
  ]);
  const state = opportunityState(opportunity, now);
  const notice = parseNotice(query.aviso);

  const owner = opportunity.owner;
  const ownerName = firstName(owner?.full_name) || owner?.full_name || "a pesquisadora";
  const OwnerName = ownerName[0]!.toUpperCase() + ownerName.slice(1);
  const place = locationLabel(opportunity.city, opportunity.state);
  const institution = opportunity.institution || owner?.institution;
  const hours = weeklyHoursLabel(opportunity.weekly_hours);
  const stageMismatch =
    !isOwner && me.career_stage !== null && !opportunity.target_stages.includes(me.career_stage);
  const targetStageLabels = opportunity.target_stages.map((s) => CAREER_STAGES[s]?.label ?? s);

  return (
    <Container className="pb-16">
      <PageHeader
        back={{ href: "/ics", label: "Voltar para o Explorar ICs" }}
        eyebrow={
          opportunity.area
            ? `${opportunityKindLabel(opportunity.kind)} · ${opportunity.area.name}`
            : opportunityKindLabel(opportunity.kind)
        }
        title={opportunity.title}
        description={[institution, place].filter(Boolean).join(" · ") || undefined}
      />

      {notice && <NoticeToast notice={notice} />}
      <div className="mb-8 grid gap-3 empty:hidden">
        {myApplication && (
          <ApplicationStrip
            application={myApplication}
            ownerId={opportunity.owner_id}
            ownerName={OwnerName}
          />
        )}
        {state !== "open" && (
          <Alert
            variant={isOwner ? "warning" : "info"}
            icon={<Lock />}
            title={
              state === "closed"
                ? "As inscrições desta vaga estão encerradas."
                : `O prazo de inscrição terminou em ${formatDeadlineDate(opportunity.deadline ?? "", { now, long: true })}.`
            }
          >
            {isOwner
              ? state === "closed"
                ? "Ela não aparece na lista de vagas abertas. Reabra as inscrições quando quiser."
                : "Ela não aparece na lista de vagas abertas. Para receber novas candidaturas, edite a vaga e escolha um novo prazo."
              : "Ela não recebe novas candidaturas, mas fica aqui para consulta."}
          </Alert>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-6">
        <section
          aria-labelledby="resumo-vaga"
          className="grid content-start gap-4 lg:col-start-2 lg:row-start-1"
        >
          <Card padding="md" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="resumo-vaga" className="font-display text-base font-semibold text-fg">
                Resumo da vaga
              </h2>
              <OpportunityStateBadge state={state} />
            </div>
            <dl className="grid gap-3.5">
              <Fact icon={CalendarClock} label="Inscrições">
                {state === "closed" ? (
                  "Encerradas por quem publicou"
                ) : opportunity.deadline ? (
                  <>
                    {state === "expired" ? "Terminaram em" : "Até"}{" "}
                    <time dateTime={opportunity.deadline}>
                      {formatDeadlineDate(opportunity.deadline, { now, long: true })}
                    </time>
                  </>
                ) : (
                  "Abertas, sem prazo definido"
                )}
              </Fact>
              <Fact icon={MapPin} label="Modalidade">
                {[modalityLabel(opportunity.modality), place].filter(Boolean).join(" · ")}
              </Fact>
              {hours && (
                <Fact icon={Clock} label="Dedicação">
                  {hours}
                </Fact>
              )}
              <Fact icon={Users} label="Vagas">
                {vacanciesLabel(opportunity.vacancies)}
                {opportunity.application_count > 0 &&
                  ` · ${applicationCountLabel(opportunity.application_count)}`}
              </Fact>
              <Fact icon={Wallet} label="Bolsa">
                {opportunity.has_scholarship
                  ? opportunity.scholarship_info || "Com bolsa"
                  : "Sem bolsa (voluntária)"}
              </Fact>
            </dl>
            <p className="text-xs text-fg-subtle">
              Publicada em{" "}
              <time dateTime={toIsoString(opportunity.created_at)}>
                {formatDate(opportunity.created_at)}
              </time>
            </p>
            {!isOwner && !myApplication && state === "open" && <ApplyShortcut />}
          </Card>
        </section>

        <div className="grid min-w-0 content-start gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="sobre-vaga" className="grid gap-3">
            <h2 id="sobre-vaga" className="font-display text-xl font-semibold text-fg">
              Sobre a oportunidade
            </h2>
            <p className="text-lg leading-relaxed break-words whitespace-pre-line text-fg">
              {opportunity.description}
            </p>
          </section>

          {opportunity.requirements && (
            <section aria-labelledby="requisitos-vaga" className="grid gap-3">
              <h2 id="requisitos-vaga" className="font-display text-xl font-semibold text-fg">
                Requisitos
              </h2>
              <p className="text-[1.0625rem] leading-relaxed break-words whitespace-pre-line text-fg">
                {opportunity.requirements}
              </p>
            </section>
          )}

          <section aria-labelledby="para-quem" className="grid gap-3">
            <h2 id="para-quem" className="font-display text-base font-semibold text-fg">
              Para quem
            </h2>
            <ul className="flex flex-wrap gap-2">
              {targetStageLabels.map((label) => (
                <li key={label}>
                  <Chip size="sm" icon={<GraduationCap aria-hidden="true" />}>
                    {label}
                  </Chip>
                </li>
              ))}
            </ul>
          </section>

          {opportunity.keywords.length > 0 && (
            <section aria-labelledby="palavras-chave" className="grid gap-3">
              <h2 id="palavras-chave" className="font-display text-base font-semibold text-fg">
                Palavras-chave
              </h2>
              <ul className="flex flex-wrap gap-2">
                {opportunity.keywords.map((keyword) => (
                  <li key={keyword}>
                    <Chip size="sm">{keyword}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isOwner && (
            <section
              id="candidatar"
              aria-labelledby="candidatura-titulo"
              className="grid scroll-mt-24 gap-4 border-t border-border pt-8"
            >
              <h2 id="candidatura-titulo" className="font-display text-xl font-semibold text-fg">
                {myApplication ? "Sua candidatura" : "Candidatar-se"}
              </h2>
              {myApplication ? (
                <Card padding="md">
                  <MyApplication
                    application={myApplication}
                    ownerId={opportunity.owner_id}
                    ownerName={OwnerName}
                  />
                </Card>
              ) : state !== "open" ? (
                <p className="text-fg-muted">
                  As inscrições estão encerradas.{" "}
                  <Link href="/ics" className="font-semibold text-primary hover:underline">
                    Veja as vagas abertas
                  </Link>
                  .
                </p>
              ) : (
                <>
                  {stageMismatch && (
                    <Alert
                      variant="info"
                      icon={<Info />}
                      title="Esta vaga não é voltada para a sua etapa."
                    >
                      {OwnerName} procura estudantes de{" "}
                      {new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(
                        targetStageLabels,
                      )}
                      . Você pode se candidatar mesmo assim — conte na carta por que ela combina com
                      você.
                    </Alert>
                  )}
                  <Card padding="md">
                    <ApplyForm
                      opportunityId={opportunity.id}
                      ownerName={OwnerName}
                      profileLinks={
                        <AcademicLinks lattes_url={me.lattes_url} orcid={me.orcid} viewer="self" />
                      }
                      hasProfileLinks={Boolean(me.lattes_url || me.orcid)}
                    />
                  </Card>
                </>
              )}
            </section>
          )}
        </div>

        <aside
          aria-label="Quem publicou"
          className="grid content-start gap-4 lg:col-start-2 lg:row-start-2"
        >
          <Card padding="md" className="grid gap-3">
            <h2 className="font-display text-base font-semibold text-fg">Quem publicou</h2>
            {owner ? (
              <div className="flex items-start gap-3">
                <Avatar name={owner.full_name} src={owner.avatar_url} seed={owner.id} size="md" />
                <div className="grid min-w-0 gap-0.5 text-sm">
                  <Link
                    href={`/pesquisadoras/${owner.id}`}
                    className="font-semibold break-words text-fg hover:text-primary hover:underline"
                  >
                    {owner.full_name || "Pesquisadora"}
                  </Link>
                  {owner.headline && (
                    <span className="line-clamp-2 text-fg-muted">{owner.headline}</span>
                  )}
                  <span className="text-fg-subtle">
                    {[careerStageLabel(owner.career_stage), owner.institution]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Uma pesquisadora da comunidade.</p>
            )}
            {owner && !isOwner && (
              <ButtonLink href={`/pesquisadoras/${owner.id}`} variant="outline" size="sm">
                Ver perfil
              </ButtonLink>
            )}
          </Card>

          {isOwner && (
            <Card padding="md" className="grid gap-3">
              <h2 className="font-display text-base font-semibold text-fg">Sua vaga</h2>
              {opportunity.application_count === 0 && state === "open" && (
                <p className="text-sm text-fg-muted">
                  Nenhuma candidatura ainda. Divulgue o link desta página para quem pode se
                  interessar.
                </p>
              )}
              <OwnerActions opportunity={opportunity} hasFeedPost={hasFeedPost} now={now} />
            </Card>
          )}

          {!isOwner && (
            <div className="flex justify-end">
              <ReportButton
                targetType="opportunity"
                targetId={opportunity.id}
                label="Denunciar vaga"
              />
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
