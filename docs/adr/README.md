# Registro de decisões de arquitetura (ADRs)

Cada ADR registra **uma** decisão importante: o contexto, o que decidimos e as consequências.
Se uma decisão mudar, escreva um ADR novo que substitui o antigo (não apague o histórico).

| Nº                                         | Decisão                                                | Status |
| ------------------------------------------ | ------------------------------------------------------ | ------ |
| [0001](0001-stack-nextjs-supabase.md)      | Next.js 16 (App Router) + Supabase como stack única    | Aceita |
| [0002](0002-cache-components-desligado.md) | Cache Components do Next 16 desligado                  | Aceita |
| [0003](0003-ia-gratuita-com-fallback.md)   | IA gratuita com cadeia de fallback e modo heurístico   | Aceita |
| [0004](0004-forum-fechado-e-anonimato.md)  | Fórum só para membras e anonimato com autoria privada  | Aceita |
| [0005](0005-votos-somente-positivos.md)    | Votos somente positivos ("destaques") nos papers       | Aceita |
| [0006](0006-papers-por-link.md)            | Papers divulgados por link/DOI, sem upload de PDF      | Aceita |
| [0007](0007-newsletter-resend-cron.md)     | Newsletter com dupla confirmação, Resend e Vercel Cron | Aceita |

Modelo para novos ADRs: copie um arquivo existente e mantenha as seções **Contexto**, **Decisão** e **Consequências**.
