import { notFound } from "next/navigation";
import { Alert, ButtonLink } from "@/components/ui";
import { ChatScreen } from "@/components/messages/chat-screen";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CONVERSATION_MESSAGE_LIMIT,
  conversationStarters,
  conversationState,
  latestUnreadFromOther,
} from "@/lib/messages/conversation";
import { inboxHref } from "@/lib/messages/inbox";
import { getDirectConversation } from "@/lib/messages/queries";
import { conversationIdSchema } from "@/lib/messages/schema";
import { firstName } from "@/lib/mentorship/presentation";

type Params = Promise<{ id: string }>;

/**
 * Conversa direta: só o painel da direita (a caixa de entrada fica no layout). No celular, a tela
 * inteira do chat. Quem não participa recebe 404 de verdade (checado no [id]/layout.tsx).
 */
export default async function DirectConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mensagens/${id}`);
  if (!isSupabaseConfigured()) notFound();
  if (!conversationIdSchema.safeParse(id).success) notFound();

  // O layout já respondeu 404 para quem não participa; aqui é só para o tipo.
  const result = await getDirectConversation(id, profile.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <div className="max-lg:mb-6">
        <h1 className="sr-only">Mensagens</h1>
        <Alert
          variant="danger"
          title="Não conseguimos carregar a conversa agora"
          actions={<ButtonLink href={`/mensagens/${id}`}>Tentar de novo</ButtonLink>}
        >
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      </div>
    );
  }

  const { status, iAmInitiator, other, messages, truncated, mySentCount } = result.conversation;
  const otherFirst = firstName(other.full_name) || other.full_name;
  const state = conversationState({
    status,
    iAmInitiator,
    mySentCount,
    otherFirstName: otherFirst,
  });
  // Voltar (celular) para a aba em que esta conversa aparece.
  const backHref = inboxHref(!iAmInitiator && status !== "active" ? "pedidos" : "conversas");

  return (
    <ChatScreen
      // Trocar de conversa recria a tela (provisórias e linhas de sistema são de cada conversa).
      key={id}
      conversationId={id}
      other={{
        id: other.id,
        full_name: other.full_name,
        first_name: otherFirst,
        avatar_url: other.avatar_url,
        headline: other.headline,
        career_stage: other.career_stage,
      }}
      messages={messages}
      truncatedLimit={truncated ? CONVERSATION_MESSAGE_LIMIT : null}
      state={state}
      starters={messages.length === 0 && state.canSend ? conversationStarters(otherFirst) : []}
      nowIso={new Date().toISOString()}
      latestUnreadId={latestUnreadFromOther(messages)?.id ?? null}
      backHref={backHref}
    />
  );
}
