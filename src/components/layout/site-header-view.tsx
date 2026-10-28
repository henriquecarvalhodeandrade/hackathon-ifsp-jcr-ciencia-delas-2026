import Link from "next/link";
import { Bell } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn, formatNumber } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { MEMBER_NAV, PUBLIC_NAV } from "./nav-items";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/*
 * Parte visual do cabeçalho, sem acesso a dados — pode ser importada de qualquer lugar
 * (inclusive Client Components). Quem busca a sessão é o SiteHeader (site-header.tsx, servidor).
 */

/** Dados da conta exibidos no cabeçalho (null = visitante). */
export interface HeaderAccount {
  id: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  unread: number;
  isModerator: boolean;
}

export interface SiteHeaderViewProps {
  account: HeaderAccount | null;
  /** Fixo no topo (padrão). Desligue para pré-visualizações. */
  sticky?: boolean;
  /** Nome acessível da navegação principal. */
  navLabel?: string;
}

/** Link da navegação desktop: o item ativo ganha um "nó" (ponto) da constelação embaixo. */
const desktopLink = cn(
  "relative inline-flex h-10 items-center rounded-control px-3 text-[0.9375rem] font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
  "after:absolute after:bottom-0.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-transparent after:transition-colors",
);
const desktopActive = "text-fg after:bg-primary";

/** Cabeçalho "puro" (sem buscar dados) — usado pelo SiteHeader e pelo guia vivo. */
export function SiteHeaderView({ account, sticky = true, navLabel = "Principal" }: SiteHeaderViewProps) {
  const items = account ? MEMBER_NAV : PUBLIC_NAV;
  return (
    <header
      className={cn(
        "z-40 border-b border-border bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75",
        sticky && "sticky top-0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="-ml-1 rounded-control px-1 py-1" aria-label="Artemis — página inicial">
          <Logo size={28} />
        </Link>

        <nav aria-label={navLabel} className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} className={desktopLink} activeClassName={desktopActive}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />

          {account ? (
            <>
              <Link
                href="/notificacoes"
                className="relative inline-flex size-10 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-5"
              >
                <Bell aria-hidden="true" />
                <span className="sr-only">
                  Notificações{account.unread > 0 ? ` (${formatNumber(account.unread)} não lidas)` : ""}
                </span>
                {account.unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="tabular absolute top-1 right-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-accent px-1 text-[0.6875rem] leading-none font-bold text-accent-fg ring-2 ring-bg"
                  >
                    {account.unread > 99 ? "99+" : account.unread}
                  </span>
                )}
              </Link>
              <div className="hidden lg:block">
                <UserMenu
                  name={account.name}
                  avatarUrl={account.avatarUrl}
                  profileId={account.id}
                  headline={account.headline}
                  unread={account.unread}
                  isModerator={account.isModerator}
                />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink href="/entrar" variant="ghost" size="sm" className="text-fg">
                Entrar
              </ButtonLink>
              <ButtonLink href="/cadastro" size="sm">
                Criar conta
              </ButtonLink>
            </div>
          )}

          <div className="lg:hidden">
            <MobileNav
              items={items}
              account={
                account ? { name: account.name, unread: account.unread, isModerator: account.isModerator } : null
              }
            />
          </div>
        </div>
      </div>
    </header>
  );
}
