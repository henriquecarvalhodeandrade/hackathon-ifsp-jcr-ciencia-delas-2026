import { Inbox, UsersRound } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { MessageButton } from "@/components/messages/message-button";
import { InviteQuote } from "@/components/network/connect-button";
import {
  PendingInvite,
  RemoveConnectionButton,
  RespondInviteButtons,
} from "@/components/network/invite-actions";
import { OptimisticItem, OptimisticList } from "@/components/network/optimistic-list";
import { PersonCard } from "@/components/network/person-card";
import { firstNameOf, networkTabHref } from "@/lib/network/presentation";
import { loadConnections, loadInvitations, type ServerClient } from "@/lib/network/queries";
import { EmptyLine, LoadError, PEOPLE_GRID, SectionTitle, TimeAgo } from "./shared";

// ---------------------------------------------------------------------------
// Convites (recebidos, enviados e os que recusei)
// ---------------------------------------------------------------------------

export async function InvitesTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { received, sent, declined, failed } = await loadInvitations(supabase, myId);
  if (failed) return <LoadError />;

  // Nada em nenhuma das listas: um único estado vazio para a aba inteira.
  if (received.length === 0 && sent.length === 0 && declined.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Nenhum convite por enquanto"
        description="Os convites que você receber e os que enviar aparecem aqui até serem respondidos. Que tal convidar alguém da sua área?"
        action={
          <>
            <ButtonLink href={networkTabHref("sugestoes")}>Ver sugestões</ButtonLink>
            <ButtonLink href="/pesquisadoras" variant="outline">
              Procurar pesquisadoras
            </ButtonLink>
          </>
        }
      />
    );
  }

  return (
    <OptimisticList>
      <div className="grid gap-10">
        <section aria-labelledby="convites-recebidos" className="grid gap-4">
          {/* Sem contador aqui: o número já está na aba "Convites". */}
          <SectionTitle
            id="convites-recebidos"
            compactOnMobile
            description="Aceitando, vocês viram conexões e passam a se seguir. Se você recusar, ela não recebe aviso."
          >
            Recebidos
          </SectionTitle>
          {received.length === 0 ? (
            <EmptyLine>Nenhum convite recebido esperando resposta.</EmptyLine>
          ) : (
            <ul className={PEOPLE_GRID}>
              {received.map((invite) => (
                <OptimisticItem key={invite.id} id={invite.id}>
                  <PersonCard
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
                      <InviteQuote
                        label={`Recado de ${firstNameOf(invite.other.full_name) || "ela"}`}
                      >
                        {invite.message}
                      </InviteQuote>
                    )}
                  </PersonCard>
                </OptimisticItem>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="convites-enviados" className="grid gap-4">
          <SectionTitle id="convites-enviados" count={sent.length}>
            Enviados
          </SectionTitle>
          {sent.length === 0 ? (
            <EmptyLine>Nenhum convite enviado esperando resposta.</EmptyLine>
          ) : (
            <ul className={PEOPLE_GRID}>
              {sent.map((invite) => (
                <OptimisticItem key={invite.id} id={invite.id}>
                  <PersonCard
                    person={invite.other}
                    headingId={`enviado-${invite.id}`}
                    detail={<TimeAgo date={invite.created_at} prefix="Enviado" />}
                    actions={
                      <PendingInvite
                        connectionId={invite.id}
                        profileId={invite.other.id}
                        personName={invite.other.full_name}
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
                </OptimisticItem>
              ))}
            </ul>
          )}
        </section>

        {declined.length > 0 && (
          <section aria-labelledby="convites-recusados" className="grid gap-4">
            <SectionTitle
              id="convites-recusados"
              count={declined.length}
              description="Só você vê esta lista: quem convidou não sabe da recusa. Você pode aceitar agora ou apagar o convite."
            >
              Recusados por você
            </SectionTitle>
            <ul className={PEOPLE_GRID}>
              {declined.map((invite) => (
                <OptimisticItem key={invite.id} id={invite.id}>
                  <PersonCard
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
                </OptimisticItem>
              ))}
            </ul>
          </section>
        )}
      </div>
    </OptimisticList>
  );
}

// ---------------------------------------------------------------------------
// Conexões aceitas
// ---------------------------------------------------------------------------

export async function ConnectionsTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadConnections(supabase, myId);

  return (
    <section aria-labelledby="conexoes-titulo" className="grid gap-4">
      {/* Sem contador aqui: o número já está na aba "Conexões". */}
      <SectionTitle
        id="conexoes-titulo"
        compactOnMobile
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
        <OptimisticList>
          <ul className={PEOPLE_GRID}>
            {items.map((connection) => (
              <OptimisticItem key={connection.id} id={connection.id}>
                <PersonCard
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
                      <MessageButton
                        profileId={connection.other.id}
                        label="Enviar mensagem"
                        variant="outline"
                        size="sm"
                      />
                      <RemoveConnectionButton
                        connectionId={connection.id}
                        personName={connection.other.full_name}
                        kind="connection"
                        focusAfterId="conexoes-titulo"
                      />
                    </>
                  }
                />
              </OptimisticItem>
            ))}
          </ul>
        </OptimisticList>
      )}
    </section>
  );
}
