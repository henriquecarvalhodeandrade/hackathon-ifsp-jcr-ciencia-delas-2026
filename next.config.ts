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
};

export default nextConfig;
