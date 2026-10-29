"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  FlaskConical,
  FolderOpen,
  HeartHandshake,
  House,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageCircleQuestion,
  MessagesSquare,
  Network,
  Newspaper,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { NavLink } from "./nav-link";
import type { NavItem } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

const ICONS: Record<
  string,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "/feed": House,
  "/rede": Network,
  "/ics": FlaskConical,
  "/forum": MessagesSquare,
  "/mentoria": HeartHandshake,
  "/pesquisadoras": Users,
  "/papers": BookOpen,
  "/ranking": Trophy,
  "/newsletter": Newspaper,
  "/pergunte": MessageCircleQuestion,
  "/sobre": Info,
};

export interface MobileNavProps {
  items: readonly NavItem[];
  /** null = visitante. */
  account: {
    name: string;
    unread: number;
    unreadMessages: number;
    isModerator: boolean;
  } | null;
}

const linkClasses =
  "flex h-12 items-center gap-3 rounded-control px-3 text-base font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-5 [&_svg]:text-fg-subtle";
const activeClasses =
  "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft [&_svg]:text-primary-soft-fg";

/** Gaveta de navegação para telas pequenas (<dialog> nativo: foco preso, Esc fecha). */
export function MobileNav({ items, account }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Fecha ao navegar
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      ref.current?.close();
    }
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex size-10 items-center justify-center rounded-control text-fg transition-colors hover:bg-surface-2 [&_svg]:size-6"
      >
        <Menu aria-hidden="true" />
        <span className="sr-only">Abrir menu</span>
      </button>
      <dialog
        ref={ref}
        aria-label="Menu principal"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,calc(100%-3rem))] max-w-none border-l border-border bg-surface p-0 text-fg shadow-overlay open:animate-slide-in-right"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Logo size={26} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg [&_svg]:size-5"
              >
                <X aria-hidden="true" />
                <span className="sr-only">Fechar menu</span>
              </button>
            </div>

            <nav aria-label="Principal" className="flex-1 overflow-y-auto p-3">
              <ul className="grid gap-1">
                {items.map((item) => {
                  const Icon = ICONS[item.href];
                  return (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        {Icon && <Icon aria-hidden={true} />}
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>

              {account && (
                <>
                  <p className="mt-6 mb-2 px-3 eyebrow text-fg-subtle">Sua conta</p>
                  <ul className="grid gap-1">
                    <li>
                      <NavLink
                        href="/painel"
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        <LayoutDashboard aria-hidden="true" />
                        Meu painel
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        href="/perfil"
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        <UserRound aria-hidden="true" />
                        Meu perfil
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        href="/portfolio"
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        <FolderOpen aria-hidden="true" />
                        Meu portfólio
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        href="/mensagens"
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        <MessageCircle aria-hidden="true" />
                        <span className="flex-1">Mensagens</span>
                        {account.unreadMessages > 0 && (
                          <span className="rounded-pill bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg tabular">
                            {formatNumber(account.unreadMessages)}
                            <span className="sr-only">
                              {account.unreadMessages === 1 ? " conversa nova" : " conversas novas"}
                            </span>
                          </span>
                        )}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        href="/notificacoes"
                        className={linkClasses}
                        activeClassName={activeClasses}
                        onClick={() => setOpen(false)}
                      >
                        <Bell aria-hidden="true" />
                        <span className="flex-1">Notificações</span>
                        {account.unread > 0 && (
                          <span className="rounded-pill bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg tabular">
                            {formatNumber(account.unread)}
                            <span className="sr-only"> não lidas</span>
                          </span>
                        )}
                      </NavLink>
                    </li>
                    {account.isModerator && (
                      <li>
                        <NavLink
                          href="/admin"
                          className={linkClasses}
                          activeClassName={activeClasses}
                          onClick={() => setOpen(false)}
                        >
                          <ShieldCheck aria-hidden="true" />
                          Moderação
                        </NavLink>
                      </li>
                    )}
                  </ul>
                </>
              )}
            </nav>

            <div className="grid gap-3 border-t border-border p-4">
              <ThemeToggle showLabel className="justify-start" />
              {account ? (
                <form action="/auth/sair" method="post">
                  <button
                    type="submit"
                    className={cn(linkClasses, "w-full text-danger [&_svg]:text-danger")}
                  >
                    <LogOut aria-hidden="true" />
                    Sair
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <ButtonLink href="/entrar" variant="outline" onClick={() => setOpen(false)}>
                    Entrar
                  </ButtonLink>
                  <ButtonLink href="/cadastro" onClick={() => setOpen(false)}>
                    Criar conta
                  </ButtonLink>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
