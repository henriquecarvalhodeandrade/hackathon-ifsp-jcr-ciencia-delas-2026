import { MobileTabBar } from "./mobile-tab-bar";
import { loadHeaderSession } from "./site-header";

/**
 * Barra de abas do celular (Server Component, só servidor — como o SiteHeader, NÃO sai pelo
 * índice @/components/layout). Usa a mesma leitura memoizada do cabeçalho: nenhuma ida extra
 * ao banco. Visitantes e cadastros incompletos não veem a barra (todas as áreas dela exigem o
 * cadastro completo). Monte depois do <SiteFooter /> no layout raiz: assim o espaçador fica no
 * fim da página e a barra é a última parada do Tab.
 */
export async function MemberTabBar() {
  const { account, onboarded } = await loadHeaderSession();
  if (!account || !onboarded) return null;
  return <MobileTabBar unreadMessages={account.unreadMessages} />;
}
