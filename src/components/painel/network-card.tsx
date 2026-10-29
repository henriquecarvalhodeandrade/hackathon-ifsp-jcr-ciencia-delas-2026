import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Network,
  Newspaper,
  UserPlus,
} from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/utils";
import { PainelSection } from "./painel-section";

interface NetworkItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}

interface NetworkPending {
  invites: number;
  conversations: number;
  applications: number;
}

/** O que pede uma ação dela na rede social (docs/18). Leituras com a sessão (RLS). */
async function loadNetworkPending(userId: string): Promise<NetworkPending | null> {
  try {
    const supabase = await createClient();
    const [invites, conversations, opportunities] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", userId)
        .eq("status", "pending"),
      supabase.rpc("count_unread_conversations"),
      supabase.from("research_opportunities").select("id").eq("owner_id", userId),
    ]);
    if (invites.error || conversations.error || opportunities.error) return null;

    const ids = (opportunities.data ?? []).map((o) => o.id);
    let applications = 0;
    if (ids.length > 0) {
      const { count, error } = await supabase
        .from("opportunity_applications")
        .select("id", { count: "exact", head: true })
        .in("opportunity_id", ids)
        .eq("status", "submitted");
      if (error) return null;
      applications = count ?? 0;
    }
    return { invites: invites.count ?? 0, conversations: conversations.data ?? 0, applications };
  } catch {
    return null;
  }
}

export function networkItems(pending: NetworkPending): NetworkItem[] {
  const items: NetworkItem[] = [];
  if (pending.conversations > 0) {
    items.push({
      key: "mensagens",
      href: "/mensagens",
      icon: <MessageCircle />,
      title: pluralize(
        pending.conversations,
        "conversa com mensagem nova",
        "conversas com mensagens novas",
      ),
    });
  }
  if (pending.invites > 0) {
    items.push({
      key: "convites",
      href: "/rede?aba=convites",
      icon: <UserPlus />,
      title: pluralize(
        pending.invites,
        "convite de conexão para responder",
        "convites de conexão para responder",
      ),
    });
  }
  if (pending.applications > 0) {
    items.push({
      key: "candidaturas",
      href: "/ics/minhas?aba=publicadas",
      icon: <ClipboardList />,
      title: pluralize(
        pending.applications,
        "candidatura nova nas suas vagas de IC",
        "candidaturas novas nas suas vagas de IC",
      ),
    });
  }
  return items;
}

/**
 * "Na sua rede" (Server Component, lê por conta própria como os outros blocos independentes):
 * conversas diretas novas, convites de conexão e candidaturas para responder, com o atalho para
 * o feed sempre à mão.
 */
export async function NetworkCard({ userId }: { userId: string }) {
  const pending = await loadNetworkPending(userId);
  const items = pending ? networkItems(pending) : [];
  return (
    <PainelSection
      titleId="painel-rede"
      title="Na sua rede"
      icon={<Network />}
      failed={pending === null}
      action={
        <ButtonLink href="/feed" variant="outline" size="sm">
          <Newspaper aria-hidden="true" />
          Ir para o feed
        </ButtonLink>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nada esperando por você na rede agora. Conte no feed no que você está trabalhando ou
          encontre pessoas para{" "}
          <Link href="/rede" className="font-semibold text-primary underline underline-offset-2">
            se conectar
          </Link>
          .
        </p>
      ) : (
        <ul className="-mx-2 grid gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary ring-1 ring-border group-hover:bg-surface [&_svg]:size-4"
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 font-semibold text-pretty text-fg group-hover:text-primary">
                  {item.title}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PainelSection>
  );
}
