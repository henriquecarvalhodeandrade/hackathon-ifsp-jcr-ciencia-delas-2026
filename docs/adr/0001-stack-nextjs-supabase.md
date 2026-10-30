# ADR 0001 — Next.js 16 (App Router) + Supabase como stack única

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

O time tem poucos dias de hackathon e precisa entregar autenticação, banco relacional, regras de acesso,
armazenamento de imagens e páginas rápidas — sem manter servidor próprio e sem custo.

## Decisão

- **Next.js 16 (App Router, React 19, TypeScript)** para front-end e back-end no mesmo repositório:
  Server Components para leitura, **Server Actions** para mutações e Route Handlers para rotas de máquina
  (cron da newsletter, descadastro one-click, callbacks de login).
- **Supabase** como backend gerenciado: Auth (e-mail/senha, link mágico, Google opcional), Postgres com
  **Row Level Security** (a autorização mora no banco), Storage (avatares) e `pgvector` (embeddings da mentoria).
- **Tailwind CSS v4** com tokens do design system em CSS (`@theme`).
- Deploy sugerido: **Vercel (Hobby)** + **Supabase Cloud (Free)**.

## Consequências

- Toda regra de acesso precisa existir **no banco** (RLS + GRANTs explícitos). O front nunca é a única barreira.
- Desde 2026 o Supabase não concede mais permissões automáticas a tabelas novas: cada migration declara seus
  `GRANT`s (ver `docs/03-banco-de-dados.md`).
- Next 16 renomeou `middleware` para `proxy` (`src/proxy.ts`). Ele só renova a sessão e faz checagens otimistas;
  cada Server Action valida a usuária de novo.
- Um único repositório facilita onboarding de quem entra no time no meio do hackathon.
