import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/components/layout/theme";
import { SITE } from "@/lib/constants";

/**
 * Manifesto do app instalável (PWA), servido em /manifest.webmanifest; o Next adiciona o
 * <link rel="manifest"> sozinho. Sem service worker: o app é dinâmico e precisa de conexão.
 *
 * Cores: o fundo do tema claro (--color-bg, o mesmo do <meta name="theme-color">), para a tela de
 * abertura e a barra do sistema não piscarem em outra cor quando a página carrega.
 * Ícones: gerados da geometria da marca com `npm run brand:pwa` (scripts/brand/build-pwa-icons.mjs).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: SITE.locale,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["education", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
