import { Inbox, MessageCircle, Send, UsersRound } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { InviteQuote } from "@/components/network/connect-button";
import { RemoveConnectionButton, RespondInviteButtons } from "@/components/network/invite-actions";
import { PersonCard } from "@/components/network/person-card";
import { firstNameOf, networkTabHref } from "@/lib/network/presentation";
import { loadConnections, loadInvitations, type ServerClient } from "@/lib/network/queries";
import { LoadError, PEOPLE_GRID, SectionTitle, TimeAgo } from "./shared";

// ---------------------------------------------------------------------------
// Convites (recebidos, enviados e os que recusei)
// ---------------------------------------------------------------------------

export async function InvitesTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { received, sent, declined, failed } = await loadInvitations(supabase, myId);
  if (failed) return <LoadError />;

  return (
    <div className="grid gap-10">
      <section aria-labelledby="convites-recebidos" className="grid gap-5">
        <SectionTitle
          id="convites-recebidos"
          count={received.length}
          description="Aceitando, vocês viram conexões e passam a se seguir. Se você recusar, ela não recebe aviso."
        >
          Recebidos
        </SectionTitle>
        {received.length === 0 ? (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<Inbox />}
            title="Nenhum convite esperando resposta"
            description="Quando alguém quiser se conectar com você, o convite aparece aqui e você recebe um aviso. Que tal dar o primeiro passo e convidar alguém?"
            action={<ButtonLink href={networkTabHref("sugestoes")}>Ver sugestões</ButtonLink>}
          />
        ) : (
          <ul className={PEOPLE_GRID}>
            {received.map((invite) => (
              <PersonCard
                key={invite.id}
                person={invite.other}
                headingId={`recebido-${invite.id}`}
                detail={<TimeAgo date={invite.created_at} prefix="Convidou você" />}
                actions={
                  <RespondInviteButtons
                    connectionId={invite.id}
                    personName={invite.other.full_name}
                    focusAfterId="convites-recebidos"
                  />
                }
              >
                {invite.message && (
                  <InviteQuote label={`Recado de ${firstNameOf(invite.other.full_name) || "ela"}`}>
                    {invite.message}
                  </InviteQuote>
                )}
              </PersonCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="convites-enviados" className="grid gap-5">
        <SectionTitle
          id="convites-enviados"
          count={sent.length}
          description="Convites que você mandou e ainda esperam resposta."
        >
          Enviados
        </SectionTitle>
        {sent.length === 0 ? (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<Send />}
            title="Você não tem convites esperando resposta"
            description="Encontre pesquisadoras da sua área nas sugestões ou no diretório e mande um convite com um recado curto."
            action={<ButtonLink href="/pesquisadoras">Procurar pesquisadoras</ButtonLink>}
          />
        ) : (
          <ul className={PEOPLE_GRID}>
            {sent.map((invite) => (
              <PersonCard
                key={invite.id}
                person={invite.other}
                headingId={`enviado-${invite.id}`}
                detail={<TimeAgo date={invite.created_at} prefix="Enviado" />}
                actions={
                  <RemoveConnectionButton
                    connectionId={invite.id}
                    personName={invite.other.full_name}
                    kind="cancel"
                    focusAfterId="convites-enviados"
                  />
                }
              >
                {invite.message && (
                  <details className="rounded-control border border-border">
                    <summary className="cursor-pointer rounded-control px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
                      Ver o recado que você mandou
                    </summary>
                    <p className="border-t border-border px-3.5 py-3 text-[0.9375rem] break-words whitespace-pre-line text-fg">
                      {invite.message}
                    </p>
                  </details>
                )}
              </PersonCard>
            ))}
          </ul>
        )}
      </section>

      {declined.length > 0 && (
        <section aria-labelledby="convites-recusados" className="grid gap-5">
          <SectionTitle
            id="convites-recusados"
            count={declined.length}
            description="Só você vê esta lista: quem convidou não sabe da recusa. Você pode aceitar agora ou apagar o convite."
          >
            Recusados por você
          </SectionTitle>
          <ul className={PEOPLE_GRID}>
            {declined.map((invite) => (
              <PersonCard
                key={invite.id}
                person={invite.other}
                headingId={`recusado-${invite.id}`}
                detail={<TimeAgo date={invite.created_at} prefix="Convidou você" />}
                actions={
                  <>
                    <RespondInviteButtons
                      connectionId={invite.id}
                      personName={invite.other.full_name}
                      allowDecline={false}
                      focusAfterId="convites-recebidos"
                    />
                    <RemoveConnectionButton
                      connectionId={invite.id}
                      personName={invite.other.full_name}
                      kind="delete-declined"
                      focusAfterId="convites-recebidos"
                    />
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conexões aceitas
// ---------------------------------------------------------------------------

export async function ConnectionsTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadConnections(supabase, myId);

  return (
    <section aria-labelledby="conexoes-titulo" className="grid gap-5">
      <SectionTitle
        id="conexoes-titulo"
        count={items.length}
        description="Pesquisadoras com quem você está conectada. As publicações de uma aparecem no feed da outra."
      >
        Suas conexões
      </SectionTitle>
      {failed ? (
        <LoadError />
      ) : items.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          icon={<UsersRound />}
          title="Você ainda não tem conexões"
          description="Conexões são pesquisadoras que aceitaram o seu convite (ou cujo convite você aceitou). Comece pelas sugestões ou procure colegas pelo nome."
          action={
            <>
              <ButtonLink href={networkTabHref("sugestoes")}>Ver sugestões</ButtonLink>
              <ButtonLink href="/pesquisadoras" variant="outline">
                Procurar pesquisadoras
              </ButtonLink>
            </>
          }
        />
      ) : (
        <ul className={PEOPLE_GRID}>
          {items.map((connection) => (
            <PersonCard
              key={connection.id}
              person={connection.other}
              headingId={`conexao-${connection.id}`}
              detail={
                <TimeAgo
                  date={connection.responded_at ?? connection.created_at}
                  prefix="Conectadas"
                />
              }
              actions={
                <>
                  <ButtonLink
                    href={`/mensagens?com=${connection.other.id}`}
                    variant="outline"
                    size="sm"
                  >
                    <MessageCircle aria-hidden="true" />
                    Mensagem
                    <span className="sr-only"> para {connection.other.full_name}</span>
                  </ButtonLink>
                  <RemoveConnectionButton
                    connectionId={connection.id}
                    personName={connection.other.full_name}
                    kind="connection"
                    focusAfterId="conexoes-titulo"
                  />
                </>
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
