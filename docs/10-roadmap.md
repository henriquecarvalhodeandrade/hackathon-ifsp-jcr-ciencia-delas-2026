# Roadmap

O que ficou de fora do escopo do hackathon e ideias para depois. Prioridades sugeridas:
**P1** (logo depois do hackathon), **P2** (próximo semestre), **P3** (ideias). **Feito** marca o que já foi
entregue (fica no fim de cada tabela).

## Segurança e moderação

| Prioridade | Item                                                                                                                | Por quê                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | Limite de taxa (rate limit) em Server Actions de escrita (fórum, comentários, pedidos de mentoria)                  | Evitar spam e abuso; hoje há limites no banco para denúncias (20/h), pedidos de mentoria (3 por mentora/7 dias, 10/24 h) e matching com IA (60 s, 20/dia) |
| P1         | CAPTCHA (hCaptcha/Turnstile via Supabase Auth) no cadastro                                                          | Contas falsas                                                                                                                                             |
| P2         | Bloquear/silenciar usuárias; suspensão temporária pela moderação                                                    | Proteção contra assédio recorrente                                                                                                                        |
| P2         | Filtro de linguagem ofensiva com IA antes de publicar (sugestão, não bloqueio)                                      | Apoio à moderação                                                                                                                                         |
| P2         | Content-Security-Policy completa (scripts e estilos com nonce)                                                      | Hoje a CSP só tem `frame-ancestors`; a completa reduz o impacto de um XSS, mas exige nonce no script de tema e nos estilos do Next                        |
| **Feito**  | Log de auditoria para `reveal_anonymous_author`, mudanças de papel e ocultação de conteúdo (`moderation_audit_log`) | Transparência da moderação sobre ações sensíveis                                                                                                          |
| **Feito**  | Cabeçalhos de segurança HTTP em todas as rotas (`next.config.ts`)                                                   | Anti-clickjacking (`X-Frame-Options: DENY` + `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS                         |

## Mentoria

| Prioridade | Item                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| P1         | Calibrar `SIMILARITY_FLOOR`/`SIMILARITY_CEIL` do matching com dados reais de embeddings   |
| P1         | Mensagens internas entre mentora e mentoranda (hoje o contato é por e-mail após o aceite) |
| P2         | Agenda de encontros e lembretes; checklist do primeiro encontro com acompanhamento        |
| P2         | Avaliação da mentoria ao concluir (privada, para melhorar o matching)                     |
| P3         | Mentorias em grupo (círculos) por área ou tema (ex.: maternidade e ciência)               |

## Vitrine, ranking e boletim

| Prioridade | Item                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| P1         | Importar automaticamente publicações pelo ORCID da pesquisadora                     |
| P1         | Verificar domínio no Resend para enviar o boletim a toda a comunidade               |
| P2         | Ranking "mais bem avaliados" com Wilson score caso surjam outros tipos de avaliação |
| P2         | Boletim personalizado por área de interesse com resumo gerado por IA por pessoa     |
| P3         | Página pública de "pesquisadora em destaque" com consentimento                      |

## Plataforma

| Prioridade | Item                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | Testes E2E automatizados com `@playwright/test` no CI (GitHub Actions) usando `supabase start`                                                                                   |
| P1         | Rodar os Security/Performance Advisors do Supabase antes de cada deploy                                                                                                          |
| P2         | Reativar Cache Components do Next 16 nas páginas públicas (ver ADR 0002)                                                                                                         |
| P2         | Notificações por e-mail (resumo diário opcional) e em tempo real (Supabase Realtime)                                                                                             |
| P3         | Internacionalização (es/en) para redes latino-americanas                                                                                                                         |
| P3         | Modo offline (service worker com página "sem conexão" e cache das páginas públicas)                                                                                              |
| **Feito**  | CI no GitHub Actions: formatação, lint, tipos, testes unitários, build e pgTAP (`.github/workflows/ci.yml`, ver [07](07-setup-e-deploy.md#7-integração-contínua-github-actions)) |
| **Feito**  | PWA para uso no celular: manifesto e ícones instaláveis (`src/app/manifest.ts`), sem service worker                                                                              |
