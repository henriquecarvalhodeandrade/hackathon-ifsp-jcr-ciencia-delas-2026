"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function isActivePath(pathname: string | null, href: string): "page" | "section" | false {
  if (!pathname) return false;
  if (pathname === href) return "page";
  if (href !== "/" && pathname.startsWith(`${href}/`)) return "section";
  return false;
}

export interface NavLinkProps extends Omit<React.ComponentProps<typeof Link>, "href" | "className"> {
  href: string;
  className?: string;
  /** Classes extras quando ativo (página ou seção). */
  activeClassName?: string;
}

/**
 * Link de navegação que sabe se está ativo (usa usePathname).
 * Página exata → aria-current="page"; dentro da seção → aria-current="true".
 */
export function NavLink({ href, className, activeClassName, ...props }: NavLinkProps) {
  const active = isActivePath(usePathname(), href);
  return (
    <Link
      href={href}
      aria-current={active === "page" ? "page" : active === "section" ? "true" : undefined}
      data-active={active ? "" : undefined}
      className={cn(className, active && activeClassName)}
      {...props}
    />
  );
}
