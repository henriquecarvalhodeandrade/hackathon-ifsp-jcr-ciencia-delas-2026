import { Users } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { SuggestionList } from "@/components/network/suggestion-list";
import { loadSuggestions, type ServerClient } from "@/lib/network/queries";
import { LoadError, SectionTitle } from "./shared";

/** Sugestões de conexão: áreas em comum, conexões em comum e mesma instituição (RPC). */
export async function SuggestionsTab({ supabase, myId }: { supabase: ServerClient; myId: string }) {
  const { items, failed } = await loadSuggestions(supabase, myId);

  return (
    <section aria-labelledby="sugestoes-titulo" className="grid gap-4">
      <SectionTitle
        id="sugestoes-titulo"
        compactOnMobile
        description="Pesquisadoras com áreas em comum, conexões em comum ou da mesma instituição que você."
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
        <SuggestionList items={items} headingId="sugestoes-titulo" />
      )}
    </section>
  );
}
