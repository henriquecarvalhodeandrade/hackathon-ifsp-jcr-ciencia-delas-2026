"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Flag, MoreHorizontal, UserRound } from "lucide-react";
import { ReportButton } from "@/components/moderation/report-button";
import { ActionMenu, type ActionMenuItem } from "@/components/network/action-menu";

/**
 * "⋯" da conversa: Ver perfil e Denunciar perfil (conversas diretas são privadas — denuncia-se o
 * perfil, docs/09). O diálogo de denúncia é o do `ReportButton`, aberto pelo item do menu: o
 * gatilho próprio dele fica escondido e recebe o clique (mesmo truque do menu do feed). Ao fechar
 * o diálogo, o foco volta para o "⋯".
 */
export function ConversationMenu({ profileId, name }: { profileId: string; name: string }) {
  const router = useRouter();
  const reportSlot = useRef<HTMLSpanElement>(null);

  const items: ActionMenuItem[] = [
    {
      label: "Ver perfil",
      icon: <UserRound aria-hidden="true" />,
      onSelect: () => router.push(`/pesquisadoras/${profileId}`),
    },
    {
      label: "Denunciar perfil",
      icon: <Flag aria-hidden="true" />,
      tone: "danger",
      onSelect: () =>
        reportSlot.current?.querySelector<HTMLElement>(":scope > span > button")?.click(),
    },
  ];

  return (
    <span className="relative inline-flex shrink-0">
      <ActionMenu
        items={items}
        variant="ghost"
        size="sm"
        align="end"
        srSuffix={`Mais ações: conversa com ${name}`}
        // O ActionMenu sempre desenha uma seta no fim; num botão "⋯" ela sobra (escondida aqui).
        className="size-11 px-0 text-fg-muted [&>svg:last-child]:hidden"
      >
        <MoreHorizontal aria-hidden="true" />
      </ActionMenu>
      <span ref={reportSlot} className="contents [&>span>button]:hidden">
        <ReportButton targetType="profile" targetId={profileId} label="Denunciar perfil" />
      </span>
    </span>
  );
}
