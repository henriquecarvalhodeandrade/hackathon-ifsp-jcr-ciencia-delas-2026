import type { MetadataRoute } from "next";
import { PROTECTED_PREFIXES } from "@/lib/constants";
import { getSiteUrl } from "@/lib/env";

/**
 * robots.txt: indexa só as áreas públicas. Áreas de membras (fórum, perfis, mentoria…),
 * autenticação, APIs e as páginas com token da newsletter ficam de fora.
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
      ],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
