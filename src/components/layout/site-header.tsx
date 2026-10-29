import { getCurrentProfile, isModerator, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeaderView, type HeaderAccount } from "./site-header-view";

export { SiteHeaderView, type HeaderAccount, type SiteHeaderViewProps } from "./site-header-view";

async function countUnread(profileId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .is("read_at", null);
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

/** Cabeçalho do site (Server Component): busca a sessão, as notificações e as mensagens não lidas. */
export async function SiteHeader() {
  const profile = await loadProfile();
  const [unread, unreadMessages] = profile
    ? await Promise.all([countUnread(profile.id), countUnreadConversations()])
    : [0, 0];
  const account: HeaderAccount | null = profile
    ? {
        id: profile.id,
        name: profile.full_name?.trim() || "Pesquisadora",
        avatarUrl: profile.avatar_url,
        headline: profile.headline,
        unread,
        unreadMessages,
        isModerator: isModerator(profile),
      }
    : null;
  return <SiteHeaderView account={account} />;
}
