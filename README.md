<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-mark-white.svg" />
  <img src="public/brand/logo-mark.svg" alt="" width="64" height="64" />
</picture>

# Artemis

[![CI](https://github.com/henriquecarvalhodeandrade/hackathon-ifsp-jcr-ciencia-delas-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/henriquecarvalhodeandrade/hackathon-ifsp-jcr-ciencia-delas-2026/actions/workflows/ci.yml)

**Rede de apoio, mentoria e visibilidade para mulheres na ciência.**
Projeto do **Hackathon IFSP Câmpus Jacareí 2026** — tema _Ciência Delas_. O nome vem de Ártemis,
deusa grega da caça e da Lua; o símbolo é uma lua crescente com uma estrela âmbar.

Pesquisadoras iniciantes encontram mentoras experientes com ajuda de IA, conversam num fórum seguro e dão
visibilidade ao trabalho de mulheres com uma vitrine de papers, rankings de destaques e um boletim semanal.

## O que a plataforma faz

|                     | Funcionalidade                                                                                                                                                                                                                                 | Rota             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Fórum seguro**    | Categorias (carreira, bolsas, dúvidas de pesquisa, maternidade, rede de apoio, saúde mental, eventos), reações de apoio, resposta marcada como solução, **publicação anônima** em temas sensíveis, denúncia em todo conteúdo. Só para membras. | `/forum`         |
| **Mentoria com IA** | A mentoranda descreve áreas, palavras-chave e objetivos; recebe **sugestões de mentoras** com pontuação de afinidade, o porquê da combinação e temas para a primeira conversa; envia o pedido; a mentora aceita e as duas trocam contato.      | `/mentoria`      |
| **Vitrine Delas**   | Divulgação de papers com autoria feminina (metadados buscados pelo **DOI** no Crossref), **resumo acessível** gerado por IA e revisado, votos de **destaque**, comentários.                                                                    | `/papers`        |
| **Ranking**         | Mais destacados da semana, mês, ano e de todos os tempos, "em alta" com decaimento no tempo, filtro por área e ranking da comunidade.                                                                                                          | `/ranking`       |
| **Boletim Delas**   | Newsletter semanal automática com os papers mais destacados e o que movimentou a comunidade; dupla confirmação e descadastro com um clique.                                                                                                    | `/newsletter`    |
| **Pesquisadoras**   | Diretório de membras com filtros por área, estágio da carreira, estado e mentoras com vaga.                                                                                                                                                    | `/pesquisadoras` |
| **Moderação**       | Fila de denúncias, ocultar/excluir conteúdo, trancar e fixar tópicos, papéis de moderadora e admin, envio do boletim.                                                                                                                          | `/admin`         |
| **Design system**   | Guia vivo do design system Artemis: marca, cores, tipografia, componentes, voz e acessibilidade.                                                                                                                                               | `/design-system` |

## Stack

**Next.js 16** (App Router, React 19, TypeScript) · **Tailwind CSS v4** · **Supabase** (Auth, Postgres com RLS,
Storage, pgvector) · **IA gratuita**: Gemini (`gemini-3.5-flash-lite` + `gemini-embedding-2`) com fallback para
Groq e OpenRouter · **Resend** (e-mail) · **Vercel** (deploy + cron). Tudo cabe nos planos gratuitos.

Sem nenhuma chave de IA ou de e-mail o app continua funcionando: a mentoria usa um score heurístico transparente e
as edições do boletim ficam publicadas no site.

## Começando

```bash
npm install
npx supabase start          # Docker: Postgres, Auth, API, Storage e Mailpit + migrations + seed
cp .env.example .env.local  # cole a URL e as chaves que o comando acima mostrou
npm run dev                 # http://localhost:3000
```

Entre com uma conta de demonstração (senha `ciencia-delas-demo`), por exemplo
`larissa@demo.cienciadelas.dev` (mentoranda), `marina@demo.cienciadelas.dev` (mentora) ou
`admin@demo.cienciadelas.dev` (administradora). E-mails locais chegam no Mailpit: http://127.0.0.1:54324.

Guia completo, variáveis de ambiente e deploy (Supabase Cloud + Vercel): **[docs/07-setup-e-deploy.md](docs/07-setup-e-deploy.md)**.

## Instalar no celular

A Artemis pode ser instalada como app (PWA), com ícone na tela inicial e abrindo em tela cheia. No Android,
abra o site no Chrome e toque em **Instalar app** (ou menu → _Adicionar à tela inicial_); no iPhone, no Safari,
toque em **Compartilhar** → _Adicionar à Tela de Início_. Não há modo offline: é preciso estar conectada à internet.

## Qualidade

| Comando           | Verifica                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| `npm run check`   | ESLint + TypeScript + testes unitários (Vitest)                                |
| `npm run db:test` | testes pgTAP de segurança do banco (RLS, anonimato, regras de mentoria, votos) |
| `npm run build`   | build de produção                                                              |

## Documentação

| Documento                                                      | Conteúdo                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| [00 · Visão geral](docs/00-visao-geral.md)                     | Problema, proposta, público, jornada da demo, princípios              |
| [01 · Arquitetura](docs/01-arquitetura.md)                     | Stack, diagramas, pastas, fluxo de dados, rotas, segurança em camadas |
| [02 · Design system](docs/02-design-system.md)                 | Marca, tokens, tipografia, componentes, voz e tom, acessibilidade     |
| [03 · Banco de dados](docs/03-banco-de-dados.md)               | Modelo de dados, RLS, triggers, RPCs, seed, testes                    |
| [04 · Mentoria com IA](docs/04-mentoria-com-ia.md)             | Algoritmo de matching, prompts, provedores gratuitos, LGPD            |
| [05 · Papers e ranking](docs/05-papers-e-ranking.md)           | Vitrine, DOI/Crossref, votos, fórmulas de ranking                     |
| [06 · Fórum](docs/06-forum.md)                                 | Categorias, anonimato, reações, soluções, moderação                   |
| [07 · Setup e deploy](docs/07-setup-e-deploy.md)               | Rodar localmente, variáveis, Supabase Cloud, Vercel, Resend           |
| [08 · Newsletter](docs/08-newsletter.md)                       | Geração semanal, envio, cron, descadastro, LGPD                       |
| [09 · Moderação e segurança](docs/09-moderacao-e-seguranca.md) | Denúncias, papéis, auditoria, privacidade, checklist                  |
| [10 · Roadmap](docs/10-roadmap.md)                             | Próximos passos                                                       |
| [11 · Perfis e autenticação](docs/11-perfis-e-autenticacao.md) | Login, onboarding, perfil, diretório                                  |
| [12 · Fluxos da mentoria](docs/12-mentoria-fluxos.md)          | Telas e estados de pedidos de mentoria                                |
| [ADRs](docs/adr/README.md)                                     | Decisões de arquitetura e por quê                                     |

## Estrutura

```
src/app/            rotas (App Router)          supabase/migrations/  schema versionado
src/components/ui/  design system              supabase/seed.sql     dados de demonstração (fictícios)
src/lib/            domínio, IA, Supabase       supabase/tests/       testes pgTAP
docs/               documentação + ADRs         scripts/              tipos, backfill de IA, E2E
```

## Privacidade

Fórum e diretório são fechados para membras; publicações anônimas não guardam a autora na linha do conteúdo; a
IA só é usada com consentimento explícito e recebe dados pseudonimizados (sem nome, e-mail ou links). Veja
[`/privacidade`](src/app/privacidade/page.tsx) e [docs/09](docs/09-moderacao-e-seguranca.md).

## Licença

[MIT](LICENSE).
