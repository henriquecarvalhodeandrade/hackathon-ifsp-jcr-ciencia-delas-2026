import type { MetadataRoute } from "next";
import { PROTECTED_PREFIXES } from "@/lib/constants";
import { getSiteUrl } from "@/lib/env";

/**
 * robots.txt: indexa só as áreas públicas. Áreas de membras (fórum, perfis, mentoria, painel…),
 * autenticação, APIs, as páginas com token (newsletter, acompanhamento do Pergunte), as páginas
 * de cada declaração verificada e o modo demonstração ficam de fora. Todas elas também têm
 * noindex.
 */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        ...PROTECTED_PREFIXES,
        "/papers/*/editar",
        "/entrar",
        "/cadastro",
        "/recuperar-senha",
        "/redefinir-senha",
        "/auth/",
        "/api/",
        "/newsletter/confirmar",
        "/newsletter/cancelar",
        "/pergunte/acompanhar/",
        "/verificar/",
        "/demo",
      ],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
