import { Orbit, Users } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { ConnectButton } from "@/components/network/connect-button";
import { FollowButton } from "@/components/network/follow-button";
import { PersonCard } from "@/components/network/person-card";
import { suggestionReason } from "@/lib/network/presentation";
import { loadSuggestions, type ServerClient } from "@/lib/network/queries";
import { LoadError, PEOPLE_GRID, SectionTitle } from "./shared";

/** Sugestões de conexão: áreas em comum, conexões em comum e mesma instituição (RPC). */
export async function SuggestionsTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadSuggestions(supabase, myId);

  return (
    <section aria-labelledby="sugestoes-titulo" className="grid gap-5">
      <SectionTitle
        id="sugestoes-titulo"
        description="Pesquisadoras com áreas em comum, conexões em comum ou da mesma instituição que você. Quem já tem convite ou conexão com você não aparece aqui."
      >
        Pessoas que você talvez conheça
      </SectionTitle>

      {failed ? (
        <LoadError />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          headingLevel="h3"
          title="Nenhuma sugestão por enquanto"
          description="Você já se conectou ou convidou todo mundo que combina com o seu perfil. Procure pesquisadoras pelo nome, área ou instituição — ou complete suas áreas de pesquisa no perfil para receber novas sugestões."
          action={
            <>
              <ButtonLink href="/pesquisadoras">Procurar pesquisadoras</ButtonLink>
              <ButtonLink href="/perfil#pesquisa" variant="outline">
                Revisar minhas áreas
              </ButtonLink>
            </>
          }
        />
      ) : (
        <ul className={PEOPLE_GRID}>
          {items.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              headingId={`sugestao-${person.id}`}
              detail={
                <p className="flex items-start gap-1.5">
                  <Orbit aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{suggestionReason(person)}</span>
                </p>
              }
              actions={
                <>
                  <ConnectButton
                    profileId={person.id}
                    state="none"
                    personName={person.full_name}
                    size="sm"
                    revalidate={false}
                  />
                  <FollowButton
                    profileId={person.id}
                    following={person.following}
                    personName={person.full_name}
                    size="sm"
                    revalidate={false}
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
