import type { Metadata } from "next";
import { Inbox, Lightbulb, Search, UserCheck, Users, UsersRound } from "lucide-react";
import {
  ButtonLink,
  Container,
  EmptyState,
  PageHeader,
  TabNav,
  type TabNavItem,
} from "@/components/ui";
import { ScrollActiveTab } from "@/components/mentorship/scroll-active-tab";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  DEFAULT_NETWORK_TAB,
  NETWORK_TAB_LABELS,
  networkTabHref,
  parseNetworkTab,
  type NetworkTab,
} from "@/lib/network/presentation";
import { loadTabCounts } from "@/lib/network/queries";
import { createClient } from "@/lib/supabase/server";
import { ConnectionsTab, InvitesTab } from "./_sections/connection-tabs";
import { FollowersTab, FollowingTab } from "./_sections/follow-tabs";
import { SuggestionsTab } from "./_sections/suggestions-tab";

export const metadata: Metadata = {
  title: "Minha rede",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TAB_NAV_LABEL = "Seções da rede";

export default async function RedePage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) {
    return (
      <Container className="py-12">
        <EmptyState
          icon={<Users />}
          title="A rede ainda não está disponível neste ambiente"
          description="Configure o Supabase (veja o aviso no topo da página) para seguir e se conectar com outras pesquisadoras."
        />
      </Container>
    );
  }

  const requested = parseNetworkTab((await searchParams).aba);
  const tab: NetworkTab = requested ?? DEFAULT_NETWORK_TAB;
  const me = await requireOnboardedProfile(networkTabHref(tab));
  const supabase = await createClient();
  const counts = await loadTabCounts(supabase, me.id);

  const tabItem = (id: NetworkTab, icon: React.ReactNode, count?: number): TabNavItem => ({
    href: networkTabHref(id),
    label: NETWORK_TAB_LABELS[id],
    icon,
    count: count && count > 0 ? count : undefined,
    active: tab === id,
  });
  const tabs: TabNavItem[] = [
    tabItem("sugestoes", <Lightbulb aria-hidden="true" />),
    tabItem("convites", <Inbox aria-hidden="true" />, counts.invitesReceived),
    tabItem("conexoes", <UsersRound aria-hidden="true" />, counts.connections),
    tabItem("seguindo", <UserCheck aria-hidden="true" />, counts.following),
    tabItem("seguidoras", <Users aria-hidden="true" />, counts.followers),
  ];

  return (
    <Container>
      <PageHeader
        compactOnMobile
        eyebrow="Comunidade"
        title="Minha rede"
        description="Conecte-se com pesquisadoras da sua área, responda convites e acompanhe quem você segue. As publicações de quem você segue aparecem no seu feed."
        actions={
          <ButtonLink href="/pesquisadoras" variant="outline">
            <Search aria-hidden="true" />
            Procurar pesquisadoras
          </ButtonLink>
        }
      >
        <TabNav label={TAB_NAV_LABEL} items={tabs} />
        <ScrollActiveTab navLabel={TAB_NAV_LABEL} activeKey={tab} />
      </PageHeader>

      <div className="grid gap-6 pb-14">
        {tab === "sugestoes" && <SuggestionsTab supabase={supabase} myId={me.id} />}
        {tab === "convites" && <InvitesTab supabase={supabase} myId={me.id} />}
        {tab === "conexoes" && <ConnectionsTab supabase={supabase} myId={me.id} />}
        {tab === "seguindo" && <FollowingTab supabase={supabase} myId={me.id} />}
        {tab === "seguidoras" && <FollowersTab supabase={supabase} myId={me.id} />}
      </div>
    </Container>
  );
}
