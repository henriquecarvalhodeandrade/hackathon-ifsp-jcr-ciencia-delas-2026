import type { NextConfig } from "next";

// Cache Components (padrão do create-next-app 16) fica desligado de propósito:
// quase todas as páginas dependem da sessão do Supabase (cookies), então o
// modelo dinâmico clássico é mais simples para o hackathon. Ver docs/adr/0002.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      // Avatares no Supabase Storage (cloud e local)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      // Avatares de login social (Google)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Cabeçalhos de segurança em todas as rotas (páginas, APIs, imagens geradas e /public).
  // Sem CSP completa por enquanto: só `frame-ancestors` (junto com X-Frame-Options, para
  // navegadores antigos) para impedir que o site seja embutido em iframes (clickjacking).
  // HSTS só vale em HTTPS; em http://localhost o navegador ignora.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
