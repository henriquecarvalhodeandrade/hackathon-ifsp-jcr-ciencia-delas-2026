import { UserCheck, Users } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { FollowButton } from "@/components/network/follow-button";
import { PersonCard } from "@/components/network/person-card";
import { networkTabHref } from "@/lib/network/presentation";
import {
  loadFollowers,
  loadFollowing,
  type FollowItem,
  type ServerClient,
} from "@/lib/network/queries";
import { LoadError, PEOPLE_GRID, SectionTitle, TimeAgo } from "./shared";

function FollowList({
  items,
  idPrefix,
  sincePrefix,
  showFollowsBack,
}: {
  items: readonly FollowItem[];
  idPrefix: string;
  sincePrefix: string;
  showFollowsBack?: boolean;
}) {
  return (
    <ul className={PEOPLE_GRID}>
      {items.map((item) => (
        <PersonCard
          key={item.person.id}
          person={item.person}
          headingId={`${idPrefix}-${item.person.id}`}
          detail={
            <span className="flex flex-wrap items-center gap-2">
              <TimeAgo date={item.since} prefix={sincePrefix} />
              {showFollowsBack && item.following && (
                <Badge variant="neutral">Vocês se seguem</Badge>
              )}
            </span>
          }
          actions={
            <FollowButton
              profileId={item.person.id}
              following={item.following}
              personName={item.person.full_name}
              size="sm"
              revalidate={false}
            />
          }
        />
      ))}
    </ul>
  );
}

/** Quem eu sigo (de um lado só). */
export async function FollowingTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadFollowing(supabase, myId);
  return (
    <section aria-labelledby="seguindo-titulo" className="grid gap-5">
      <SectionTitle
        id="seguindo-titulo"
        compactOnMobile
        description="As publicações de quem você segue aparecem na aba “Seguindo” do feed. Seguir não precisa de aceite."
      >
        Quem você segue
      </SectionTitle>
      {failed ? (
        <LoadError />
      ) : items.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          icon={<UserCheck />}
          title="Você ainda não segue ninguém"
          description="Siga pesquisadoras cujo trabalho você quer acompanhar: as publicações delas aparecem no seu feed. Conectar-se também faz vocês se seguirem."
          action={
            <>
              <ButtonLink href="/pesquisadoras">Procurar pesquisadoras</ButtonLink>
              <ButtonLink href={networkTabHref("sugestoes")} variant="outline">
                Ver sugestões
              </ButtonLink>
            </>
          }
        />
      ) : (
        <FollowList items={items} idPrefix="seguindo" sincePrefix="Você começou a seguir" />
      )}
    </section>
  );
}

/** Quem me segue (com "Seguir" para seguir de volta). */
export async function FollowersTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadFollowers(supabase, myId);
  return (
    <section aria-labelledby="seguidoras-titulo" className="grid gap-5">
      <SectionTitle
        id="seguidoras-titulo"
        compactOnMobile
        description="Pesquisadoras que acompanham as suas publicações. Siga de volta quem você também quer acompanhar."
      >
        Quem segue você
      </SectionTitle>
      {failed ? (
        <LoadError />
      ) : items.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          icon={<Users />}
          title="Ninguém segue você por enquanto"
          description="Complete o seu perfil, adicione itens ao portfólio e participe do fórum: é assim que outras pesquisadoras encontram você. Conectar-se com alguém também faz vocês se seguirem."
          action={
            <>
              <ButtonLink href="/pesquisadoras">Procurar pesquisadoras</ButtonLink>
              <ButtonLink href="/portfolio" variant="outline">
                Montar meu portfólio
              </ButtonLink>
            </>
          }
        />
      ) : (
        <FollowList
          items={items}
          idPrefix="seguidora"
          sincePrefix="Começou a seguir você"
          showFollowsBack
        />
      )}
    </section>
  );
}
