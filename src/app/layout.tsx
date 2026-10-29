import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
  Newsreader,
} from "next/font/google";
import { DemoBanner } from "@/components/demo/demo-banner";
import { MemberTabBar } from "@/components/layout/member-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";
import { THEME_COLORS, THEME_SCRIPT } from "@/components/layout/theme";
import { Toaster } from "@/components/ui/toast";
import { SITE } from "@/lib/constants";
import { getSiteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import "./globals.css";

/* Tipografia — todas variáveis, com latin-ext (acentos do português e nomes estrangeiros). */
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

// Sem métricas de fallback no next/font para as Atkinson: declaramos o fallback à mão.
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-atkinson",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
});

const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  // App instalável: o manifesto vem de app/manifest.ts; no iOS, "Adicionar à Tela de Início"
  // abre em tela cheia com este nome e o apple-icon.
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
  keywords: [
    "mulheres na ciência",
    "pesquisadoras",
    "mentoria",
    "divulgação científica",
    "papers",
    "IFSP Jacareí",
    "hackathon",
  ],
  authors: [{ name: `Equipe ${SITE.name} — Hackathon IFSP Jacareí 2026` }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.tagline,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        display.variable,
        sans.variable,
        serif.variable,
        mono.variable,
        // Com a barra de abas do celular, o foco/âncoras não param escondidos atrás dela.
        "max-lg:has-[[data-tab-bar]]:scroll-pb-[calc(4.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (sem flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        {/* Só com DEMO_MODE=true e uma conta fictícia logada (docs/14). */}
        <DemoBanner />
        <SiteHeader />
        <SupabaseSetupNotice />
        <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        {/* Barra de abas do celular (membras): Início, Feed, Rede, ICs, Mensagens. */}
        <MemberTabBar />
        {/* Avisos rápidos (toast) — um só, acima da barra de abas no celular. */}
        <Toaster />
      </body>
    </html>
  );
}
