import { Alert, Badge, ButtonLink, Card, Chip } from "@/components/ui";
import { MEETING_FORMATS, type MeetingFormat } from "@/lib/constants";
import { firstName, tabHref } from "@/lib/mentorship/presentation";
import type { DeepLinkMentor } from "@/lib/mentorship/queries";
import { topicLabel, type DeepLinkState } from "@/lib/mentorship/view-models";
import { pluralize } from "@/lib/utils";
import { PersonSummary } from "./person-summary";
import { RequestMentorshipDialog } from "./request-dialog";

/** Avisos quando o link direto não pode virar um pedido. */
function DeepLinkAlert({ state, mentorName }: { state: Exclude<DeepLinkState, { kind: "ok" }>; mentorName: string }) {
  const name = firstName(mentorName) || mentorName;
  switch (state.kind) {
    case "not_found":
      return (
        <Alert
          variant="warning"
          title="Não encontramos essa pesquisadora"
          actions={
            <ButtonLink href="/pesquisadoras?mentoras=1" variant="outline" size="sm">
              Ver mentoras no diretório
            </ButtonLink>
          }
        >
          O link pode estar incompleto ou o perfil não existe mais.
        </Alert>
      );
    case "self":
      return (
        <Alert variant="info" title="Este é o seu próprio perfil">
          Para receber pedidos, mantenha “Quero ser mentora” ativo no seu perfil. Os pedidos chegam em “Solicitações
          recebidas”.
        </Alert>
      );
    case "not_mentor":
      return (
        <Alert variant="info" title={`${name} não oferece mentoria pela plataforma`}>
          Você ainda pode conversar com ela no fórum ou procurar outras mentoras nas sugestões.
        </Alert>
      );
    case "unavailable":
      return (
        <Alert
          variant="warning"
          title={`${name} não está recebendo novos pedidos agora`}
          actions={
            <ButtonLink href="/pesquisadoras?mentoras=1" variant="outline" size="sm">
              Ver outras mentoras
            </ButtonLink>
          }
        >
          As vagas dela estão ocupadas ou ela pausou os pedidos por um tempo. Tente de novo mais tarde.
        </Alert>
      );
    case "open_request":
      return (
        <Alert
          variant="info"
          title={
            state.status === "accepted" ? `Você e ${name} já estão em mentoria` : `Você já enviou um pedido para ${name}`
          }
          actions={
            <ButtonLink
              href={tabHref(state.status === "accepted" ? "ativas" : "enviadas")}
              variant="outline"
              size="sm"
            >
              {state.status === "accepted" ? "Ver mentoria ativa" : "Ver pedido enviado"}
            </ButtonLink>
          }
        >
          {state.status === "accepted"
            ? "O contato dela está em “Mentorias ativas”."
            : "Assim que ela responder, você recebe uma notificação."}
        </Alert>
      );
  }
}

/**
 * Cartão aberto pelo link direto ?mentora=<id> (vindo do diretório ou do perfil): resumo da
 * mentora e o diálogo de pedido já aberto — mesmo sem sugestões geradas.
 */
export function DeepLinkCard({ mentor, state }: { mentor: DeepLinkMentor | null; state: DeepLinkState }) {
  if (state.kind !== "ok" || !mentor) {
    return (
      <DeepLinkAlert state={state.kind === "ok" ? { kind: "not_found" } : state} mentorName={mentor?.full_name ?? ""} />
    );
  }

  const formats = mentor.meeting_formats
    .map((f) => MEETING_FORMATS[f as MeetingFormat])
    .filter((label): label is string => Boolean(label));

  return (
    <Card as="section" aria-labelledby="pedido-direto" className="grid gap-4 border-primary/40 p-5 sm:p-6">
      <p className="eyebrow text-primary">Pedido de mentoria</p>
      <PersonSummary person={mentor} headingId="pedido-direto" headingLevel="h2" size="lg">
        <Badge variant="primary">Mentora</Badge>
        {state.openSlots !== null && state.openSlots > 0 && (
          <Badge variant="success">{pluralize(state.openSlots, "vaga aberta", "vagas abertas")}</Badge>
        )}
        {formats.map((f) => (
          <Badge key={f} variant="outline">
            {f}
          </Badge>
        ))}
      </PersonSummary>

      {mentor.mentoring_offer && (
        <div className="rounded-control bg-surface-2 p-3.5 text-[0.9375rem] text-fg-muted">
          <p className="mb-1 text-xs font-bold tracking-wide text-fg-subtle uppercase">Como ela pode ajudar</p>
          <p className="whitespace-pre-line">{mentor.mentoring_offer}</p>
        </div>
      )}

      {mentor.mentorship_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentor.mentorship_topics.map((slug) => (
            <Chip key={slug} size="sm" variant="secondary">
              {topicLabel(slug)}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <RequestMentorshipDialog mentorId={mentor.id} mentorName={mentor.full_name} defaultOpen />
        <ButtonLink href={`/pesquisadoras/${mentor.id}`} variant="ghost">
          Ver perfil completo
        </ButtonLink>
      </div>
    </Card>
  );
}
