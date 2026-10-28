import Link from "next/link";
import { HeartHandshake, Inbox, Send, Settings2 } from "lucide-react";
import { Alert, Badge, ButtonLink, Card, EmptyState, ProgressMeter } from "@/components/ui";
import { AvailabilityForm } from "@/components/mentorship/availability-form";
import { FirstMeetingChecklist } from "@/components/mentorship/first-meeting-checklist";
import {
  ActiveMentorshipCard,
  HistoryRow,
  ReceivedRequestCard,
  SentRequestCard,
} from "@/components/mentorship/request-cards";
import type { Profile } from "@/lib/auth";
import { capacitySummary, tabHref } from "@/lib/mentorship/presentation";
import { loadContacts, type RequestItem, type ServerClient } from "@/lib/mentorship/queries";
import { pluralize } from "@/lib/utils";

function SectionTitle({
  id,
  children,
  count,
}: {
  id: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-display text-xl font-semibold text-fg">
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-sm font-semibold text-fg-subtle tabular">
          {count}
        </span>
      )}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Enviadas
// ---------------------------------------------------------------------------

export function SentTab({
  sent,
  seeksMentorship,
  unread,
}: {
  sent: readonly RequestItem[];
  seeksMentorship: boolean;
  /** Mensagens não lidas por conversa (pedido). */
  unread: ReadonlyMap<string, number>;
}) {
  if (sent.length === 0) {
    return (
      <EmptyState
        icon={<Send />}
        title="Você ainda não enviou pedidos de mentoria"
        description={
          seeksMentorship
            ? "Veja as mentoras sugeridas para você e mande uma mensagem contando o que você busca."
            : "Encontre uma mentora no diretório de pesquisadoras e peça mentoria pelo perfil dela."
        }
        action={
          seeksMentorship ? (
            <ButtonLink href={tabHref("sugestoes")}>Ver sugestões</ButtonLink>
          ) : (
            <ButtonLink href="/pesquisadoras?mentoras=1">Explorar mentoras</ButtonLink>
          )
        }
      />
    );
  }
  const open = sent.filter((r) => r.status === "pending" || r.status === "accepted");
  const closed = sent.filter((r) => r.status !== "pending" && r.status !== "accepted");
  return (
    <div className="grid gap-10">
      {open.length > 0 && (
        <section aria-labelledby="enviadas-abertas" className="grid gap-4">
          <SectionTitle id="enviadas-abertas" count={open.length}>
            Em andamento
          </SectionTitle>
          <ul className="grid gap-4">
            {open.map((r) => (
              <SentRequestCard key={r.id} request={r} unread={unread.get(r.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}
      {closed.length > 0 && (
        <section aria-labelledby="enviadas-encerradas" className="grid gap-4">
          <SectionTitle id="enviadas-encerradas" count={closed.length}>
            Encerradas
          </SectionTitle>
          <ul className="grid gap-4">
            {closed.map((r) => (
              <SentRequestCard key={r.id} request={r} unread={unread.get(r.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recebidas
// ---------------------------------------------------------------------------

export function ReceivedTab({
  profile,
  received,
  unread,
}: {
  profile: Profile;
  received: readonly RequestItem[];
  /** Mensagens não lidas por conversa (pedido). */
  unread: ReadonlyMap<string, number>;
}) {
  const pending = received.filter((r) => r.status === "pending");
  const history = received.filter((r) => r.status !== "pending").slice(0, 20);
  const accepted = received.filter((r) => r.status === "accepted").length;
  const capacity = capacitySummary(accepted, profile.mentor_capacity);
  const available = profile.is_mentor && profile.mentor_available;

  return (
    <div className="grid gap-10">
      <Card
        as="section"
        aria-labelledby="minha-disponibilidade"
        className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-start"
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="minha-disponibilidade" className="font-display text-xl font-semibold text-fg">
              Sua disponibilidade
            </h2>
            {profile.is_mentor ? (
              <Badge variant={available ? "success" : "warning"} size="md">
                {available ? "Recebendo pedidos" : "Pedidos pausados"}
              </Badge>
            ) : (
              <Badge variant="neutral" size="md">
                Mentoria desativada no perfil
              </Badge>
            )}
          </div>
          <ProgressMeter
            value={capacity.percent}
            label="Vagas ocupadas"
            valueLabel={`${capacity.used} de ${capacity.capacity}`}
            tone={capacity.full ? "accent" : "primary"}
            className="max-w-md"
          />
          <p className="text-sm text-fg-muted">
            {capacity.full
              ? "Todas as suas vagas estão ocupadas: você não aparece nas sugestões. Para aceitar um novo pedido, conclua uma mentoria ou aumente sua capacidade no perfil."
              : `Você tem ${pluralize(capacity.openSlots, "vaga aberta", "vagas abertas")}. ${
                  available
                    ? "Você aparece nas sugestões de quem busca mentoria."
                    : "Enquanto os pedidos estiverem pausados, você não aparece nas sugestões."
                }`}
          </p>
        </div>
        <div className="grid gap-3 md:justify-items-end">
          {profile.is_mentor && <AvailabilityForm available={profile.mentor_available} />}
          <Link
            href="/perfil"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            <Settings2 aria-hidden="true" className="size-4" />
            Ajustar capacidade e temas
          </Link>
        </div>
      </Card>

      <section aria-labelledby="recebidas-pendentes" className="grid gap-4">
        <SectionTitle id="recebidas-pendentes" count={pending.length}>
          Aguardando sua resposta
        </SectionTitle>
        {pending.length > 0 && capacity.full && (
          <Alert variant="warning" title="Suas vagas estão todas ocupadas">
            Você pode recusar pedidos normalmente. Para aceitar, primeiro conclua uma mentoria ativa
            ou aumente sua capacidade no perfil.
          </Alert>
        )}
        {pending.length > 0 ? (
          <ul className="grid gap-4">
            {pending.map((r) => (
              <ReceivedRequestCard key={r.id} request={r} />
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<Inbox />}
            title="Nenhum pedido aguardando resposta"
            description={
              available
                ? "Quando uma pesquisadora pedir sua mentoria, o pedido aparece aqui e você recebe uma notificação."
                : "Você pausou novos pedidos. Quando quiser voltar a recebê-los, use o botão acima."
            }
          />
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="recebidas-historico" className="grid gap-4">
          <SectionTitle id="recebidas-historico">Pedidos já respondidos</SectionTitle>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {history.map((r) => (
              <HistoryRow key={r.id} request={r} unread={unread.get(r.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ativas
// ---------------------------------------------------------------------------

export async function ActiveTab({
  supabase,
  requests,
  isMentor,
  seeksMentorship,
  unread,
}: {
  supabase: ServerClient;
  requests: readonly RequestItem[];
  isMentor: boolean;
  seeksMentorship: boolean;
  /** Mensagens não lidas por conversa (pedido). */
  unread: ReadonlyMap<string, number>;
}) {
  const active = requests.filter((r) => r.status === "accepted");
  const completed = requests.filter((r) => r.status === "completed").slice(0, 20);
  const contacts = await loadContacts(
    supabase,
    active.map((r) => r.id),
  );

  return (
    <div className="grid gap-10">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="ativas-lista" className="grid gap-4">
          <SectionTitle id="ativas-lista" count={active.length}>
            Em andamento
          </SectionTitle>
          {active.length > 0 ? (
            <ul className="grid gap-4">
              {active.map((r) => (
                <ActiveMentorshipCard
                  key={r.id}
                  request={r}
                  contact={contacts.get(r.id) ?? null}
                  unread={unread.get(r.id) ?? 0}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              headingLevel="h3"
              icon={<HeartHandshake />}
              title="Nenhuma mentoria ativa por enquanto"
              description={
                isMentor && !seeksMentorship
                  ? "Quando você aceitar um pedido, a mentoria aparece aqui com o contato da mentoranda."
                  : "Quando uma mentora aceitar o seu pedido, vocês duas veem aqui o contato uma da outra."
              }
              action={
                isMentor && !seeksMentorship ? (
                  <ButtonLink href={tabHref("recebidas")}>Ver pedidos recebidos</ButtonLink>
                ) : (
                  <ButtonLink href={tabHref("sugestoes")}>Ver sugestões de mentoras</ButtonLink>
                )
              }
            />
          )}
        </section>
        <FirstMeetingChecklist />
      </div>

      {completed.length > 0 && (
        <section aria-labelledby="ativas-concluidas" className="grid gap-4">
          <SectionTitle id="ativas-concluidas" count={completed.length}>
            Mentorias concluídas
          </SectionTitle>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {completed.map((r) => (
              <HistoryRow key={r.id} request={r} unread={unread.get(r.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
