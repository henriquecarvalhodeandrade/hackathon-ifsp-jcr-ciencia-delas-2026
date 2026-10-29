import Link from "next/link";
import { Badge } from "@/components/ui";
import { networkCountItems, networkTabHref, type CountItem } from "@/lib/network/presentation";
import { loadNetworkCounts, loadRelationship } from "@/lib/network/queries";
import { getMemberProfile } from "@/lib/profile/queries";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";
import { ConnectButton } from "./connect-button";
import { FollowButton } from "./follow-button";

export interface ProfileNetworkProps {
  /** Perfil exibido. */
  profileId: string;
  /** Quem está logada. */
  viewerId: string;
  /** Ações extras depois de Conectar/Seguir (ex.: o botão de mensagem). Só para perfis alheios. */
  children?: React.ReactNode;
}

function CountLabel({ item }: { item: CountItem }) {
  return (
    <>
      <span className="font-semibold text-fg tabular">{formatNumber(item.value)}</span> {item.label}
    </>
  );
}

/**
 * Bloco de rede do perfil (Server Component): números (conexões, seguidoras, seguindo) e, no
 * perfil de outra pessoa, os botões Conectar e Seguir seguidos de `children`. No próprio perfil
 * os números levam às abas da /rede.
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

  return (
    <div className="grid gap-3">
      <ul aria-label="Rede" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
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
        {relationship?.followsMe && relationship.state !== "connected" && (
          <li>
            <Badge variant="neutral">Segue você</Badge>
          </li>
        )}
      </ul>

      {relationship && person && (
        <div className="flex flex-wrap items-start gap-2">
          <ConnectButton
            profileId={profileId}
            state={relationship.state}
            connectionId={relationship.connectionId}
            personName={person.full_name}
            inviteMessage={relationship.inviteMessage}
          />
          <FollowButton
            profileId={profileId}
            following={relationship.followingThem}
            personName={person.full_name}
          />
          {children}
        </div>
      )}
    </div>
  );
}
