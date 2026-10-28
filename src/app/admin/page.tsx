import type { Metadata } from "next";
import { Flag, Newspaper, ScrollText, ShieldCheck, Users } from "lucide-react";
import { AuditLogPanel } from "@/components/admin/audit-log";
import { AdminFlashRegion } from "@/components/admin/flash";
import { MembersPanel } from "@/components/admin/members-panel";
import { NewsletterPanel } from "@/components/admin/newsletter-panel";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { Badge, Container, PageHeader, TabNav, type TabNavItem } from "@/components/ui";
import { requireModerator } from "@/lib/auth";
import {
  parseAdminTab,
  parsePage,
  parseReportStatus,
  parseRoleFilter,
  parseSearch,
  ROLE_LABELS,
} from "@/lib/admin/params";
import { listAuditLog, listEditionsForAdmin, listMembers, listReports } from "@/lib/admin/queries";
import { getNewsletterOverview, type NewsletterOverview } from "@/lib/newsletter/service";

export const metadata: Metadata = {
  title: "Moderação",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Conteúdo de uma aba: o título (h2) é só para leitores de tela — a aba ativa já o mostra. */
function TabSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-5 pb-4">
      <h2 id={id} className="sr-only">
        {title}
      </h2>
      {description && <p className="text-fg-muted">{description}</p>}
      {children}
    </section>
  );
}

/** Inscritas e transporte de e-mail (service role). Sem a chave secreta, o painel mostra um aviso. */
async function loadNewsletterOverview(): Promise<NewsletterOverview | null> {
  try {
    return await getNewsletterOverview();
  } catch (error) {
    console.error("[admin] falha ao ler a visão geral da newsletter", error instanceof Error ? error.message : "erro");
    return null;
  }
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  // Moderadoras e admins; para as demais pessoas a rota "não existe" (404).
  const profile = await requireModerator();
  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const tab = parseAdminTab(params.aba, { canSeeNewsletter: isAdmin });
  const page = parsePage(params.pagina);

  const reportStatus = parseReportStatus(params.status);
  const q = parseSearch(params.q);
  const role = parseRoleFilter(params.papel);

  const [reports, members, editions, audit] = await Promise.all([
    // A contagem de abertas aparece na aba mesmo fora dela.
    listReports(tab === "denuncias" ? reportStatus : "open", tab === "denuncias" ? page : 1),
    tab === "membros" ? listMembers({ q, role, page }) : null,
    tab === "newsletter" ? listEditionsForAdmin() : null,
    tab === "registro" ? listAuditLog(page) : null,
  ]);
  const newsletterOverview = tab === "newsletter" ? await loadNewsletterOverview() : null;

  const items: TabNavItem[] = [
    {
      href: "/admin",
      label: "Denúncias",
      icon: <Flag aria-hidden="true" />,
      count: reports.counts.open,
      active: tab === "denuncias",
    },
    ...(isAdmin
      ? [
          {
            href: "/admin?aba=newsletter",
            label: "Newsletter",
            icon: <Newspaper aria-hidden="true" />,
            active: tab === "newsletter",
          },
        ]
      : []),
    { href: "/admin?aba=membros", label: "Membros", icon: <Users aria-hidden="true" />, active: tab === "membros" },
    {
      href: "/admin?aba=registro",
      label: "Registro",
      icon: <ScrollText aria-hidden="true" />,
      active: tab === "registro",
    },
  ];

  return (
    <Container size="wide" className="pb-16">
      <PageHeader
        eyebrow="Moderação"
        title="Painel de moderação"
        description={`${isAdmin ? "Denúncias, Boletim e papéis da comunidade." : "Denúncias e membras da comunidade."} Cada decisão afeta pessoas reais e fica no registro da moderação: aja com cuidado.`}
        actions={
          <Badge variant={isAdmin ? "primary" : "info"} size="md">
            <ShieldCheck aria-hidden="true" />
            Você é {ROLE_LABELS[profile.role].toLowerCase()}
          </Badge>
        }
      >
        <TabNav label="Seções do painel" items={items} />
      </PageHeader>

      {tab === "denuncias" && (
        <TabSection id="aba-denuncias" title="Denúncias">
          <ReportsPanel data={reports} status={reportStatus} page={reports.page} isAdmin={isAdmin} />
        </TabSection>
      )}

      {tab === "newsletter" && editions && (
        <TabSection id="aba-newsletter" title="Boletim Delas" description="Gere, revise e envie a edição semanal.">
          <NewsletterPanel data={editions} overview={newsletterOverview} />
        </TabSection>
      )}

      {tab === "membros" && members && (
        <TabSection
          id="aba-membros"
          title="Membros"
          description={
            isAdmin
              ? "Veja quem está na rede e ajuste papéis de moderação."
              : "Veja quem está na rede e o papel de cada pessoa."
          }
        >
          <MembersPanel
            data={members}
            q={q}
            role={role}
            page={members.page}
            isAdmin={isAdmin}
            currentProfileId={profile.id}
          />
        </TabSection>
      )}

      {tab === "registro" && audit && (
        <TabSection
          id="aba-registro"
          title="Registro da moderação"
          description="Tudo o que a moderação fez, do mais recente para o mais antigo. Só moderadoras e administradoras veem este registro, e ninguém consegue editá-lo ou apagá-lo."
        >
          <AuditLogPanel data={audit} />
        </TabSection>
      )}

      <AdminFlashRegion />
    </Container>
  );
}
