import Link from "next/link";
import { MessageButton } from "@/components/messages/message-button";
import { Avatar, Badge } from "@/components/ui";
import {
  firstNameOf,
  networkCountItems,
  networkTabHref,
  type CountItem,
} from "@/lib/network/presentation";
import { loadNetworkCounts, loadRelationship } from "@/lib/network/queries";
import { getMemberProfile } from "@/lib/profile/queries";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";
import { ConnectButton, InviteQuote } from "./connect-button";
import { FollowButton } from "./follow-button";
import { RespondInviteButtons } from "./invite-actions";

export interface ProfileNetworkProps {
  /** Perfil exibido. */
  profileId: string;
  /** Quem está logada. */
  viewerId: string;
  /** Ações extras no fim do grupo (sempre secundárias, `variant="outline"`). Só em perfis alheios. */
  children?: React.ReactNode;
}

/** Id do grupo de ações: recebe o foco quando o aviso de convite some (aceitar/recusar). */
export const PROFILE_ACTIONS_ID = "perfil-acoes";

function CountLabel({ item }: { item: CountItem }) {
  return (
    <>
      <span className="font-semibold text-fg tabular">{formatNumber(item.value)}</span> {item.label}
    </>
  );
}

/**
 * Bloco de rede do perfil (Server Component): números (conexões, seguidoras, seguindo) e, no
 * perfil de outra pessoa, as ações com UM botão principal escolhido pelo estado:
 * - convite recebido → aviso com o recado e [Aceitar] [Recusar] acima dos botões;
 * - conectadas → "Enviar mensagem";
 * - senão → "Conectar".
 * O resto é contorno (Seguir/Seguindo, Mensagem, `children`). No próprio perfil, os números levam
 * às abas da /rede.
 */
export async function ProfileNetwork({ profileId, viewerId, children }: ProfileNetworkProps) {
  const isSelf = profileId === viewerId;
  const supabase = await createClient();
  const [counts, relationship, person] = await Promise.all([
    loadNetworkCounts(supabase, profileId),
    isSelf ? Promise.resolve(null) : loadRelationship(supabase, viewerId, profileId),
    // Memoizado por requisição: a página do perfil já fez esta mesma leitura.
    isSelf ? Promise.resolve(null) : getMemberProfile(profileId),
  ]);
  const name = firstNameOf(person?.full_name) || "Ela";
  const state = relationship?.state;

  return (
    <div className="grid gap-4">
      <ul
        aria-label="Rede"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted"
      >
        {networkCountItems(counts).map((item) => (
          <li key={item.key}>
            {isSelf ? (
              <Link
                href={networkTabHref(item.key)}
                className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
              >
                <CountLabel item={item} />
              </Link>
            ) : (
              <CountLabel item={item} />
            )}
          </li>
        ))}
        {relationship?.followsMe && state !== "connected" && (
          <li>
            <Badge variant="neutral">Segue você</Badge>
          </li>
        )}
      </ul>

      {relationship && person && state === "pending_received" && relationship.connectionId && (
        <section
          aria-labelledby="convite-recebido-titulo"
          className="grid gap-3 rounded-card border border-primary/30 bg-primary-soft/40 p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar name={person.full_name} src={person.avatar_url} seed={person.id} size="sm" />
            <h2
              id="convite-recebido-titulo"
              className="font-display text-base font-semibold text-fg"
            >
              {name} quer se conectar com você
            </h2>
          </div>
          {relationship.inviteMessage && (
            <InviteQuote label={`Recado de ${name}`}>{relationship.inviteMessage}</InviteQuote>
          )}
          <div className="flex flex-wrap gap-2">
            <RespondInviteButtons
              connectionId={relationship.connectionId}
              personName={person.full_name}
              size="md"
              focusAfterId={PROFILE_ACTIONS_ID}
              focusPrimary
            />
          </div>
        </section>
      )}

      {relationship && person && (
        <div id={PROFILE_ACTIONS_ID} className="flex flex-wrap items-start gap-2">
          {state === "connected" && (
            <span data-primary className="contents">
              <MessageButton profileId={profileId} label="Enviar mensagem" variant="primary" />
            </span>
          )}
          {state !== "pending_received" && (
            <ConnectButton
              profileId={profileId}
              state={relationship.state}
              connectionId={relationship.connectionId}
              personName={person.full_name}
            />
          )}
          <FollowButton
            profileId={profileId}
            following={relationship.followingThem}
            personName={person.full_name}
          />
          {state !== "connected" && (
            <MessageButton profileId={profileId} label="Enviar mensagem" variant="outline" />
          )}
          {children}
        </div>
      )}
    </div>
  );
}
