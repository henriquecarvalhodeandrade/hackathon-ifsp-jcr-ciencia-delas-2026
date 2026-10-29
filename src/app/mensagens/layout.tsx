import type { Viewport } from "next";
import { InboxPanel } from "@/components/messages/inbox-panel";
import { MessagesLive } from "@/components/messages/messages-live";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { buildInbox } from "@/lib/messages/inbox";
import { getInbox } from "@/lib/messages/queries";

/**
 * No Android, o teclado encolhe a área da página (e o `100dvh`): o campo do chat fica acima dele
 * em vez de coberto. (O iOS ignora e rola a tela até o campo.)
 */
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

/**
 * A área de mensagens ocupa a tela toda abaixo do cabeçalho, sem o rodapé do site — como um app:
 *  - computador (lg+): sempre — caixa de entrada à esquerda, conversa à direita, cada uma com a
 *    própria rolagem; o campo do chat fica sempre visível;
 *  - celular: só com uma conversa aberta (`data-chat-open`): a conversa é a tela inteira e a lista
 *    some; na lista (/mensagens) a página rola normalmente.
 * Sem JavaScript e sem medir o cabeçalho (a faixa do modo demonstração muda de altura): o corpo
 * vira uma coluna da altura da tela e o <main> fica com o que sobra. `:has()` liga e desliga as
 * regras sozinho quando se entra ou sai das mensagens.
 */
const APP_SCREEN_CSS = `
@media (min-width: 64rem) {
  body:has([data-messages-app]) { height: 100dvh; overflow: hidden; }
  body:has([data-messages-app]) > main { display: flex; flex-direction: column; min-height: 0; }
  body:has([data-messages-app]) > footer { display: none; }
}
@media (max-width: 63.98rem) {
  body:has([data-chat-open]) { height: 100dvh; overflow: hidden; }
  body:has([data-chat-open]) > main { display: flex; flex-direction: column; min-height: 0; }
  body:has([data-chat-open]) > footer { display: none; }
  body:has([data-chat-open]) [data-messages-app] { padding: 0; }
  body:has([data-chat-open]) [data-inbox-pane] { display: none; }
}
`;

/**
 * Layout de /mensagens: a caixa de entrada fica aqui e não é recriada ao trocar de conversa (a
 * lista não pisca nem volta para o topo); as páginas desenham só o painel da direita. Sem
 * loading.tsx neste nível: ele envolveria o [id]/layout.tsx e o 404 de quem não participa da
 * conversa viraria um 200 com streaming. A lista se atualiza pelo `MessagesLive` (Realtime +
 * atualização periódica) e pelas actions (revalidatePath).
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  // Sem sessão/cadastro, as páginas redirecionam (cada uma com o seu `next`).
  const profile = isSupabaseConfigured() ? await getCurrentProfile() : null;
  if (!profile?.onboarded_at) return children;

  const { rows, failed } = await getInbox();
  const inbox = buildInbox(rows, profile.id);

  return (
    <div
      data-messages-app=""
      className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:px-8"
    >
      {/* A conversa vem antes da lista na ordem de leitura; no computador a grade a põe à direita. */}
      <div className="flex min-h-0 flex-col max-lg:has-[[data-chat-open]]:flex-1 lg:col-start-2 lg:row-start-1">
        {children}
      </div>
      <InboxPanel
        inbox={inbox}
        failed={failed}
        nowIso={new Date().toISOString()}
        className="lg:col-start-1 lg:row-start-1"
      />
      <MessagesLive />
      <style>{APP_SCREEN_CSS}</style>
    </div>
  );
}
