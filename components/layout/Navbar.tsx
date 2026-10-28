"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  MessageSquare,
  Users,
  Rss,
  User,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { WomanBadge } from "@/components/common/WomanBadge";
import { signOut } from "@/lib/actions/auth";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface NavbarProps {
  profile: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLinks = [
    { href: "/feed", label: "Feed", icon: Rss },
    { href: "/explore", label: "Explorar IC", icon: Compass },
    { href: "/network", label: "Rede", icon: Users },
    { href: "/messages", label: "Mensagens", icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/feed" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-heading font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
              Á
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight text-foreground">
              Ártemis
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Menu (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          {profile && (
            <div className="flex items-center gap-3 pl-2 border-l border-border">
              <Link
                href={`/profile/${profile.username}`}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs ring-1 ring-primary/30">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {profile.full_name}
                    </span>
                    {profile.is_self_declared_woman && (
                      <WomanBadge size="xs" showLabel={false} />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    @{profile.username}
                  </span>
                </div>
              </Link>

              <form action={signOut}>
                <button
                  type="submit"
                  title="Sair da conta"
                  aria-label="Sair"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu principal"
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card px-4 pt-2 pb-4 space-y-2">
          {profile && (
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <Link
                href={`/profile/${profile.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-sm ring-1 ring-primary/30">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {profile.full_name}
                    </span>
                    {profile.is_self_declared_woman && (
                      <WomanBadge size="xs" showLabel={false} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    @{profile.username}
                  </span>
                </div>
              </Link>

              <form action={signOut}>
                <button
                  type="submit"
                  className="text-xs font-semibold text-destructive px-2 py-1 rounded hover:bg-destructive/10"
                >
                  Sair
                </button>
              </form>
            </div>
          )}

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  isActive
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
