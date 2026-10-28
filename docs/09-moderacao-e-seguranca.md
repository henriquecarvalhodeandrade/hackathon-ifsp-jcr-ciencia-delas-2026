# 09 · Moderação, segurança e páginas institucionais

> Escopo deste documento (feature **F6 — landing, páginas estáticas e admin**): a página inicial,
> `/sobre`, `/conduta`, `/privacidade`, a central de **notificações**, o **painel de moderação**
> (`/admin`), `robots.txt` e `sitemap.xml` — e as regras de segurança e LGPD que valem para toda a
> plataforma.

Sumário

1. [Rotas e quem acessa](#1-rotas-e-quem-acessa)
2. [Página inicial (`/`)](#2-página-inicial-)
3. [Páginas institucionais](#3-páginas-institucionais)
4. [Notificações (`/notificacoes`)](#4-notificações-notificacoes)
5. [Painel de moderação (`/admin`)](#5-painel-de-moderação-admin)
6. [Papéis e permissões](#6-papéis-e-permissões)
7. [Anonimato e revelação de autoria](#7-anonimato-e-revelação-de-autoria)
8. [Trilha de auditoria](#8-trilha-de-auditoria)
9. [SEO: `robots.txt` e `sitemap.xml`](#9-seo-robotstxt-e-sitemapxml)
10. [Checklist de segurança](#10-checklist-de-segurança)
11. [LGPD na prática](#11-lgpd-na-prática)
12. [Arquivos](#12-arquivos)
13. [Como testar](#13-como-testar)
14. [Limitações conhecidas e próximos passos](#14-limitações-conhecidas-e-próximos-passos)

---

## 1. Rotas e quem acessa

| Rota                         | Acesso                                       | O que faz                                                                         |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`                          | Pública (dinâmica)                           | Landing com números reais, pilares, mentoria em 3 passos, destaques e Boletim     |
| `/sobre`                     | Pública                                      | Missão, problema, como funciona, tecnologia, equipe (a preencher), links          |
| `/conduta`                   | Pública                                      | Código de conduta                                                                 |
| `/privacidade`               | Pública                                      | Política de privacidade (LGPD)                                                    |
| `/notificacoes`              | Logada (`requireUser`)                       | Lista, filtro “Não lidas”, marcar como lida, marcar todas, limpar lidas           |
| `/notificacoes/abrir/[id]`   | Logada (route handler GET)                   | Marca como lida e redireciona (303) para o link interno da notificação            |
| `/admin`                     | Moderadora ou admin (`requireModerator`)     | Abas Denúncias · Newsletter (só admin) · Membros                                  |
| `/robots.txt`, `/sitemap.xml`| Pública                                      | Gerados por `src/app/robots.ts` e `src/app/sitemap.ts`                            |

- O **proxy** (`src/proxy.ts`) faz só a checagem otimista: visitante em `/notificacoes` ou `/admin`
  vai para `/entrar?next=…`. **Toda** página, Server Action e route handler confere a sessão de
  novo no servidor.
- `/admin` também tem um `layout.tsx` com `requireModerator()` (defesa em profundidade para
  subpáginas futuras). Membra comum vê a tela “não encontrada” — a rota “não existe” para ela. Quem
  ainda não concluiu o onboarding é mandada para `/onboarding?next=/admin`.
- Todas as páginas exportam `metadata`; `/notificacoes` e `/admin` têm `robots: noindex`.

## 2. Página inicial (`/`)

Seções (componentes em `src/components/landing/`):

| Seção                     | Componente             | Dados                                                                                     |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Hero “Ciência também é delas” | `hero.tsx`         | Perfil da sessão (`getCurrentProfile`) para personalizar os botões                        |
| A rede em números         | `platform-stats.tsx`   | `rpc('get_platform_stats')` — números reais; sem dados a seção some                       |
| Por que existimos         | `why-section.tsx`      | Texto + **um** dado citado com fonte (veja abaixo)                                        |
| Três pilares              | `pillars.tsx`          | Estático (Fórum seguro · Mentoria com IA · Vitrine e Boletim)                             |
| Como funciona a mentoria  | `mentorship-steps.tsx` | Estático, com aviso de consentimento de IA e link para `/privacidade#ia`                  |
| Destaques da semana       | `featured-papers.tsx`  | `rpc('get_paper_ranking', { p_period: 'week', p_limit: 3 })`; se ninguém destacou nada em 7 dias, usa `hot` e muda o título para “Em alta na Vitrine” (`featured.ts`) |
| Boletim                   | `newsletter-cta.tsx`   | Edição publicada mais recente (`newsletter_editions`, status `published`/`sent`)          |
| Crédito do hackathon      | `hackathon-credit.tsx` | Estático                                                                                  |

**Botões personalizados**

| Quem                                  | Botões do hero                                        |
| ------------------------------------- | ----------------------------------------------------- |
| Visitante                             | “Criar minha conta” · “Explorar a Vitrine”            |
| Logada sem onboarding                 | “Completar meu perfil” · “Explorar a Vitrine”         |
| Mentoranda (`seeks_mentorship`)       | “Ir para o fórum” · “Ver minhas sugestões”            |
| Mentora (`is_mentor`)                 | “Ir para o fórum” · “Ver pedidos de mentoria” (`/mentoria?aba=recebidas`) |
| Demais membras                        | “Ir para o fórum” · “Explorar a Vitrine”              |

**Regras de dados**

- A landing **nunca** faz embed de `profiles` (visitantes não têm SELECT nessa tabela e o
  PostgREST derrubaria a consulta inteira). Só usa RPCs públicas e edições publicadas.
- Sem Supabase configurado (`isSupabaseConfigured()` falso) ou com o banco fora do ar, a página
  renderiza do mesmo jeito: sem números, com o estado vazio da Vitrine.
- **Nada de estatística inventada.** O único número externo é “Segundo a UNESCO, as mulheres são
  menos de um terço das pessoas que fazem pesquisa no mundo”, com link para a página da ONU sobre
  o Dia Internacional das Mulheres e Meninas na Ciência (verificado em out/2026). Não há
  depoimentos.

## 3. Páginas institucionais

As três usam `DocLayout` (`src/components/landing/doc-layout.tsx`): cabeçalho padrão, data da
última revisão, **sumário** fixo no desktop e recolhível (`<details>`) no celular, e texto com a
tipografia `prose-delas`. `DocSection` cria cada `h2` com âncora; `ExternalLink` abre em nova aba
com aviso para leitor de tela; `DocCallout` destaca avisos.

- **`/sobre`** — missão, problema, como funciona (fórum, mentoria, Vitrine/ranking/Boletim), para
  quem, princípios, tabela da stack, **equipe (espaço reservado — preencha em
  `src/app/sobre/page.tsx`)** e links para o repositório, a pasta `docs/` e o design system.
- **`/conduta`** — compromisso, acolhimento, respeito, zero tolerância a assédio,
  confidencialidade dos relatos, anonimato e moderação, como denunciar (os motivos vêm de
  `REPORT_REASONS`), consequências graduais e canais de ajuda fora da plataforma (Ligue 180, 190,
  CVV 188, ouvidoria da instituição).
- **`/privacidade`** — resumo, controladora, dados coletados, finalidades e **bases legais (art. 7º)**,
  IA (Gemini/Groq/OpenRouter, uso de dados no plano gratuito, pseudonimização `c1..cN`, 18+,
  consentimento revogável que apaga o embedding), Boletim (consentimento, confirmação dupla,
  descadastro em um clique, exclusão), operadores (Supabase, Vercel, Google/Groq/OpenRouter,
  Resend) e transferência internacional, cookies (só sessão + tema em `localStorage`), retenção,
  segurança, **direitos do art. 18**, menores de idade (art. 14) e contato.

> **A preencher pela equipe antes de publicar:** nome da controladora e da encarregada (DPO) com
> e-mail em `/privacidade#contato`, e os nomes da equipe em `/sobre#equipe`.

## 4. Notificações (`/notificacoes`)

As notificações são criadas **somente por triggers** no banco (novo pedido de mentoria, resposta
ao pedido, resposta no seu tópico — inclusive anônimo —, solução marcada, comentário no seu paper e
**denúncia concluída** — `report_resolved`, quando a moderação resolve ou arquiva uma denúncia sua;
veja docs/03 §6). O app só lê, marca como lida e apaga.

O aviso de denúncia concluída ("Sua denúncia foi resolvida" / "Sua denúncia foi analisada") diz
sobre o que era a denúncia ("um tópico do fórum", "um paper da Vitrine"…), agradece e, se a moderação
escreveu uma nota, acrescenta "Nota da moderação: …". Nunca diz **quem** moderou. Link:
`/notificacoes`. Quem resolve a própria denúncia não recebe aviso.

Fluxo:

1. A lista mostra as **não lidas primeiro** (com ponto âmbar e fundo violeta suave), depois as
   lidas, ambas da mais recente para a mais antiga (`sortNotifications`). Limite de 100.
2. Abas “Todas” / “Não lidas” (`?filtro=nao-lidas`) com contagens.
3. Clicar no título abre `/notificacoes/abrir/<id>`: o handler confere a sessão, marca como lida e
   redireciona (303) para o link — **só caminhos internos** (`safeInternalPath` recusa `http…`,
   `//host`, `\`, espaços e caracteres de controle). O item usa `<a>` comum, sem prefetch, para
   que só um clique real marque como lida.
4. “Marcar como lida” em cada item, “Marcar todas como lidas” e “Limpar lidas” (com
   `ConfirmDialog`; apaga só as lidas).
5. Depois de cada ação, `revalidatePath("/", "layout")` atualiza também o **sino do cabeçalho**.

Server Actions (`src/lib/notifications/actions.ts`): `markNotificationRead(prev, formData)`,
`markAllNotificationsRead()`, `deleteReadNotifications()`. Todas conferem `getCurrentUser()` e
filtram por `user_id` **da sessão** (o RLS também restringe às próprias linhas e só permite
alterar `read_at`).

## 5. Painel de moderação (`/admin`)

Abas por URL (`?aba=`): **Denúncias** (padrão), **Newsletter** (só admins), **Membros** e
**Registro** (`?aba=registro`, a trilha de auditoria — [seção 8](#8-trilha-de-auditoria)).
O resultado de cada ação aparece num aviso fixo no canto da tela (`AdminFlashRegion`, região
`aria-live`), porque muitas ações tiram o cartão da lista (ex.: resolver uma denúncia).

### 5.1 Denúncias

- Filtros: **Abertas** (fila, das mais antigas para as mais novas), **Resolvidas** e
  **Arquivadas** (`?status=resolvidas|arquivadas`), com contagens e paginação (15 por página).
- Cada cartão mostra: motivo, tipo do alvo, quando e quem denunciou, o relato, uma **prévia do
  conteúdo** (tópico, resposta, paper, comentário ou perfil — com autoria “Anônima” quando for o
  caso e link “Abrir no site”), a **nota para quem denunciou** (com o selo “Visível para quem
  denunciou”) e o **registro interno** da moderação ligado àquela denúncia (quem fez o quê, quando e
  por quê).
- Ações sobre o conteúdo (só em denúncias abertas):

| Alvo              | Ações                                                                                  | Como                                         |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Tópico            | Fixar/Desafixar · Trancar/Destrancar · Excluir · Revelar autoria (admin, se anônimo)   | `rpc('moderate_thread')`, `delete` (RLS), `rpc('reveal_anonymous_author')` |
| Resposta          | Excluir · Revelar autoria (admin, se anônima)                                          | `delete` (RLS), `rpc('reveal_anonymous_author')` |
| Paper             | Ocultar/Reexibir na Vitrine · Excluir                                                  | `rpc('moderate_paper')`, `delete` (RLS)      |
| Comentário        | Excluir                                                                                | `delete` (RLS)                               |
| Perfil            | Abrir o perfil (papéis são trocados na aba Membros)                                    | —                                            |

- As ações de conteúdo enviam o id da denúncia: o registro de auditoria fica ligado a ela.
- **Excluir** pede confirmação, registra `delete_content` na auditoria e **encerra automaticamente**
  as denúncias abertas sobre aquele conteúdo, acrescentando “Conteúdo excluído pela moderação.” à
  nota (visível para quem denunciou, que recebe o aviso). Também encerra as denúncias
  abertas do que foi apagado **em cascata**: respostas de um tópico excluído e comentários de um
  paper excluído (“…removida junto com o tópico excluído pela moderação.”). Se a exclusão falhar,
  o diálogo de confirmação continua aberto e mostra o erro.
- **Resolver / Arquivar / Reabrir** com nota opcional (até 800 caracteres), rotulada **“Nota para
  quem denunciou”**: ela é **visível para quem denunciou** (vai no aviso e o RLS deixa a denunciante
  ler a própria denúncia). Nada interno vai para ela — as ações ficam no registro de auditoria. O
  trigger do banco preenche `resolved_by` e `resolved_at` (reabrir limpa os dois) e, na passagem de
  aberta → resolvida/arquivada, registra `resolve_report`/`dismiss_report` e avisa a denunciante.
- Uma página além do fim (ex.: `?pagina=2` depois de resolver a última denúncia dela) mostra a
  última página existente, em vez de um erro (o PostgREST responde `PGRST103` nesse caso). O mesmo
  vale para a aba Membros.

### 5.2 Newsletter (somente admins)

Usa o serviço compartilhado com o cron (`src/lib/newsletter/service.ts`, CONTRACT §11):

- Mostra o transporte de e-mail (`getNewsletterOverview()`): Resend ativo (com alerta se o
  remetente ainda for o de teste `onboarding@resend.dev`), **Mailpit** em desenvolvimento ou
  “não configurado”; e as contagens de inscritas (ativas, aguardando confirmação, descadastradas).
- **Gerar edição da semana** → `generateWeeklyEdition({ publish: true })`. Idempotente: se a
  edição da semana já existe, nada é duplicado.
- **Publicar no arquivo** aparece nos rascunhos (ex.: de uma semana anterior, gerados sem
  `publish`) → `publishEdition(id)`. Só rascunhos são publicados; uma edição enviada nunca volta
  para “publicada”.
- **Enviar** em dois passos: “Preparar envio” chama `sendEdition(id, { dryRun: true })` e mostra
  quantas inscritas receberiam; só então aparece **Confirmar envio** (`sendEdition(id)`). Edições
  já enviadas oferecem “Enviar para quem ainda não recebeu” (o serviço nunca envia duas vezes para
  a mesma inscrita).

### 5.3 Membros

- Lista de perfis (25 por página) com busca por nome/instituição (`?q=`), filtro por papel
  (`?papel=member|moderator|admin`), selos (Mentora, Perfil incompleto, Você) e data de entrada.
  Não mostra e-mails (minimização de dados).
- **Somente admins** trocam papéis. A action `changeMemberRole` confere que quem pede é admin,
  recusa mudar o **próprio** papel e impede rebaixar a **última** administradora. Como a coluna
  `role` não tem GRANT de UPDATE para ninguém (de propósito), a escrita usa o cliente admin
  (service role) — sempre depois da checagem. A troca é registrada na auditoria (`change_role`,
  motivo “Membra → Moderadora”) com a sessão da admin.

### 5.4 Server Actions (`src/lib/admin/actions.ts`)

| Action                     | Quem         | Valida (zod)                                         | Efeito                                                                 |
| -------------------------- | ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `resolveReport`            | moderação    | `id` uuid, `status` open/resolved/dismissed, `note` ≤ 800 | `update reports` (nota visível para quem denunciou; o trigger audita e avisa) |
| `moderateThreadAction`     | moderação    | `threadId` uuid, `op` pin/unpin/lock/unlock, `reportId?` | `rpc('moderate_thread', { …, p_report_id })` (a RPC audita)          |
| `setPaperVisibility`       | moderação    | `paperId` uuid, `hidden` true/false, `reportId?`      | `rpc('moderate_paper', { …, p_report_id })` (a RPC audita)             |
| `deleteReportedContent`    | moderação    | `targetType` thread/post/paper/paper_comment, `targetId` uuid, `reportId?` | `delete` + auditoria `delete_content` + encerra denúncias abertas do alvo |
| `revealAnonymousAuthor`    | **admin**    | `reportId`, `targetType` thread/post, `targetId`, `reason` 20–300, `confirm` | `rpc('reveal_anonymous_author', { …, p_reason, p_report_id })` — auditoria na mesma transação |
| `changeMemberRole`         | **admin**    | `profileId` uuid, `role`                              | `update profiles.role` (service role) + auditoria `change_role`        |
| `generateEditionAction`    | **admin**    | —                                                    | `generateWeeklyEdition({ publish: true })`                             |
| `publishEditionAction`     | **admin**    | `editionId` uuid (só rascunhos)                       | `publishEdition(id)`                                                   |
| `sendEditionAction`        | **admin**    | `editionId` uuid, `mode` preview/send                 | `sendEdition(id, { dryRun })`                                          |

Todas devolvem `{ ok: true, message } | { ok: false, error, fieldErrors? }`. Erros do banco passam
por `friendlyDbError` (`src/lib/admin/errors.ts`): códigos `CD…` mostram a mensagem pt-BR do
banco; `42501`, `23505`, `23514`, `PGRST116` etc. viram textos amigáveis; o resto, uma mensagem
genérica (nunca a mensagem crua do Postgres). Depois de cada mutação, `revalidatePath` em
`/admin` e nas páginas afetadas (`/forum`, `/papers`, `/ranking`, `/newsletter`, `/`).

## 6. Papéis e permissões

| Capacidade                                         | Membra | Moderadora | Admin |
| -------------------------------------------------- | :----: | :--------: | :---: |
| Denunciar conteúdo e perfis                         |   ✓    |     ✓      |   ✓   |
| Ver a fila de denúncias, resolver, arquivar, reabrir |       |     ✓      |   ✓   |
| Fixar/trancar tópicos, ocultar papers               |        |     ✓      |   ✓   |
| Excluir tópicos, respostas, papers e comentários de outras pessoas |  |  ✓  |   ✓   |
| Ver a lista de membras e papéis                     |        |     ✓      |   ✓   |
| **Revelar autoria anônima** (no painel)             |        |            |   ✓   |
| **Trocar papéis**                                   |        |            |   ✓   |
| **Gerar e enviar o Boletim**                        |        |            |   ✓   |

| Ver o **registro de auditoria** (aba Registro)      |        |     ✓      |   ✓   |

No banco, `reveal_anonymous_author` aceita moderadoras (docs/03 §7) e exige o motivo (20–300
caracteres); o painel é **mais restritivo** e só oferece a ação a administradoras, exigindo
justificativa ligada a uma denúncia.

Como promover alguém pela primeira vez (não há admin ainda): no SQL Editor do Supabase,
`update public.profiles set role = 'admin' where id = '<uuid>';`. Depois disso, use a aba Membros.

## 7. Anonimato e revelação de autoria

- Outras membras nunca veem quem publicou de forma anônima; o painel mostra “Anônima” mesmo para a
  moderação.
- A revelação só existe no painel, para **admins**, e exige: uma denúncia sobre **aquele**
  conteúdo, um motivo de 20 a 300 caracteres e a confirmação “Entendo que este é um caso grave…”.
- Ordem das operações em `revealAnonymousAuthor`: confere a denúncia → chama a RPC
  `reveal_anonymous_author(p_thread_id | p_post_id, p_reason, p_report_id)`, que valida o motivo
  (`CD016`) e se a denúncia é sobre aquele conteúdo (`CD017`) e **grava o registro de auditoria na
  mesma transação** em que devolve a autoria → só então o nome é buscado e exibido. Sem registro,
  nada é revelado. O nome revelado nunca é gravado (nem no registro, nem na denúncia).
- O nome aparece apenas dentro do diálogo; ao fechar, some da tela. O log do servidor registra
  só ids (`[moderacao] autoria anônima revelada { report, target, by, at }`), nunca nomes ou o
  motivo.

## 8. Trilha de auditoria

Tabela `public.moderation_audit_log` (migration `20261028090000_integration.sql`, docs/03 §3):
`id`, `actor_id` (quem agiu; vira NULL se a conta for excluída), `action`, `target_type`/`target_id`
(o conteúdo ou perfil), `report_id` (a denúncia de onde a ação partiu, se houver), `reason` (≤ 500) e
`created_at`. **Só moderadoras e admins leem**; incluir só em nome próprio (`actor_id = auth.uid()`);
**ninguém edita nem apaga** pela API (sem políticas nem GRANT de UPDATE/DELETE — só a service role).

| Ação (`action`)                                   | Quem grava                                                    | Motivo (`reason`)                   |
| ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `reveal_author`                                   | RPC `reveal_anonymous_author`, na mesma transação             | obrigatório (20–300)                |
| `pin_thread`, `unpin_thread`, `lock_thread`, `unlock_thread` | RPC `moderate_thread` (só o que mudou)             | opcional (`p_reason`)               |
| `hide_paper`, `unhide_paper`                      | RPC `moderate_paper` (só quando muda)                         | opcional (`p_reason`)               |
| `resolve_report`, `dismiss_report`                | trigger `reports_after_status_change` (aberta → resolvida/arquivada) | —                            |
| `delete_content`                                  | painel (`deleteReportedContent`, sessão da moderadora)        | nota da exclusão                    |
| `change_role`                                     | painel (`changeMemberRole`, sessão da admin)                  | “Membra → Moderadora”               |

Onde aparece: em cada cartão de denúncia (“Registro da moderação · interno”) e na aba **Registro**
(`/admin?aba=registro`, 30 por página, mais recente primeiro, ações sensíveis com selo). Rótulos e
regras puras em `src/lib/admin/audit.ts` (+ `audit.test.ts`); consultas em
`src/lib/admin/queries.ts` (`listAuditLog`, auditoria por denúncia).

**Por que saiu da nota da denúncia:** antes, o painel acrescentava linhas `[Auditoria] …` (com o nome
de quem revelou uma autoria e o motivo) em `reports.resolution_note` — que a denunciante consegue ler
pela API. A migration move essas linhas para o registro (ação `reveal_author`, autoria desconhecida) e
as apaga da nota. Agora `resolution_note` é só a **nota para quem denunciou**.

## 9. SEO: `robots.txt` e `sitemap.xml`

- `robots.ts`: libera `/` e bloqueia as áreas de membras (`PROTECTED_PREFIXES`: `/onboarding`,
  `/perfil`, `/pesquisadoras`, `/forum`, `/mentoria`, `/papers/novo`, `/notificacoes`, `/admin`),
  `/papers/*/editar`, telas de autenticação, `/auth/`, `/api/` e as páginas com token da
  newsletter (`/newsletter/confirmar`, `/newsletter/cancelar`). Aponta para o sitemap.
- `sitemap.ts`: rotas públicas fixas + edições `published`/`sent` + papers visíveis (até 1.000),
  consultados com um cliente **anônimo sem cookies** (o RLS de `anon` já esconde ocultos e
  rascunhos). `revalidate = 3600`. Sem Supabase, devolve só as rotas fixas.
- As URLs usam `getSiteUrl()` — defina `NEXT_PUBLIC_SITE_URL` em produção.

## 10. Checklist de segurança

- [x] RLS em todas as tabelas; o app nunca usa `select('*')` em perfis de outras pessoas.
- [x] Toda Server Action confere sessão **e** papel antes de qualquer escrita; ids de usuária vêm
      sempre da sessão, nunca do formulário.
- [x] Escritas de moderação pelo cliente com sessão (RLS + RPCs revalidam no Postgres); service role
      só para trocar papéis e para a newsletter, depois da checagem de admin.
- [x] Entradas validadas com zod no servidor (uuids, enums, tamanhos).
- [x] Redirecionamento de notificações só para caminhos internos (sem open redirect).
- [x] Erros do banco nunca são mostrados crus; códigos `CD…` têm mensagens pt-BR próprias.
- [x] `/admin` e `/notificacoes` com `noindex` e bloqueados no `robots.txt`.
- [x] Revelação de autoria: só admin no painel, motivo obrigatório no banco, ligada a uma denúncia e
      auditada na mesma transação.
- [x] Registro de auditoria dedicado (`moderation_audit_log`), só de inclusão, legível só pela moderação.
- [x] Nota da denúncia visível para quem denunciou sem dados internos; aviso ao concluir a denúncia.
- [x] Logs sem dados pessoais (só ids e códigos de erro).
- [x] Limites de e-mails de confirmação da newsletter (3 por endereço/dia + teto diário global).
- [ ] Rate limit para denúncias e ações em massa (sugestão: Vercel Firewall ou contador no banco).

## 11. LGPD na prática

| Direito / obrigação                     | Onde está                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Transparência (art. 9º)                 | `/privacidade` em linguagem simples                                                |
| Consentimento de IA (art. 7º, I e 8º)   | Caixa desmarcada no onboarding/perfil, com 18+; revogar apaga o embedding e as sugestões de mentoras (trigger) |
| Consentimento do Boletim                | Caixa desmarcada, texto guardado em `consent_text`, confirmação dupla               |
| Correção e revogação (art. 18)          | `/perfil`; descadastro pelo link de cada edição                                     |
| Eliminação                              | Exclusão de conta apaga em cascata (inclusive conteúdo anônimo); “excluir meus dados” na página de descadastro |
| Minimização                             | Prompts pseudonimizados; painel de membros sem e-mails; logs só com ids            |
| Dados sensíveis (art. 11)               | Anonimato nos temas sensíveis e aviso na política                                  |
| Menores (art. 14)                       | Seção própria na política; IA e Boletim exigem 18+                                 |

## 12. Arquivos

```
src/app/page.tsx                         landing
src/app/sobre|conduta|privacidade/page.tsx
src/app/notificacoes/{layout,page,loading}.tsx
src/app/notificacoes/abrir/[id]/route.ts  marcar como lida + redirect
src/app/admin/{layout,page,loading}.tsx
src/app/robots.ts · src/app/sitemap.ts
src/components/landing/*                 seções da landing, DocLayout, data.ts (server-only), featured.ts (+ teste)
src/components/notifications/*           lista, ícone por tipo, ações (cliente)
src/components/admin/*                   cartão de denúncia, ações de conteúdo, revelar autoria,
                                         formulário de papel, painel da newsletter, registro de
                                         auditoria (audit-log.tsx), aviso fixo (flash)
src/lib/notifications/{meta,queries,actions}.ts (+ meta.test.ts)
src/lib/admin/{action-state,errors,audit,params,queries,actions}.ts (+ testes)
```

## 13. Como testar

Testes de unidade (regras puras):

```bash
npx vitest run src/lib/admin src/lib/notifications src/components/landing
```

Cobrem: tradução de erros, rótulos/links/limites do registro de auditoria e da nota para quem
denunciou, leitura dos parâmetros do painel, ordenação/filtros/links seguros das notificações e a
escolha dos destaques da landing. As regras do banco (auditoria, aviso de denúncia, motivo
obrigatório) estão em `supabase/tests/database/rls.test.sql` (`npx supabase test db`).

Roteiro manual com o Supabase local e as contas de demonstração (senha `ciencia-delas-demo`):

1. **Visitante** — abra `/`: números da rede, 3 destaques da semana e botões “Criar minha conta” /
   “Explorar a Vitrine”. Abra `/sobre`, `/conduta`, `/privacidade` e use o sumário. Tente
   `/notificacoes` e `/admin`: vai para `/entrar?next=…`. Confira `/robots.txt` e `/sitemap.xml`.
2. **`larissa@demo.cienciadelas.dev`** (mentoranda) — a landing diz “Que bom te ver, Larissa.” e
   mostra “Ver minhas sugestões”. Em `/admin`, aparece a tela “não encontrada”.
3. **Notificações** — entre com `renata@demo.cienciadelas.dev` (tem não lidas): marque uma como
   lida, abra outra (vai para o link e fica lida), use “Marcar todas como lidas” e veja o número do
   sino zerar. “Limpar lidas” pede confirmação. *(Isso altera dados de demonstração; para restaurar:
   `update notifications set read_at = null where user_id = (select id from auth.users where email = 'renata@demo.cienciadelas.dev');`)*
4. **`moderacao@demo.cienciadelas.dev`** — a denúncia de demonstração (spam numa resposta) está na
   fila. Sem aba Newsletter, sem “Revelar autoria”, sem troca de papéis. Teste resolver com nota,
   ver em “Resolvidas” e reabrir.
5. **`admin@demo.cienciadelas.dev`** — aba Newsletter: “Preparar envio” na edição `2026-s43`
   (prévia sem enviar). Aba Membros: troque o papel de uma conta e volte. Em denúncias de tópicos
   anônimos aparece “Revelar autoria” (motivo curto é recusado; depois de revelar, a entrada
   “revelou a autoria” aparece no registro interno do cartão e na aba Registro — e **não** na nota
   da denúncia). Resolva uma denúncia com nota: quem denunciou recebe o aviso em `/notificacoes`.

A verificação automatizada da F6 (Playwright, 32 cenários contra o Supabase local) criou uma
usuária de teste `f6-teste@demo.cienciadelas.dev` com tópicos, resposta, paper e denúncias
prefixados com `[teste]`, exercitou todas as ações acima (incluindo falhas de validação e acesso
negado) conferindo o efeito no banco com `psql`, e apagou tudo ao final (a exclusão da conta remove
os dados em cascata).

## 14. Limitações conhecidas e próximos passos

- **404 “suave”:** como existe `src/app/loading.tsx` na raiz, `notFound()` em páginas responde em
  streaming com status 200 (a tela “não encontrada” e `noindex` aparecem normalmente e nenhum dado
  protegido é enviado). Para um 404 HTTP real, remova o `loading.tsx` da raiz e mantenha só os das
  rotas.
- **A denunciante lê a própria denúncia inteira pela API**, inclusive `resolved_by` (o id de quem
  resolveu). A nota (`resolution_note`) agora é de propósito visível para ela; os registros internos
  ficam em `moderation_audit_log`. Se for preciso esconder também quem resolveu, a saída é expor as
  denúncias da denunciante por uma view/RPC com colunas limitadas.
- **Exclusões feitas fora do painel** (ex.: moderadora apagando uma resposta direto no fórum) não
  entram no registro de auditoria — só as do painel (`deleteReportedContent`). Fixar/trancar e ocultar
  são auditados em qualquer tela, porque a auditoria está nas RPCs.
- A entrada `change_role` e a de `delete_content` são gravadas logo depois da ação (não na mesma
  transação); se a gravação falhar, o erro vai para o log do servidor.
- Notificações em tempo real (Realtime) não estão ligadas: a contagem do sino atualiza a cada
  navegação.
