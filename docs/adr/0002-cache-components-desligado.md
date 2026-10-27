# ADR 0002 — Cache Components do Next 16 desligado

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

O `create-next-app` 16.4 gera projetos com `cacheComponents: true` e `partialPrefetching: true`. Nesse modo,
qualquer leitura de cookies (a sessão do Supabase) precisa ficar dentro de `<Suspense>` ou de `"use cache: private"`,
senão o build falha. Quase todas as nossas páginas dependem da usuária logada.

## Decisão

Desligamos `cacheComponents` (e, por consequência, `partialPrefetching`, que depende dele) em `next.config.ts`.
Usamos o modelo clássico: páginas que leem cookies são dinâmicas automaticamente.

## Consequências

- Menos fricção para o time e para quem contribuir depois: o código segue os exemplos oficiais do Supabase.
- Abrimos mão de pré-renderizar partes estáticas de páginas autenticadas. Para o volume de um hackathon isso
  não faz diferença perceptível.
- Reavaliar depois do hackathon: o guia `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`
  explica a migração.
