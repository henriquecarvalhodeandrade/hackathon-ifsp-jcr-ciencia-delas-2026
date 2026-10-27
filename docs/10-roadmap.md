# Roadmap

O que ficou de fora do escopo do hackathon e ideias para depois. Prioridades sugeridas:
**P1** (logo depois do hackathon), **P2** (próximo semestre), **P3** (ideias).

## Segurança e moderação

| Prioridade | Item | Por quê |
| --- | --- | --- |
| P1 | Log de auditoria para `reveal_anonymous_author`, mudanças de papel e ocultação de conteúdo | Transparência da moderação sobre ações sensíveis |
| P1 | Limite de taxa (rate limit) em Server Actions de escrita (fórum, comentários, pedidos de mentoria) | Evitar spam e abuso; hoje só há o cooldown de 60 s do matching |
| P1 | CAPTCHA (hCaptcha/Turnstile via Supabase Auth) no cadastro | Contas falsas |
| P2 | Bloquear/silenciar usuárias; suspensão temporária pela moderação | Proteção contra assédio recorrente |
| P2 | Filtro de linguagem ofensiva com IA antes de publicar (sugestão, não bloqueio) | Apoio à moderação |

## Mentoria

| Prioridade | Item |
| --- | --- |
| P1 | Calibrar `SIMILARITY_FLOOR`/`SIMILARITY_CEIL` do matching com dados reais de embeddings |
| P1 | Mensagens internas entre mentora e mentoranda (hoje o contato é por e-mail após o aceite) |
| P2 | Agenda de encontros e lembretes; checklist do primeiro encontro com acompanhamento |
| P2 | Avaliação da mentoria ao concluir (privada, para melhorar o matching) |
| P3 | Mentorias em grupo (círculos) por área ou tema (ex.: maternidade e ciência) |

## Vitrine, ranking e boletim

| Prioridade | Item |
| --- | --- |
| P1 | Importar automaticamente publicações pelo ORCID da pesquisadora |
| P1 | Verificar domínio no Resend para enviar o boletim a toda a comunidade |
| P2 | Ranking "mais bem avaliados" com Wilson score caso surjam outros tipos de avaliação |
| P2 | Boletim personalizado por área de interesse com resumo gerado por IA por pessoa |
| P3 | Página pública de "pesquisadora em destaque" com consentimento |

## Plataforma

| Prioridade | Item |
| --- | --- |
| P1 | Testes E2E automatizados com `@playwright/test` no CI (GitHub Actions) usando `supabase start` |
| P1 | Rodar os Security/Performance Advisors do Supabase antes de cada deploy |
| P2 | Reativar Cache Components do Next 16 nas páginas públicas (ver ADR 0002) |
| P2 | Notificações por e-mail (resumo diário opcional) e em tempo real (Supabase Realtime) |
| P2 | PWA para uso no celular |
| P3 | Internacionalização (es/en) para redes latino-americanas |
