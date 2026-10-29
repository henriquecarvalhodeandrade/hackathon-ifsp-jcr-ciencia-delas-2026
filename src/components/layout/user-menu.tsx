import {
  Bell,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/utils";

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
 * Moderação, Sair).
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
  const items: DropdownItem[] = [
    { href: "/painel", label: "Meu painel", icon: <LayoutDashboard aria-hidden="true" /> },
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
      triggerClassName="ring-2 ring-transparent hover:ring-border-strong aria-expanded:ring-primary"
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
