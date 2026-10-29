import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, ButtonLink } from "@/components/ui";
import { ChatScreen } from "@/components/messages/chat-screen";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  conversationHref,
  conversationStarters,
  draftState,
  startConversationHref,
} from "@/lib/messages/conversation";
import { loadDraftTarget } from "@/lib/messages/queries";
import { PROFILE_NOT_FOUND, startConversationSchema } from "@/lib/messages/schema";
import { firstName } from "@/lib/mentorship/presentation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova conversa", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-lg:mb-6 lg:flex lg:min-h-0 lg:flex-1 lg:items-start">
      <h1 className="sr-only">Nova conversa</h1>
      <Alert
        variant="danger"
        title={title}
        className="w-full"
        actions={
          <ButtonLink href="/pesquisadoras" variant="outline" size="sm">
            Ver pesquisadoras
          </ButtonLink>
        }
      >
        {children}
      </Alert>
    </div>
  );
}

/**
 * Rascunho de conversa (`MessageButton`, links "Mensagem"): SÓ LEITURA. Se a conversa do par já
 * existe, leva até ela; senão mostra o chat vazio com a pessoa, e a conversa só nasce no banco com
 * a primeira mensagem (`sendFirstMessageAction`). Assim, abrir e desistir não deixa conversa vazia
 * (que não dá para apagar) nem gasta o limite de conversas novas do dia — e a pré-busca de links
 * para cá é inofensiva.
 */
export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const withProfile = first(params.com) ?? "";
  const profile = await requireOnboardedProfile(
    startConversationHref(encodeURIComponent(withProfile)),
  );
  if (!isSupabaseConfigured()) redirect("/mensagens");

  const parsed = startConversationSchema.safeParse({ profile_id: withProfile });
  if (!parsed.success) {
    return <Problem title="Não foi possível abrir a conversa">{PROFILE_NOT_FOUND}</Problem>;
  }

  const supabase = await createClient();
  const target = await loadDraftTarget(supabase, profile.id, parsed.data.profile_id);
  // Fora de try/catch: redirect() interrompe a renderização lançando um erro do Next.
  if (target.kind === "existing") redirect(conversationHref(target.conversationId));
  if (target.kind === "self") {
    return (
      <Problem title="Não foi possível abrir a conversa">
        Você não pode mandar mensagem para si mesma.
      </Problem>
    );
  }
  if (target.kind === "not-found") {
    return <Problem title="Não foi possível abrir a conversa">{PROFILE_NOT_FOUND}</Problem>;
  }
  if (target.kind === "error") {
    return (
      <Problem title="Não conseguimos abrir a conversa agora">
        Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
      </Problem>
    );
  }

  const { person, connected, highSchool } = target;
  const otherFirst = firstName(person.full_name) || person.full_name;

  return (
    <ChatScreen
      key={person.id}
      conversationId={null}
      draftProfileId={person.id}
      other={{
        id: person.id,
        full_name: person.full_name,
        first_name: otherFirst,
        avatar_url: person.avatar_url,
        headline: person.headline,
        career_stage: person.career_stage,
      }}
      messages={[]}
      truncatedLimit={null}
      state={draftState({ otherFirstName: otherFirst, connected, highSchool })}
      starters={conversationStarters(otherFirst)}
      nowIso={new Date().toISOString()}
      latestUnreadId={null}
      backHref="/mensagens"
    />
  );
}
