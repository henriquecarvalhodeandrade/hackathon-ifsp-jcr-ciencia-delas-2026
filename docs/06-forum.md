# 06 · Fórum e denúncias

O fórum é o coração da rede: um espaço **só para membros** onde pesquisadoras perguntam,
compartilham experiências e se apoiam — inclusive de forma **anônima** nas categorias
sensíveis (maternidade, assédio, saúde mental). Este documento descreve as telas, os fluxos,
as Server Actions, o acesso a dados e como testar. O componente de **denúncia**
(`<ReportButton />`), usado também em papers, comentários e perfis, está na [seção 8](#8-denúncias-reportbutton).

> Banco: tabelas, RLS e triggers do fórum estão em [`03-banco-de-dados.md`](03-banco-de-dados.md)
> (§3 Fórum, §5 Anonimato, §6 Triggers, §8 Erros). Componentes visuais: [`02-design-system.md`](02-design-system.md).

Sumário

1. [Rotas](#1-rotas)
2. [Fluxos de quem usa](#2-fluxos-de-quem-usa)
3. [Anonimato na interface](#3-anonimato-na-interface)
4. [Server Actions](#4-server-actions)
5. [Acesso a dados](#5-acesso-a-dados)
6. [Arquivos e componentes](#6-arquivos-e-componentes)
7. [Erros, validação e mensagens](#7-erros-validação-e-mensagens)
8. [Denúncias (`ReportButton`)](#8-denúncias-reportbutton)
9. [Acessibilidade e responsividade](#9-acessibilidade-e-responsividade)
10. [Como testar](#10-como-testar)
11. [Limitações conhecidas](#11-limitações-conhecidas)

---

## 1. Rotas

Todas exigem login **e** onboarding concluído: o `proxy` manda visitantes para
`/entrar?next=<rota>` e cada página chama `requireOnboardedProfile(next)` (quem ainda não
completou o perfil vai para `/onboarding`). Nenhuma página do fórum é indexada (`robots: noindex`).

| Rota                     | O que mostra                                                                                                   | Quem acessa                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/forum`                 | Busca, grade de categorias (com contagem e selo "Anonimato"), "Fixados pela moderação" e "Conversas recentes". | Membros                                 |
| `/forum?q=…`             | Resultados da busca (título **e** texto, `ilike`), com trecho do texto.                                        | Membros                                 |
| `/forum?tag=…`           | Tópicos com a tag (clicar numa tag leva aqui).                                                                 | Membros                                 |
| `/forum/c/[slug]`        | Cabeçalho da categoria, aviso de anonimato (quando aceita), busca na categoria, lista paginada, estado vazio.  | Membros                                 |
| `/forum/novo?categoria=` | Formulário de tópico (categoria pré-selecionada pelo `slug`).                                                  | Membros                                 |
| `/forum/t/[id]`          | Tópico, reações, ações da autora/moderação, solução, respostas e formulário de resposta.                       | Membros                                 |
| `/forum/t/[id]/editar`   | Edição de título, texto e tags.                                                                                | Autora (inclusive anônima) ou moderação |

Paginação: `?pagina=N` (20 por página). Slug ou id inválido/inexistente → `not-found` próprio
do fórum. Cada rota tem `loading.tsx` com o formato da tela final.

## 2. Fluxos de quem usa

**Ler e encontrar.** Em `/forum` a membro vê as 8 categorias, os tópicos fixados e as conversas
ordenadas pela **última atividade** (`last_activity_at`, mantida por trigger a cada resposta).
Cada linha mostra autora (ou "Anônima" com escudo neutro), categoria, tempo relativo, número de
respostas, resumo das reações e até 4 tags; selos **Fixado**, **Resolvido** e **Trancado**.

**Abrir um tópico.** "Novo tópico" (ou "Novo tópico aqui" na categoria) → escolher a categoria,
título (5–160), texto em Markdown (10–20.000) com aba **Pré-visualizar**, até 5 tags. Se a
categoria aceita anonimato, aparece o switch **Publicar anonimamente** com a explicação de que a
moderação consegue ver a autoria em casos graves. Ao publicar, a autora vai direto para o tópico.

**Responder.** No fim do tópico (Markdown, 2–10.000 caracteres, anônimo quando a categoria
permite). Depois de publicar, o formulário limpa, aparece "Resposta publicada…" e a página rola
até a resposta nova. A autora do tópico recebe notificação (trigger do banco).

**Reagir.** Botões **Apoio**, **Útil** e **Parabéns** no tópico e em cada resposta. A contagem
muda na hora (UI otimista com `useOptimistic`) e a Server Action confirma; se falhar, a reação
volta e aparece um aviso.

**Marcar solução.** Quem abriu o tópico (ou a moderação) vê "Marcar como solução" em cada resposta.
O tópico ganha o selo **Resolvido**, um aviso "Esta dúvida foi resolvida" com link para a resposta
e a autora da resposta é notificada. "Desmarcar solução" desfaz.

**Editar e excluir.** A autora edita o tópico em `/forum/t/[id]/editar` (categoria e anonimato não
mudam) e as respostas **no lugar** (botão "Editar" → formulário → "Salvar"). "Excluir" abre uma
confirmação; excluir o tópico apaga as respostas e volta para a categoria. Edições ficam marcadas
("editado"/"editada").

**Moderação** (`moderator`/`admin`). No tópico aparece a faixa **Moderação** com "Fixar no
topo"/"Desafixar" e "Trancar respostas"/"Destrancar" (RPC `moderate_thread`), "Editar" em
qualquer tópico (a página `/editar` avisa "Você está editando como moderação") e "Excluir" em
qualquer tópico/resposta. Em tópico trancado, membros veem um aviso no lugar do formulário; a
moderação ainda pode responder (para publicar um aviso). Revelar autoria anônima fica no painel
`/admin` (fora deste módulo).

**Denunciar.** "Denunciar" em tópicos e respostas de outras pessoas (não aparece no próprio
conteúdo) — ver [seção 8](#8-denúncias-reportbutton).

## 3. Anonimato na interface

- Publicação anônima: o app envia `{ is_anonymous: true }` **sem** `author_id` (o default é
  `auth.uid()`); o trigger grava a autoria real em `forum_anonymous_authorship` e salva o
  conteúdo com `author_id = NULL`. O app nunca recebe nem envia o id da autora anônima.
- Exibição: `author_id` nulo → "Anônima" + escudo neutro (`ForumAvatar` sem iniciais nem cor
  derivada de id). O HTML do tópico não contém o id da autora (o E2E confere).
- Selo **"você"**: lemos `forum_anonymous_authorship` filtrando **explicitamente**
  `user_id = <usuária atual>`. Sem o filtro, moderadoras (que leem todas as linhas pelo RLS)
  veriam "você" em conteúdo alheio.
- A autora anônima continua dona: edita, apaga, marca solução e recebe notificações.
- O switch só aparece em categoria com `allow_anonymous`; a action valida de novo e o banco
  recusa com `CD010` se alguém forjar o envio.

## 4. Server Actions

Arquivo: `src/lib/forum/actions.ts` (`"use server"`). Todas conferem sessão + onboarding
(`getMember()`), validam com zod (`src/lib/forum/schema.ts`), deixam o RLS autorizar de verdade e
chamam `revalidatePath("/forum", "layout")` após mutações. Nunca aceitam id de usuária do cliente.

| Action                     | Entrada (FormData / objeto)                                    | Retorno / efeito                                                                      | Autorização                                         |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `createThread(prev, fd)`   | `categoryId`, `title`, `body`, `tags[]`, `anonymous`           | `redirect('/forum/t/<id>')`; erro → `{ ok:false, error, fieldErrors, values, nonce }` | membro; anonimato só se a categoria permite         |
| `updateThread(prev, fd)`   | `threadId`, `title`, `body`, `tags[]`                          | `redirect('/forum/t/<id>')`; 0 linhas → "Você não pode editar…"                       | autora (nome ou anônima) ou moderação (RLS)         |
| `deleteThread(prev, fd)`   | `threadId`                                                     | `redirect('/forum/c/<slug>')`                                                         | autora ou moderação (RLS)                           |
| `createPost(prev, fd)`     | `threadId`, `body`, `anonymous`                                | `{ ok:true, message, postId, nonce }`                                                 | membro; tópico aberto (moderação responde trancado) |
| `updatePost(prev, fd)`     | `postId`, `threadId`, `body`                                   | `{ ok:true, message, nonce }`                                                         | autora (RLS)                                        |
| `deletePost(prev, fd)`     | `postId`, `threadId`                                           | `{ ok:true, message }`                                                                | autora ou moderação (RLS)                           |
| `toggleReaction(input)`    | `{ threadId, postId?, kind, active }` (objeto, chamada direta) | `{ ok:true }` · idempotente (`active` = estado desejado; `23505` = já existia)        | membro, em nome próprio                             |
| `setSolution(prev, fd)`    | `threadId`, `postId` (vazio = desmarcar)                       | `{ ok:true, message }`                                                                | autora do tópico ou moderação                       |
| `moderateThread(prev, fd)` | `threadId`, `op` = `pin \| unpin \| lock \| unlock`            | `{ ok:true, message }` via `rpc('moderate_thread')`                                   | moderação (checado no app e na RPC)                 |

Padrão de formulário (React 19 reseta o `<form>` após cada action): as actions devolvem `values`
e um `nonce` novo; os campos ficam num bloco com `key={nonce}` e são remontados com os valores
enviados — nada se perde num erro. A `FormMessage` fica fora do bloco (região `aria-live` sempre
montada) e o foco vai para o primeiro campo inválido. O `<select>` de categoria é **não
controlado** (`defaultValue`) de propósito: um `<select value>` controlado volta para a primeira
opção no reset automático do React.

## 5. Acesso a dados

Arquivo: `src/lib/forum/queries.ts` (`server-only`, sempre com o cliente da sessão → RLS).
Tipos compartilhados com o cliente em `src/lib/forum/types.ts`.

| Função                                       | Consulta                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getForumCategories()`                       | `forum_categories` + `forum_threads(count)` (contagem embutida), ordenadas por `sort_order`. Memoizada por requisição (`cache`).                                                                                                                                                                                                                     |
| `getCategoryOptions()` / `getCategoryBySlug` | Categorias para formulários / por slug (slug validado antes).                                                                                                                                                                                                                                                                                        |
| `listThreads(opts)`                          | `forum_threads` com `author:profiles!forum_threads_author_id_fkey(id, full_name, avatar_url, headline)` e `category:forum_categories!…_category_id_fkey(…)`; filtros `category_id`, `is_pinned`, `tags cs {tag}`, `or(title.ilike, body.ilike)`; `count: exact` + `range`. Depois: `forum_thread_reaction_counts` dos ids e autoria anônima própria. |
| `getThreadDetail(id, viewerId)`              | Tópico + respostas (`forum_posts!…` com `author:profiles!forum_posts_author_id_fkey`) em paralelo; reações do tópico, reações das respostas via `forum_reactions` + `post:forum_posts!inner(thread_id)` (sem URL gigante com `in(...)`), autoria anônima própria. Até 500 respostas.                                                                 |
| `getThreadSummary(id)`                       | Título/texto para `generateMetadata` (memoizada).                                                                                                                                                                                                                                                                                                    |
| `getEditableThread(id, viewer, isMod)`       | Tópico se a usuária é dona (nome/anônima) ou moderadora; senão `null` → 404.                                                                                                                                                                                                                                                                         |

Cuidados: embeds de `profiles` só com **colunas públicas explícitas** (nunca `*`); dicas de FK
(`!nome_fkey`) em todos os embeds; termo de busca e tag passam por `sanitizeSearchTerm` /
`sanitizeTag` (`src/lib/forum/text.ts`), que removem curingas e a sintaxe do filtro `or()` do
PostgREST (`, ( ) " \ % _ *`).

## 6. Arquivos e componentes

```
src/app/forum/
  page.tsx, loading.tsx                     /forum (busca, categorias, fixados, recentes)
  c/[slug]/page.tsx, loading.tsx, not-found.tsx
  novo/page.tsx, loading.tsx
  t/[id]/page.tsx, loading.tsx, not-found.tsx
  t/[id]/editar/page.tsx, loading.tsx
src/components/forum/
  category-icon.tsx      CategoryIcon do fórum (tamanho padrão) sobre o mapa do design system (CATEGORY_ICONS)
  category-grid.tsx      cartões de categoria (2 colunas compactas no celular)
  thread-list.tsx        linhas de tópico (link esticado, selos, tags, reações)
  author.tsx             ForumAvatar (escudo neutro p/ anônimas) e AuthorName (+ selo "você")
  reaction-bar.tsx       (cliente) Apoio/Útil/Parabéns com aria-pressed e useOptimistic
  reaction-summary.tsx   resumo compacto para listas
  thread-form.tsx        (cliente) novo/editar tópico
  reply-form.tsx         (cliente) responder
  editable-post.tsx      (cliente) edição de resposta no lugar
  post-card.tsx          resposta completa (servidor + peças cliente)
  markdown-editor.tsx    (cliente) Textarea + abas Escrever/Pré-visualizar (<Markdown> do DS)
  confirm-action-dialog.tsx (cliente) Dialog do DS + Server Action com erro dentro do diálogo
  action-button.tsx      (cliente) botão-formulário (fixar, trancar, solução) com erro inline
  forum-search.tsx       busca GET com next/form
  breadcrumbs.tsx, skeletons.tsx
src/lib/forum/  actions.ts · queries.ts · schema.ts · text.ts · errors.ts · types.ts · client-action.ts (+ *.test.ts)
src/components/moderation/report-button.tsx · src/lib/moderation/{actions,schema}.ts (+ teste)
```

Por que `ConfirmActionDialog` e não só a `ConfirmDialog` do DS? A `ConfirmDialog` fecha sem
retorno quando a action falha; aqui o erro (ex.: sem permissão) aparece dentro do diálogo. Ela é
composta só com `Dialog`, `FormMessage` e `SubmitButton` do design system.

## 7. Erros, validação e mensagens

- Validação no servidor com zod e mensagens pt-BR por campo (limites espelham os CHECKs do banco:
  `FORUM_LIMITS`). O formulário usa `noValidate`.
- Erros do banco passam por `friendlyDbError(error, fallback)` (`src/lib/forum/errors.ts`):
  códigos `CDxxx` mostram a mensagem pt-BR do banco (ex.: `CD011` "Este tópico está trancado…",
  `CD010`, `CD013`, `CD014`); `42501`, `23505`, `23514`, `23503`, `22P02`, `PGRST301`… viram
  textos amigáveis; o resto usa o `fallback` da ação ("Não conseguimos publicar… seu texto
  continua aqui"). A mensagem técnica do Postgres nunca chega à tela.
- Sessão expirada / perfil incompleto dentro de uma action → mensagem pedindo para entrar de novo
  ou completar o perfil (sem perder o texto).
- Rede caiu (ou erro inesperado no servidor) durante o envio: os formulários do fórum e da
  denúncia chamam a action por `withConnectionFallback` (`src/lib/forum/client-action.ts`), que
  devolve "Não conseguimos falar com o servidor… seu texto continua aqui" com os valores enviados,
  em vez de deixar o erro subir para o error boundary (que trocaria a página e apagaria o texto).
  `redirect()`/`notFound()` continuam funcionando (`unstable_rethrow`). As reações fazem o mesmo:
  a reação otimista volta e aparece um aviso.

## 8. Denúncias (`ReportButton`)

Componente compartilhado (contrato §12), usado no fórum, em papers, comentários de papers e perfis.

```tsx
import { ReportButton } from "@/components/moderation/report-button";

<ReportButton targetType="thread" targetId={thread.id} />
<ReportButton targetType="paper" targetId={paper.id} signedIn={Boolean(user)} label="Denunciar paper" />
<ReportButton targetType="post" targetId={post.id} display="icon" />
```

| Prop         | Tipo                                                            | Padrão        | Observação                                                           |
| ------------ | --------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `targetType` | `"thread" \| "post" \| "paper" \| "paper_comment" \| "profile"` | —             | enum `report_target`                                                 |
| `targetId`   | `string` (uuid)                                                 | —             |                                                                      |
| `label`      | `string`                                                        | `"Denunciar"` | texto do botão                                                       |
| `display`    | `"text" \| "icon"`                                              | `"text"`      | `icon` ganha `aria-label` ("Denunciar este tópico")                  |
| `size`       | `"sm" \| "md"`                                                  | `"sm"`        |                                                                      |
| `signedIn`   | `boolean`                                                       | `true`        | `false` (páginas públicas) → link para `/entrar?next=<página atual>` |

O diálogo traz os motivos de `REPORT_REASONS` (rádio), detalhes opcionais (até 1.000; com
"Outro motivo" pedimos ao menos 10 caracteres), um lembrete de canais de emergência (Ligue 180 —
Central de Atendimento à Mulher — e 190) e o aviso de sigilo. A Server Action
`createReport(prev, formData)` (`src/lib/moderation/actions.ts`):

1. valida (`reportSchema`);
2. exige sessão;
3. confere se o alvo existe e é visível para quem denuncia;
4. evita duplicidade: se a mesma pessoa já tem denúncia **aberta** para o mesmo alvo, responde
   com sucesso neutro ("Você já tinha denunciado…") sem criar outra;
5. insere em `reports` (a denunciante é `auth.uid()`; o trigger força `status = 'open'`);
6. `revalidatePath('/admin')`.

As denúncias são tratadas no painel `/admin` (moderação).

## 9. Acessibilidade e responsividade

- Um `h1` por página; tópico → `h2` "N respostas" → `h3` por resposta (títulos em Markdown são
  rebaixados: `#` vira `h2` no tópico e `h4` nas respostas).
- Linhas de tópico usam o `CardLink` do design system (link "esticado" com `after:rounded-none`
  e **anel de foco na linha inteira**); links internos (autora, categoria, tags) ficam acima
  (`relative z-10`).
- Cada resposta tem a âncora `#post-<id>` — o mesmo formato dos links das notificações (triggers
  do banco) e do `/admin`, então "Nova resposta no seu tópico" rola direto até a resposta.
- Reações: `role="group"` com nome ("Reagir ao tópico de …"); cada botão tem nome **fixo** (o
  rótulo: "Apoio", "Útil", "Parabéns"), estado em `aria-pressed` e a contagem na descrição
  (`aria-describedby` → "3 reações"), como o botão de destaque da Vitrine; erro anunciado em
  `aria-live`.
- Formulários: rótulos visíveis (`Field`), erros ligados por `aria-describedby`, `FormMessage`
  sempre montada, foco no primeiro campo inválido, abas do editor com o padrão ARIA do `Tabs`.
- Edição de resposta: foco vai para o texto ao abrir e volta para "Editar" ao salvar/cancelar.
- Diálogos são `<dialog>` nativos (foco preso, Esc fecha).
- Testado em 390 px e 1440 px, temas claro e escuro, sem rolagem horizontal. No celular as
  categorias viram 2 colunas compactas e a contagem de respostas vai para a linha de metadados.

## 10. Como testar

**Unitários** (helpers puros):

```bash
npx vitest run src/lib/forum src/lib/moderation
```

Cobrem normalização de tags, schemas zod (mensagens e limites), leitura de FormData, busca
sanitizada, paginação, `markdownToPlainText`, mapeamento de erros e o schema de denúncia.

**Manual** (Supabase local com seed; senha `ciencia-delas-demo`):

1. `larissa@demo.cienciadelas.dev` → `/forum`: categorias, "Fixados", busca "revisão
   sistemática", clique numa tag "vale do paraíba".
2. "Novo tópico" → envie vazio (erros por campo) → preencha e publique → edite → responda →
   reaja → marque a própria resposta como solução → exclua a resposta e o tópico.
3. `gabriela@…` → `/forum/t/a1000000-0000-4000-8000-000000000006` (anônimo dela): "Anônima" +
   selo "você" + "Editar". Crie um tópico anônimo em "Maternidade e cuidado".
4. Com `larissa@…`, abra esse tópico: "Anônima" **sem** "você", sem "Editar", com "Denunciar".
5. `moderacao@…` → mesmo tópico: faixa "Moderação" (fixar/trancar), "Editar" no tópico,
   "Excluir" em tudo e **nenhum** selo "você". Tranque e confira com a Larissa o aviso no lugar do formulário.
6. Visitante (janela anônima) → `/forum` redireciona para `/entrar?next=%2Fforum`.

**E2E automatizado** (Playwright, usado no desenvolvimento): o roteiro acima foi automatizado
com 100+ verificações (inclui efeitos no banco via `psql`, ausência de vazamento do id da autora
anônima, erros de console/hidratação e capturas em 390/1440 × claro/escuro). Para gerar cookies
de sessão sem a tela de login: `node scripts/e2e/auth-cookies.mjs <email> ciencia-delas-demo
http://localhost:<porta>`. Dados de teste usam títulos começando com `[teste]` e são apagados no
fim.

## 11. Limitações conhecidas

- Busca é `ilike` (sensível a acentos: "revisao" não acha "revisão"). Uma evolução natural é
  `unaccent` + `pg_trgm`/full-text com uma RPC.
- Respostas não são paginadas (até 500 por tópico).
- Com `loading.tsx`, páginas inexistentes respondem HTTP 200 com a tela de "não encontrado"
  (comportamento de streaming do Next; a página inclui `noindex`).
- Revelar autoria anônima e o histórico de moderação ficam no painel `/admin`.
