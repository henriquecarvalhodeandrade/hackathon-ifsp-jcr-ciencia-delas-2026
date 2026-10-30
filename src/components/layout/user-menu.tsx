"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  FolderOpen,
  House,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown-menu";
import { cn, formatNumber } from "@/lib/utils";
import { isActivePath } from "./nav-link";

/** Páginas "da conta": nelas o avatar ganha o anel de item ativo. */
const ACCOUNT_PAGES = ["/painel", "/perfil", "/portfolio"] as const;

export interface UserMenuProps {
  name: string;
  avatarUrl: string | null;
  /** id do perfil (cor estável do avatar). */
  profileId: string;
  headline?: string | null;
  unread: number;
  unreadMessages: number;
  isModerator: boolean;
}

/**
 * Menu da conta (avatar → Meu painel, Meu perfil, Meu portfólio, Mensagens, Notificações,
 * Moderação, Sair). Em Meu painel, Meu perfil e Meu portfólio o avatar fica com o anel violeta
 * (a página atual é "da conta"), como o nó embaixo dos itens ativos da barra.
 */
export function UserMenu({
  name,
  avatarUrl,
  profileId,
  headline,
  unread,
  unreadMessages,
  isModerator,
}: UserMenuProps) {
  const pathname = usePathname();
  const onAccountPage = ACCOUNT_PAGES.some((href) => isActivePath(pathname, href) !== false);
  const items: DropdownItem[] = [
    { href: "/painel", label: "Meu painel", icon: <House aria-hidden="true" /> },
    { href: "/perfil", label: "Meu perfil", icon: <UserRound aria-hidden="true" /> },
    { href: "/portfolio", label: "Meu portfólio", icon: <FolderOpen aria-hidden="true" /> },
    {
      href: "/mensagens",
      label: "Mensagens",
      icon: <MessageCircle aria-hidden="true" />,
      end:
        unreadMessages > 0 ? (
          <span className="rounded-pill bg-accent px-1.5 py-px text-xs font-bold text-accent-fg tabular">
            {formatNumber(unreadMessages)}
            <span className="sr-only">
              {unreadMessages === 1 ? " conversa nova" : " conversas novas"}
            </span>
          </span>
        ) : undefined,
    },
    {
      href: "/notificacoes",
      label: "Notificações",
      icon: <Bell aria-hidden="true" />,
      end:
        unread > 0 ? (
          <span className="rounded-pill bg-accent px-1.5 py-px text-xs font-bold text-accent-fg tabular">
            {formatNumber(unread)}
            <span className="sr-only"> não lidas</span>
          </span>
        ) : undefined,
    },
    ...(isModerator
      ? [
          {
            href: "/admin",
            label: "Moderação",
            icon: <ShieldCheck aria-hidden="true" />,
          } satisfies DropdownItem,
        ]
      : []),
    { type: "separator" },
    {
      type: "form",
      action: "/auth/sair",
      method: "post",
      label: "Sair",
      icon: <LogOut aria-hidden="true" />,
      tone: "danger",
    },
  ];

  return (
    <DropdownMenu
      triggerLabel={`Menu da conta de ${name || "você"}`}
      trigger={<Avatar name={name} src={avatarUrl} seed={profileId} size="sm" />}
      triggerClassName={cn(
        "ring-2 ring-transparent hover:ring-border-strong aria-expanded:ring-primary",
        onAccountPage && "ring-primary hover:ring-primary",
      )}
      header={
        <div className="grid gap-0.5">
          <p className="truncate font-semibold text-fg">{name || "Pesquisadora"}</p>
          {headline && <p className="line-clamp-2 text-sm text-fg-muted">{headline}</p>}
        </div>
      }
      items={items}
    />
  );
}
