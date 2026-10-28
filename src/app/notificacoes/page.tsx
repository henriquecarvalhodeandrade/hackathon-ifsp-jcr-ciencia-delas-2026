import type { Metadata } from "next";
import { BellOff, MessagesSquare } from "lucide-react";
import { NotificationBulkActions } from "@/components/notifications/notification-actions";
import { NotificationList } from "@/components/notifications/notification-list";
import { Alert, ButtonLink, Container, EmptyState, PageHeader, TabNav } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { parseNotificationFilter } from "@/lib/notifications/meta";
import { listMyNotifications } from "@/lib/notifications/queries";

export const metadata: Metadata = {
  title: "Notificações",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[] }>;
}) {
  const user = await requireUser("/notificacoes");
  const filter = parseNotificationFilter((await searchParams).filtro);
  const page = await listMyNotifications(user.id, filter);

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        eyebrow="Sua conta"
        title="Notificações"
        description="Respostas nos seus tópicos, pedidos de mentoria, comentários nos seus papers e o resultado das denúncias que você fez."
        actions={
          page.error || page.total === 0 ? undefined : (
            <NotificationBulkActions unread={page.unread} read={page.read} />
          )
        }
      >
        <TabNav
          label="Filtrar notificações"
          items={[
            {
              href: "/notificacoes",
              label: "Todas",
              count: page.total,
              active: filter === "todas",
            },
            {
              href: "/notificacoes?filtro=nao-lidas",
              label: "Não lidas",
              count: page.unread,
              active: filter === "nao-lidas",
            },
          ]}
        />
      </PageHeader>

      {page.error ? (
        <Alert variant="danger" title="Não conseguimos carregar suas notificações">
          Verifique sua conexão e recarregue a página. Se o problema continuar, tente de novo em
          alguns minutos.
        </Alert>
      ) : page.items.length === 0 ? (
        filter === "nao-lidas" && page.total > 0 ? (
          <EmptyState
            icon={<BellOff />}
            title="Tudo em dia por aqui"
            description="Você já leu todas as suas notificações. As antigas continuam na aba “Todas”."
            action={
              <ButtonLink href="/notificacoes" variant="outline">
                Ver todas
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<BellOff />}
            title="Nenhuma notificação ainda"
            description="Quando alguém responder a um tópico seu, pedir sua mentoria ou comentar um paper que você divulgou — ou quando a moderação concluir uma denúncia sua —, o aviso aparece aqui."
            action={
              <ButtonLink href="/forum">
                <MessagesSquare aria-hidden="true" />
                Ir para o fórum
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <NotificationList items={page.items} />
          {page.truncated && (
            <p className="mt-4 text-center text-sm text-fg-subtle">
              Mostrando as 100 notificações mais recentes. Use “Limpar lidas” para organizar a
              lista.
            </p>
          )}
        </>
      )}
    </Container>
  );
}
