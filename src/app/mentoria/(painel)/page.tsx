import type { Metadata } from "next";
import { HeartHandshake, Inbox, Send, Settings2, Sparkles } from "lucide-react";
import { z } from "zod";
import {
  Alert,
  ButtonLink,
  Container,
  EmptyState,
  PageHeader,
  TabNav,
  type TabNavItem,
} from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  MENTORSHIP_TAB_LABELS,
  parseNotice,
  parseTab,
  resolveTab,
  tabHref,
  type MentorshipTab,
} from "@/lib/mentorship/presentation";
import { hasConversation } from "@/lib/mentorship/conversation";
import { loadUnreadCounts } from "@/lib/mentorship/conversation-queries";
import { loadAreaNames, loadMyRequests } from "@/lib/mentorship/queries";
import { createClient } from "@/lib/supabase/server";
import { ScrollActiveTab } from "@/components/mentorship/scroll-active-tab";
import { ActiveTab, ReceivedTab, SentTab } from "./_sections/request-tabs";
import { SuggestionsTab } from "./_sections/suggestions-tab";

export const metadata: Metadata = { title: "Mentoria" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const mentorParam = z.guid();
const TAB_NAV_LABEL = "Seções da mentoria";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MentoriaPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) {
    return (
      <Container className="py-12">
        <EmptyState
          icon={<HeartHandshake />}
          title="A mentoria ainda não está disponível neste ambiente"
          description="Configure o Supabase (veja o aviso no topo da página) para usar sugestões e pedidos de mentoria."
        />
      </Container>
    );
  }

  const params = await searchParams;
  const parsedMentor = mentorParam.safeParse(first(params.mentora));
  const deepLinkId = parsedMentor.success ? parsedMentor.data : null;
  const requestedTab = parseTab(params.aba);
  const next = deepLinkId
    ? `/mentoria?mentora=${deepLinkId}`
    : requestedTab
      ? `/mentoria?aba=${requestedTab}`
      : "/mentoria";

  const profile = await requireOnboardedProfile(next);
  const supabase = await createClient();
  const areaNames = await loadAreaNames(supabase);
  const { items: requests, failed } = await loadMyRequests(supabase, profile.id, areaNames);

  const sent = requests.filter((r) => r.role === "mentee");
  const received = requests.filter((r) => r.role === "mentor");
  const pendingSent = sent.filter((r) => r.status === "pending").length;
  const pendingReceived = received.filter((r) => r.status === "pending").length;
  const activeCount = requests.filter((r) => r.status === "accepted").length;
  const showReceived = profile.is_mentor || received.length > 0;

  const tab = resolveTab({
    requested: requestedTab,
    showReceived,
    seeksMentorship: profile.seeks_mentorship,
    isMentor: profile.is_mentor,
    pendingReceived,
    hasDeepLink: Boolean(deepLinkId),
  });
  const notice = parseNotice(params.aviso);
  // Selos de mensagens não lidas nos botões "Conversar" (abas com pedidos).
  const unread =
    tab === "sugestoes"
      ? new Map<string, number>()
      : await loadUnreadCounts(
          supabase,
          profile.id,
          requests.filter(hasConversation).map((r) => r.id),
        );

  const tabItem = (id: MentorshipTab, icon: React.ReactNode, count?: number): TabNavItem => ({
    href: tabHref(id),
    label: MENTORSHIP_TAB_LABELS[id],
    icon,
    count: count && count > 0 ? count : undefined,
    active: tab === id,
  });
  const tabs: TabNavItem[] = [
    tabItem("sugestoes", <Sparkles aria-hidden="true" />),
    tabItem("enviadas", <Send aria-hidden="true" />, pendingSent),
    ...(showReceived ? [tabItem("recebidas", <Inbox aria-hidden="true" />, pendingReceived)] : []),
    tabItem("ativas", <HeartHandshake aria-hidden="true" />, activeCount),
  ];

  return (
    <Container>
      <PageHeader
        eyebrow="Mentoria"
        title="Mentoria entre pesquisadoras"
        description="Encontre mentoras que combinam com a sua pesquisa, acompanhe seus pedidos e combine os próximos passos."
        actions={
          <ButtonLink href="/perfil" variant="outline">
            <Settings2 aria-hidden="true" />
            Preferências de mentoria
          </ButtonLink>
        }
      >
        <TabNav label={TAB_NAV_LABEL} items={tabs} />
        <ScrollActiveTab navLabel={TAB_NAV_LABEL} activeKey={tab} />
      </PageHeader>

      <div className="grid gap-6 pb-14">
        {notice && (
          <Alert variant={notice.variant} title={notice.title} live>
            {notice.body}
          </Alert>
        )}
        {failed && (
          <Alert variant="danger" title="Não conseguimos carregar seus pedidos agora">
            Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
          </Alert>
        )}

        {tab === "sugestoes" && (
          <SuggestionsTab
            supabase={supabase}
            profile={profile}
            sent={sent}
            areaNames={areaNames}
            deepLinkId={deepLinkId}
          />
        )}
        {tab === "enviadas" && (
          <SentTab sent={sent} seeksMentorship={profile.seeks_mentorship} unread={unread} />
        )}
        {tab === "recebidas" && (
          <ReceivedTab profile={profile} received={received} unread={unread} />
        )}
        {tab === "ativas" && (
          <ActiveTab
            supabase={supabase}
            requests={requests}
            isMentor={profile.is_mentor}
            seeksMentorship={profile.seeks_mentorship}
            unread={unread}
          />
        )}
      </div>
    </Container>
  );
}
