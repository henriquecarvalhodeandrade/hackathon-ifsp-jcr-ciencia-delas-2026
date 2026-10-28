# Roadmap

O que ficou de fora do escopo do hackathon e ideias para depois. Prioridades sugeridas:
**P1** (logo depois do hackathon), **P2** (próximo semestre), **P3** (ideias). **Feito** marca o que já foi
entregue (fica no fim de cada tabela).

## Segurança e moderação

| Prioridade | Item                                                                                                                                                                                                             | Por quê                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1         | CAPTCHA (hCaptcha/Turnstile via Supabase Auth) no cadastro                                                                                                                                                       | Contas falsas                                                                                                                                          |
| P2         | Bloquear/silenciar usuárias; suspensão temporária pela moderação                                                                                                                                                 | Proteção contra assédio recorrente                                                                                                                     |
| P2         | Filtro de linguagem ofensiva com IA antes de publicar (sugestão, não bloqueio)                                                                                                                                   | Apoio à moderação                                                                                                                                      |
| P2         | Content-Security-Policy completa (scripts e estilos com nonce)                                                                                                                                                   | Hoje a CSP só tem `frame-ancestors`; a completa reduz o impacto de um XSS, mas exige nonce no script de tema e nos estilos do Next                     |
| P3         | Limites anti-spam também para reações e edições                                                                                                                                                                  | Hoje só a criação de conteúdo, os destaques, as denúncias e os pedidos de mentoria têm limite                                                          |
| **Feito**  | Limites anti-spam no banco, por pessoa: tópicos, respostas, comentários, papers, destaques, denúncias e pedidos de mentoria (`CD019`–`CD025`, ver [09](09-moderacao-e-seguranca.md#limites-anti-spam-banco))     | Evitar spam e abuso; por estarem em triggers, valem também para quem chama a API direto, e apagar o conteúdo não devolve a cota                        |
| **Feito**  | Log de auditoria (`moderation_audit_log`) para revelar autoria, mudanças de papel, fixar/trancar, ocultação e exclusão de conteúdo                                                                               | Transparência da moderação sobre ações sensíveis; a exclusão de conteúdo alheio é registrada pelo banco (trigger) em qualquer tela, na mesma transação |
| **Feito**  | Avatares só do Storage do projeto (`CHECK` em `profiles.avatar_url`; a foto do Google é descartada)                                                                                                              | Uma imagem de terceiros revelaria IP e horário de quem vê o perfil, inclusive o de autoras anônimas                                                    |
| **Feito**  | Cabeçalhos de segurança HTTP em todas as rotas (`next.config.ts`)                                                                                                                                                | Anti-clickjacking (`X-Frame-Options: DENY` + `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS                      |
| **Feito**  | "Baixar meus dados" (LGPD, art. 18, V — portabilidade): JSON com tudo o que é da membra, inclusive publicações anônimas (`/perfil#dados`, ver [11](11-perfis-e-autenticacao.md#baixar-meus-dados-portabilidade)) | Direito da titular; de outras pessoas o arquivo só traz o nome de quem participou das mentorias dela                                                   |

## Mentoria

| Prioridade | Item                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| P1         | Calibrar `SIMILARITY_FLOOR`/`SIMILARITY_CEIL` do matching com dados reais de embeddings   |
| P1         | Mensagens internas entre mentora e mentoranda (hoje o contato é por e-mail após o aceite) |
| P2         | Agenda de encontros e lembretes; checklist do primeiro encontro com acompanhamento        |
| P2         | Avaliação da mentoria ao concluir (privada, para melhorar o matching)                     |
| P3         | Mentorias em grupo (círculos) por área ou tema (ex.: maternidade e ciência)               |

## Vitrine, ranking e boletim

| Prioridade | Item                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | Verificar domínio no Resend para enviar o boletim a toda a comunidade                                                                                                                                                                        |
| P2         | Ranking "mais bem avaliados" com Wilson score caso surjam outros tipos de avaliação                                                                                                                                                          |
| P2         | Boletim personalizado por área de interesse com resumo gerado por IA por pessoa                                                                                                                                                              |
| P2         | Importar várias publicações do ORCID de uma vez (hoje é uma por vez, revisada no formulário)                                                                                                                                                 |
| P3         | Página pública de "pesquisadora em destaque" com consentimento                                                                                                                                                                               |
| **Feito**  | Importar publicações pelo ORCID: o painel em `/papers/novo` lista as publicações públicas do iD (o do perfil já vem preenchido) e preenche o formulário, pelo Crossref quando há DOI (ver [05](05-papers-e-ranking.md#12-importar-do-orcid)) |

## Plataforma

| Prioridade | Item                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | Testes E2E automatizados com `@playwright/test` no CI (GitHub Actions) usando `supabase start`                                                                                                                                        |
| P1         | Rodar os Security/Performance Advisors do Supabase antes de cada deploy                                                                                                                                                               |
| P2         | Reativar Cache Components do Next 16 nas páginas públicas (ver ADR 0002)                                                                                                                                                              |
| P2         | Notificações por e-mail (resumo diário opcional) e em tempo real (Supabase Realtime)                                                                                                                                                  |
| P3         | Internacionalização (es/en) para redes latino-americanas                                                                                                                                                                              |
| P3         | Modo offline (service worker com página "sem conexão" e cache das páginas públicas)                                                                                                                                                   |
| **Feito**  | CI no GitHub Actions: formatação, lint, tipos, testes unitários, build e pgTAP (`.github/workflows/ci.yml`, ver [07](07-setup-e-deploy.md#7-integração-contínua-github-actions))                                                      |
| **Feito**  | PWA para uso no celular: manifesto e ícones instaláveis (`src/app/manifest.ts`), sem service worker                                                                                                                                   |
| **Feito**  | Busca sem acento e sem diferença de maiúsculas no fórum, na Vitrine e no diretório de pesquisadoras (coluna `search_text` com `unaccent`; cada palavra precisa aparecer, ver [03](03-banco-de-dados.md#busca-sem-acento-search_text)) |
