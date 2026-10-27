# 05 · Vitrine de papers e ranking

> A **Vitrine Delas** dá visibilidade a trabalhos com autoria de mulheres: qualquer membro indica
> um paper (o dela ou de outra pesquisadora), a comunidade lê o **resumo acessível**, comenta e
> **destaca** (vota). Os destaques alimentam o **ranking** por período e o boletim semanal.

Sumário

1. [Rotas e quem acessa](#1-rotas-e-quem-acessa)
2. [Fluxos de uso](#2-fluxos-de-uso)
3. [Como o ranking funciona](#como-o-ranking-funciona)
4. [Ranking da comunidade](#4-ranking-da-comunidade)
5. [Server Actions](#5-server-actions)
6. [Acesso a dados](#6-acesso-a-dados)
7. [Busca pelo DOI (Crossref)](#7-busca-pelo-doi-crossref)
8. [Resumo acessível com IA](#8-resumo-acessível-com-ia)
9. [Arquivos](#9-arquivos)
10. [Como testar](#10-como-testar)
11. [Decisões e limitações conhecidas](#11-decisões-e-limitações-conhecidas)

---

## 1. Rotas e quem acessa

| Rota                                                  | Acesso                         | O que mostra                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/papers`                                             | pública                        | Vitrine: abas de ordenação, busca no título, filtro por área, cartões com destaque, paginação (12 por página)                                      |
| `/papers?periodo=hot\|week\|month\|year\|all\|recent` | pública                        | Ordenação. Padrão: `hot` (Em alta). `recent` = mais novos primeiro                                                                                 |
| `/papers?area=<slug>&q=<texto>&pagina=N`              | pública                        | Filtros por URL (funcionam sem JavaScript). Slug de **grande área** inclui todas as subáreas                                                       |
| `/papers/novo`                                        | membros com onboarding         | Formulário de envio em 4 passos. Visitante → `/entrar?next=/papers/novo` (proxy + `requireOnboardedProfile`)                                       |
| `/papers/[id]`                                        | pública                        | Detalhe: resumo acessível, abstract, palavras-chave, destaque, links, quem indicou (só membros), comentários (só membros), denúncia, ações da dona |
| `/papers/[id]/editar`                                 | só quem enviou                 | Mesmo formulário, preenchido. Outras pessoas recebem a página 404                                                                                  |
| `/ranking`                                            | pública                        | Pódio (top 3) + posições 4 a 20 do período (`?periodo=`, padrão `week`) e área (`?area=`)                                                          |
| `/ranking?aba=comunidade`                             | membros (visitante vê convite) | Ranking da comunidade com pontos e de onde vêm, mais a legenda "Como funciona a pontuação"                                                         |

Todas as páginas exportam `metadata` (o detalhe usa `generateMetadata` com o título e o resumo do
paper) e têm `loading.tsx` com o formato da tela final. Sem Supabase configurado, as páginas
públicas mostram um aviso amigável em vez de quebrar.

**Visitantes e privacidade:** o papel `anon` não lê `profiles`, então as páginas públicas nunca
fazem embed de perfis. Para visitantes, "Quem indicou" mostra só a relação com o trabalho
("Indicado pela coautora do trabalho") e um convite para entrar; nome e foto aparecem só com sessão.

## 2. Fluxos de uso

### Explorar e destacar

1. Na Vitrine, a pessoa escolhe a aba (Em alta, Semana, Mês, Ano, Todos os tempos, Recentes),
   filtra por área ou busca no título. Os três primeiros de cada período ganham o selo
   "#1 da semana", "#2 em alta"...
2. O botão de estrela **destaca** o paper. A contagem muda na hora (atualização otimista com
   `useOptimistic`) e a Server Action `toggleVote` grava ou apaga a linha em `paper_votes`. Se der
   erro, o botão volta ao estado anterior e mostra a mensagem.
3. Visitante: a estrela é um link para `/entrar?next=<página atual>`.
4. Quem enviou o paper vê a estrela desabilitada (`aria-disabled`, focável) com a dica
   "Você não pode destacar o próprio paper". O banco também recusa (`CD012`).
5. O nome acessível do botão é fixo ("Destacar “título”"): o estado vem do `aria-pressed` e a
   contagem é ligada por `aria-describedby` (regra do design system, docs/02 §13).

### Divulgar um paper

1. `/papers/novo` → **Passo 1, Onde encontrar:** DOI (opcional) e "Buscar dados pelo DOI", que
   preenche título, autoras, revista, ano e resumo pelo Crossref ([seção 7](#7-busca-pelo-doi-crossref)).
   Se o DOI já estiver na Vitrine, a busca avisa e mostra o link do paper existente. Link para o
   paper (obrigatório se não houver DOI). Aviso de direitos autorais: **só link, sem PDF**.
2. **Passo 2, Sobre o trabalho:** título, autoras e autores (um por Enter), abstract, revista/evento,
   ano, área (obrigatória — usada nos filtros e no boletim por área) e palavras-chave (até 15).
3. **Passo 3, Relação:** "Sou a autora principal", "Sou coautora", "Sou orientadora/supervisora",
   "Estou indicando o trabalho de outra pesquisadora" e a confirmação obrigatória
   "Confirmo que este trabalho tem autoria de mulheres".
4. **Passo 4, Resumo acessível:** texto opcional em linguagem simples. Com IA configurada, aparece
   "Gerar resumo acessível com IA" ([seção 8](#8-resumo-acessível-com-ia)).
5. "Publicar na Vitrine" → validação no servidor (zod). Com erro, os campos continuam preenchidos,
   cada erro aparece junto do campo, há um resumo no topo e o foco vai para o primeiro campo
   inválido. Com sucesso, a pessoa vai para `/papers/<id>?enviado=1`.

### Página do paper

- **Resumo acessível** com selo "Gerado com IA" e aviso de possíveis imprecisões quando
  `plain_summary_source = 'ai'` (ou "Escrito por quem enviou").
- **Onde ler:** botão para `https://doi.org/<doi>` (ou o link), DOI em fonte mono e o link extra.
- **Conversa:** membros leem e comentam (2 a 3.000 caracteres); a autora apaga o próprio
  comentário e a moderação apaga qualquer um (com confirmação). Quem enviou o paper recebe
  notificação (trigger `paper_comments_notify`, link `/papers/<id>#comentarios`). Visitantes veem
  um convite para entrar; quem ainda não completou o perfil vê o convite para o onboarding.
- **Denunciar** paper e comentários com o `ReportButton` da moderação (visitante → login).
- **Seu paper** (só quem enviou): Editar, Excluir (com confirmação) e, com IA configurada,
  "Gerar novo resumo com IA". A moderação vê "Excluir (moderação)".
- Paper oculto pela moderação (`is_hidden`): quem enviou e a moderação veem um aviso; para as
  demais pessoas a página é 404 e ele some da Vitrine e do ranking.

## Como o ranking funciona

A ordem vem da RPC `get_paper_ranking(p_period, p_area_slug, p_limit, p_offset)` (SQL em
`supabase/migrations/20261027120800_rpc.sql`), espelhada em `src/lib/ranking/hot.ts`:

| Período (`?periodo=`)   | Critério                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hot` — Em alta         | `hot_score = votos ÷ (horas desde o envio + 2)^1,5` (estilo Hacker News): papers novos com destaques sobem mais rápido e a pontuação cai com a idade do paper |
| `week` — Semana         | votos recebidos nos últimos **7 dias** (`period_votes`)                                                                                                       |
| `month` — Mês           | votos recebidos nos últimos **30 dias**                                                                                                                       |
| `year` — Ano            | votos recebidos nos últimos **365 dias**                                                                                                                      |
| `all` — Todos os tempos | total de votos (`vote_count`)                                                                                                                                 |

- Desempate: total de votos (desc), depois o paper mais novo.
- Papers ocultos ficam de fora. Filtrar por uma grande área do CNPq (ex.: `engenharias`) inclui as subáreas.
- As janelas são fixas (7/30/365 dias), não meses de calendário. `created_at` do voto não pode ser
  enviado pelo cliente (GRANT por coluna), então ninguém "antedata" votos.
- Na **Vitrine** todos os papers aparecem (os sem votos no período vão para o fim). No **ranking**
  (`/ranking`) só entram papers com pelo menos um destaque que conte no período; sem nenhum,
  aparece um estado vazio com atalhos para a Vitrine e para "Todos os tempos".
- O pódio mostra os votos do período; a lista das posições 4–20 mostra também o total.

## 4. Ranking da comunidade

`/ranking?aba=comunidade` usa a RPC `get_community_leaderboard(p_limit)` (SECURITY DEFINER, só
`authenticated`). A legenda usa `LEADERBOARD_RULES` de `src/lib/ranking/leaderboard.ts`:

| Ação                                       | Pontos |
| ------------------------------------------ | ------ |
| Mentoria aceita ou concluída, como mentora | 15     |
| Paper na Vitrine (não oculto)              | 10     |
| Resposta escolhida como solução            | 5      |
| Voto recebido nos seus papers              | 2      |
| Tópico ou resposta no fórum                | 1      |

Publicações anônimas nunca contam (senão o ranking revelaria a autoria). A linha da pessoa logada
fica destacada com o selo "Você"; se ela não estiver no top 20, aparece um convite para participar.

## 5. Server Actions

Todas em `src/lib/papers/actions.ts` (`"use server"`). Cada uma confere a sessão **dentro** da
action (o proxy é só otimista), valida com zod e grava com o cliente da usuária — quem autoriza
é o RLS. Ids de usuária nunca vêm do cliente (`submitted_by`, `user_id` e `author_id` têm
`default auth.uid()`). Depois de mutações: `revalidatePath("/papers", "layout")`,
`/papers/<id>`, `/ranking` e `/`.

| Action                                         | Quem                    | O que faz                                                                                                                                                             | Retorno                                                                 |
| ---------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `toggleVote(paperId, voted)`                   | membros                 | Estado desejado (idempotente): `insert` em `paper_votes` (duplicado `23505` = já votou) ou `delete` do próprio voto. Lê o `vote_count` novo                           | `{ ok, voted, voteCount }` · `{ ok: false, error, needsLogin? }`        |
| `savePaper(prev, formData)`                    | membros com onboarding  | Cria (sem `paper_id`) ou edita (com `paper_id`, `.eq("submitted_by", uid)`). DOI repetido → erro no campo DOI. Sucesso → `redirect()`                                 | `{ ok: false, error, fieldErrors, values }` (ou redireciona)            |
| `lookupDoi(doi, currentPaperId?)`              | membros                 | Normaliza/valida o DOI, avisa se já existe na Vitrine, busca no Crossref                                                                                              | `{ ok, data, message }` · `{ ok: false, error, existingPaperId? }`      |
| `generateSummary({ title, abstract, areaId })` | membros                 | Rascunho de resumo acessível com IA (não grava)                                                                                                                       | `{ ok, summary }` · `{ ok: false, error }`                              |
| `regenerateSummary(prev, formData)`            | quem enviou             | Gera e grava um novo resumo (`plain_summary_source = 'ai'`)                                                                                                           | `{ ok, message }` · `{ ok: false, error }`                              |
| `deletePaper(formData)`                        | quem enviou / moderação | `delete ... .select("id")`; erro ou nenhuma linha apagada → `{ ok: false, error }` (o `ConfirmDialog` continua aberto com a mensagem). Sucesso → `/papers?removido=1` | `{ ok: false, error }` (ou redireciona)                                 |
| `addComment(prev, formData)`                   | membros com onboarding  | Insere em `paper_comments` (2–3.000 caracteres)                                                                                                                       | `{ ok, message, values }` · `{ ok: false, error, fieldErrors, values }` |
| `deleteComment(formData)`                      | autora / moderação      | Apaga o comentário (RLS decide); nenhuma linha apagada → erro no diálogo                                                                                              | `{ ok: true }` · `{ ok: false, error }`                                 |

Erros: códigos `CD***` do banco já vêm em pt-BR e são exibidos; os demais passam por
`friendlyDbError()` (`src/lib/papers/errors.ts`), que traduz `23505` (DOI duplicado), `23503`,
`23514`, `42501` etc. para mensagens amigáveis. Formulários seguem o padrão do design system
(React 19 reseta o `<form>`: as actions devolvem `values` e os campos remontam com `key`).

## 6. Acesso a dados

`src/lib/papers/queries.ts` (`server-only`, sempre com a sessão → RLS):

| Função                                           | Fonte                                                                                                                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getResearchAreas()`                             | `research_areas` (público), memoizada por requisição                                                                                                                                                        |
| `listVitrine({ order, areaSlug, q, page })`      | períodos → RPC `get_paper_ranking` + contagem em `papers`; `recent` e busca → `papers` com `ilike` no título (curingas escapados) e `range()`. Página além do fim (`PGRST103`) vira lista vazia com o total |
| `listRanking({ period, areaSlug, limit })`       | RPC `get_paper_ranking`, filtrando quem tem votos que contam no período                                                                                                                                     |
| `getVotedPaperIds(userId, ids)`                  | `paper_votes` da usuária para os papers da tela                                                                                                                                                             |
| `getPaperDetail(id)`                             | `papers` + `area:research_areas(...)` (sem perfis), memoizada (página + `generateMetadata`)                                                                                                                 |
| `getPaperSubmitter(id)` · `getPaperComments(id)` | **só com sessão**: colunas públicas de `profiles`; comentários com `author:profiles(...)`                                                                                                                   |
| `getCommunityLeaderboard(limit)`                 | RPC `get_community_leaderboard` (só membros)                                                                                                                                                                |

Embeds: `papers → area:research_areas(...)` não é ambíguo. Para quem enviou o paper, a página
faz uma consulta separada em `profiles` (com sessão), sem precisar da dica
`profiles!papers_submitted_by_fkey`.

## 7. Busca pelo DOI (Crossref)

- `src/lib/papers/lookup.ts` chama `GET https://api.crossref.org/works/{doi}` (API pública, sem
  chave), com `User-Agent: CienciaDelas/1.0 (+<site>; mailto:...)` ("polite pool"), `cache: "no-store"`
  e **timeout de 8 s** (`AbortSignal.timeout`). Cabeçalhos HTTP aceitam só ASCII.
- `src/lib/papers/crossref.ts` (puro, testado) converte a resposta: `title[0]` (+ subtítulo),
  autoras `given + family` (ou `name` de instituições, sem repetir, até 50), `container-title[0]`
  (ou a editora), ano de `issued` → `published-print` → `published-online` → `created`, e o abstract
  em JATS XML vira texto com parágrafos (tags removidas, entidades decodificadas, título
  "Abstract/Resumo" retirado). Tudo é cortado nos limites do banco.
- Falhas viram mensagens amigáveis e a pessoa pode preencher à mão: DOI não encontrado (inclusive
  DOIs do DataCite, como os do Zenodo, que não estão no Crossref), Crossref fora do ar/timeout,
  resposta inesperada.
- Os campos que o Crossref trouxe substituem os atuais; link, área, palavras-chave, relação e
  resumo acessível ficam como estavam.

## 8. Resumo acessível com IA

- Só aparece quando `isAiEnabled()` (há chave de algum provedor em `src/lib/ai`). Sem chave, a
  Vitrine funciona normalmente e o resumo é escrito pela autora.
- Usa `generatePlainSummary({ title, abstract, area })` de `src/lib/ai/tasks`: 3 a 5 frases, sem
  inventar resultados, cortado em 900 caracteres (detalhes em `docs/04-mentoria-com-ia.md` §5.2).
- Enviamos só dados **públicos** do paper (título, área, abstract) — nada de nomes de membros. O
  formulário avisa que, no plano gratuito do Gemini, o Google pode usar esses dados.
- O texto gerado é um **rascunho editável**; ao publicar, fica marcado `plain_summary_source = 'ai'`
  e a página mostra o selo "Gerado com IA" e o aviso. Se a autora apagar o texto e escrever o dela,
  a origem volta para `author`.
- Proteção de cota: uma geração a cada 15 s por pessoa (melhor esforço, por instância do servidor).

## 9. Arquivos

```
src/app/papers/page.tsx                 Vitrine (+ loading.tsx)
src/app/papers/novo/page.tsx            Envio (+ loading.tsx)
src/app/papers/[id]/page.tsx            Detalhe + generateMetadata (+ loading.tsx)
src/app/papers/[id]/editar/page.tsx     Edição, só quem enviou (+ loading.tsx)
src/app/ranking/page.tsx                Ranking de papers e da comunidade (+ loading.tsx)
src/components/papers/                  PaperCard, VoteButton (cliente), PaperFilters, AreaSelect,
                                        PaperForm (cliente), PlainSummary, CommentList, CommentForm,
                                        DeleteCommentButton, PaperOwnerActions, skeletons
src/components/ranking/                 Podium, RankingList, Leaderboard, LeaderboardRules
src/lib/papers/actions.ts               Server Actions
src/lib/papers/queries.ts               Leitura (server-only)
src/lib/papers/lookup.ts                Chamada ao Crossref (server-only)
src/lib/papers/{doi,crossref,schema,params,errors,limits}.ts   Módulos puros (+ *.test.ts)
```

`PaperCard` e `VoteButton` podem ser reutilizados em outras telas (ex.: landing): passe um
`PaperListItem` e o `viewer` (`"guest" | "member" | "owner"`).

## 10. Como testar

**Unitários (vitest):**

```bash
npx vitest run src/lib/papers
```

Cobrem normalização de DOI, conversão do Crossref (JATS, entidades, limites, datas), validação do
formulário e dos comentários, parâmetros de URL, áreas (grande área → subáreas), rótulos do
ranking e a tradução de erros do banco.

**Manual (Supabase local + seed, senha `ciencia-delas-demo`):**

1. Sem login, abra `/papers`: troque as abas, filtre por "Engenharias (todas)" e busque "abelhas".
   A estrela leva ao login. `/papers/novo` redireciona para `/entrar`.
2. Entre como `yasmin@demo.cienciadelas.dev` e vá em **Divulgar um paper**. Envie vazio (erros em
   cada campo). Cole o DOI `10.1038/nature12373` e clique em **Buscar dados pelo DOI**. Complete
   área, relação e a confirmação de autoria e publique. Edite e depois exclua o paper.
3. Entre como `gabriela@...`, destaque o paper de outra pessoa (a contagem muda na hora) e
   comente. Quem enviou recebe uma notificação.
4. Entre como `larissa@...`: no paper "Redes neurais leves..." (dela) a estrela fica desabilitada.
   Em `/ranking?aba=comunidade`, a linha dela aparece com "Você".
5. Entre como `moderacao@...`: em qualquer paper aparecem "Excluir (moderação)" no paper e nos
   comentários.

**E2E (Playwright):** o roteiro usado no desenvolvimento cobre 27 passos (visitante, envio com
Crossref, validação, DOI repetido, edição, paginação, destaque otimista conferido no banco,
comentário + notificação, exclusão pela autora e pela moderação, paper oculto, dona sem voto,
ranking da comunidade) e falha em qualquer erro de console ou aviso de hidratação. Use
`scripts/e2e/auth-cookies.mjs <email>` para obter os cookies de sessão sem passar pela tela de
login. Prefixe com `[teste]` os títulos criados e apague só os seus registros ao final.

## 11. Decisões e limitações conhecidas

- **DOI ou link obrigatório** e **área obrigatória** no formulário (o banco aceita nulos): sem
  um caminho até o texto completo o paper não ajuda quem lê, e sem área ele não aparece nos filtros
  nem no boletim por área.
- **Busca só no título** (como pedido na especificação). A RPC de ranking não tem busca por
  texto, então com `?q=` a Vitrine usa a lista simples, ordenada por total de destaques (ou por
  data na aba Recentes).
- **Status 404 com streaming:** como o app tem `loading.tsx` (inclusive o da raiz), páginas
  dinâmicas começam a ser enviadas antes de o paper ser buscado. Para um id inexistente o
  `notFound()` mostra a página 404 com `<meta name="robots" content="noindex">`, mas o status HTTP
  fica 200 — comportamento documentado do Next.js para respostas em streaming. Rotas inexistentes
  continuam com 404 de verdade.
- **Ranking da comunidade** mostra o top 20; quem não aparece recebe um convite para participar.
- A **moderação oculta papers** pelo painel `/admin` (RPC `moderate_paper`); aqui ela pode excluir
  papers e comentários.
