import { cache } from "react";
import { HeaderLive } from "@/components/messages/header-live";
import { getCurrentProfile, isModerator, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeaderView, type HeaderAccount } from "./site-header-view";

export { SiteHeaderView, type HeaderAccount, type SiteHeaderViewProps } from "./site-header-view";

/**
 * Notificações não lidas do sino. Os avisos de mensagem direta ficam de fora: o ícone de
 * mensagens (e a barra de abas do celular) já conta essas conversas — contar nos dois lugares
 * fazia a mesma mensagem aparecer duas vezes. Eles continuam listados em /notificacoes.
 */
async function countUnread(profileId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .is("read_at", null)
      .neq("type", "direct_message");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Conversas diretas com mensagem nova (RPC do banco; 0 se algo falhar). */
async function countUnreadConversations(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("count_unread_conversations");
    if (error) return 0;
    return data ?? 0;
  } catch {
    return 0;
  }
}

async function loadProfile(): Promise<Profile | null> {
  try {
    return await getCurrentProfile();
  } catch {
    return null;
  }
}

export interface HeaderSession {
  /** null = visitante. */
  account: HeaderAccount | null;
  /** Terminou o cadastro (onboarding). As áreas da rede exigem isso. */
  onboarded: boolean;
}

/**
 * Sessão, notificações e mensagens não lidas — memoizado por requisição: o cabeçalho e a barra
 * de abas do celular (MemberTabBar) leem a mesma coisa sem repetir as idas ao banco.
 */
export const loadHeaderSession = cache(async (): Promise<HeaderSession> => {
  const profile = await loadProfile();
  if (!profile) return { account: null, onboarded: false };
  const [unread, unreadMessages] = await Promise.all([
    countUnread(profile.id),
    countUnreadConversations(),
  ]);
  return {
    onboarded: Boolean(profile.onboarded_at),
    account: {
      id: profile.id,
      name: profile.full_name?.trim() || "Pesquisadora",
      avatarUrl: profile.avatar_url,
      headline: profile.headline,
      unread,
      unreadMessages,
      isModerator: isModerator(profile),
    },
  };
});

/**
 * Cabeçalho do site (Server Component): busca a sessão, as notificações e as mensagens não lidas.
 * Para membras com cadastro completo, HeaderLive mantém os selos (cabeçalho e barra de abas) ao vivo.
 */
export async function SiteHeader() {
  const { account, onboarded } = await loadHeaderSession();
  return (
    <>
      <SiteHeaderView account={account} />
      {account && onboarded && (
        <HeaderLive messages={account.unreadMessages} notifications={account.unread} />
      )}
    </>
  );
}
