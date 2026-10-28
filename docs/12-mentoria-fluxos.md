# 12 · Mentoria: telas, fluxos e Server Actions

> Como a página **`/mentoria`** funciona de ponta a ponta: abas, o que cada pessoa vê, as Server
> Actions, como os dados são lidos e como testar. O algoritmo de sugestões (heurística, IA,
> privacidade) está em [04 · Mentoria com IA](04-mentoria-com-ia.md); as regras do banco
> (máquina de estados, capacidade, RLS) em [03 · Banco de dados](03-banco-de-dados.md).

**Resumo:** a mentoranda ativa "Quero ser mentorada", pede sugestões (calculadas pelas regras da
plataforma; a IA é opcional e só entra com a autorização dela), lê por que cada mentora combina
com ela e envia um pedido com uma mensagem. A mentora aceita ou recusa (com resposta
opcional), controla as vagas e pode pausar novos pedidos. Com a mentoria aceita, as duas
**conversam pela própria plataforma** (`/mentoria/conversa/<pedido>`, com recibo de leitura e aviso
de mensagem nova), veem o e-mail uma da outra, recebem um checklist do primeiro encontro e podem
concluir a mentoria — depois disso a conversa fica guardada só para leitura. Tudo roda com a sessão
da usuária: o RLS e os triggers do banco garantem as regras.

---

## 1. Rota e abas

| Rota                       | Acesso                                                | O que mostra                                                              |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `/mentoria`                | membros com onboarding (`requireOnboardedProfile`)    | aba padrão (ver abaixo)                                                   |
| `/mentoria?aba=sugestoes`  | membros                                               | sugestões de mentoras (+ cartão "Ativar sugestões com IA") ou convite     |
| `/mentoria?aba=enviadas`   | membros                                               | pedidos que ela enviou (em andamento e encerrados)                        |
| `/mentoria?aba=recebidas`  | só quem é mentora (ou ainda tem pedidos recebidos)    | disponibilidade, vagas, pedidos aguardando resposta e já respondidos      |
| `/mentoria?aba=ativas`     | membros                                               | mentorias aceitas (as duas participantes), contato, checklist, concluídas |
| `/mentoria?mentora=<uuid>` | membros                                               | link direto: abre o pedido para essa mentora, mesmo sem sugestões         |
| `/mentoria?aviso=<chave>`  | membros                                               | aviso de sucesso depois de uma ação (só chaves conhecidas)                |
| `/mentoria/conversa/<id>`  | só as duas participantes do pedido (404 para o resto) | conversa da mentoria ([seção 4](#4-conversa-da-mentoria))                 |

- Visitante sem sessão: o proxy manda para `/entrar?next=/mentoria...`; quem não terminou o
  onboarding vai para `/onboarding?next=...`.
- **Aba padrão** (`resolveTab`): link direto → sugestões; mentora com pedidos pendentes →
  recebidas; quem busca mentoria → sugestões; só mentora → recebidas. As notificações de
  mentoria apontam para `/mentoria`, então a mentora cai direto nos pedidos.
- As abas mostram contadores: enviadas pendentes, recebidas pendentes e mentorias ativas.
- No celular a barra de abas rola na horizontal e a aba ativa é centralizada automaticamente.
- Sem Supabase configurado, a página mostra um aviso amigável (sem quebrar).

## 2. Fluxo da mentoranda

```mermaid
flowchart TD
  A[/mentoria · Sugestões/] --> B{Quero ser mentorada?}
  B -- não --> C[Convite: ativar no /perfil + diretório]
  B -- sim --> F[Encontrar mentoras]
  F -. sem autorização de IA .-> E[Cartão compacto: Ativar sugestões com IA]
  E -- marca e envia --> F
  F --> G[Cartões: afinidade, por que ela, em comum, perguntas]
  G -- Pedir mentoria --> H[Diálogo: mensagem 20–1.500]
  H -- envia --> I[/Enviadas · Pedido enviado!/]
  I -- mentora aceita --> J[/Ativas: Conversar, e-mail, checklist/]
  J -- Conversar --> C2[/Conversa: mensagens, lida/enviada/]
  J -- Concluir --> K[Concluídas: conversa só leitura]
  I -- Cancelar pedido --> L[Encerradas]
```

1. **Convite** — se `seeks_mentorship = false`, a aba explica e leva para `/perfil` ("Ativar no
   meu perfil") ou para o diretório de mentoras.
2. **Sugestões sem IA (padrão)** — decisão final do produto: as sugestões **não dependem** do
   consentimento de IA. Sem `ai_consent`, o painel "Encontrar mentoras" funciona em modo
   heurístico (texto: "...usando as regras da própria plataforma. Nenhum dado seu vai para
   serviços de IA.") e nada sai do servidor.
3. **Ativar sugestões com IA** — também sem `ai_consent`, entre o botão e a lista aparece um
   cartão compacto (`AiConsentCard`): uma frase explicando que a IA é opcional e um `<details>`
   "Ver o que é enviado e autorizar" com o que a IA recebe e o que nunca sai daqui, o texto oficial
   (`src/lib/profile/consent.ts`, igual ao onboarding/perfil), a orientação para menores de 18 e o
   botão "Ativar sugestões com IA" (`grantAiConsentAction`). O consentimento só liga os
   embeddings (Gemini) e a reordenação/explicação por IA.
4. **Encontrar mentoras** — botão com estado "Analisando perfis…" (a lista anterior fica
   esmaecida; sem lista, aparecem esqueletos). Chama `findMentorsForCurrentUser({ limit: 6 })`.
   Mentoras com quem ela já está em mentoria (pedido aceito) não voltam como sugestão.
   Mensagem de resultado e avisos (ex.: "você acabou de gerar sugestões") aparecem em região
   `aria-live`. Ao carregar a página, as sugestões salvas são lidas sem gastar cota de IA.
5. **Cartão de sugestão** (`MatchCard`) — avatar, nome, título, instituição/UF, selos (Mentora,
   etapa, vagas abertas), `ScoreMeter` com nome acessível, caixa **"Por que ela?"** com o selo
   de origem ("Sugestão por IA (Gemini)" ou "Sugestão por afinidade") e aviso de texto gerado
   por IA, áreas e temas em comum, outros temas, perguntas para puxar conversa, "Pedir mentoria"
   e "Ver perfil".
   - Pedido pendente com ela → selo "Pedido enviado" + "Ver pedido".
   - Mentoria ativa com ela → selo "Mentoria ativa" + "Ver mentoria" (só em sugestões salvas
     antes do aceite: uma nova busca já não traz essa mentora).
   - Sem vagas ou pedidos pausados → botão desligado com o motivo escrito ao lado.
6. **Pedido** (`RequestMentorshipDialog`) — rascunho pronto com o primeiro nome da mentora, a
   primeira pergunta sugerida e trechos entre colchetes para personalizar (o servidor recusa o
   envio se eles continuarem lá); botões "Adicionar" para as outras perguntas; contador de
   caracteres; nota de privacidade (o e-mail só aparece se ela aceitar). Sucesso → redireciona
   para `?aba=enviadas&aviso=enviado`. Nota e motivo da sugestão salva (se houver) vão junto
   (`match_score`, `match_reason`), lidos no servidor.
7. **Link direto** — `/pesquisadoras/[id]` → "Pedir mentoria" → `/mentoria?mentora=<id>`. O
   diálogo abre sozinho. Casos tratados com alerta (sem diálogo): perfil inexistente, o próprio
   perfil, quem não é mentora, mentora sem vagas/pausada, pedido já aberto ou mentoria ativa.
   Um valor que não é UUID é ignorado.
8. **Enviadas** — "Em andamento" (pendentes e ativas) e "Encerradas", com selo de status, tempo
   relativo, a mensagem enviada (recolhível) e a resposta da mentora. Pendente → "Cancelar
   pedido" (confirmação); ativa → **"Conversar"** (com o número de mensagens não lidas) e "Ver
   mentoria ativa"; encerrada depois do aceite (concluída ou cancelada) → "Ver conversa".
9. **Ativas** — outra participante, papel ("Sua mentora"/"Sua mentoranda"), data de início,
   resposta da mentora, **contato** (`get_mentorship_contact`: e-mail com "Copiar" e `mailto:`),
   pedido original, **"Conversar"** (botão principal, com selo âmbar de não lidas), "Concluir
   mentoria" (as duas) e "Cancelar mentoria" (só a mentoranda), o checklist do primeiro encontro e
   a lista de mentorias concluídas (cada uma com "Ver conversa", só leitura).

## 3. Fluxo da mentora

1. **Sua disponibilidade** — selo "Recebendo pedidos"/"Pedidos pausados", medidor de vagas
   (`aceitas / mentor_capacity`), texto explicando se ela aparece nas sugestões, botão
   **"Pausar novos pedidos" / "Voltar a receber pedidos"** (`mentor_available`) e link para
   ajustar capacidade e temas no perfil.
2. **Aguardando sua resposta** — para cada pedido: mentoranda (etapa, instituição, áreas,
   temas em que quer ajuda), afinidade estimada, mensagem, campo de resposta opcional (até
   1.000 caracteres) e os botões **Aceitar mentoria** / **Recusar**. Com as vagas cheias aparece
   um alerta, e tentar aceitar mostra a mensagem do banco (`CD001`: "Você já atingiu o limite
   de N mentoria(s) simultânea(s)…"). Aceitar → `?aba=ativas&aviso=aceito`; recusar →
   `?aba=recebidas&aviso=recusado`.
3. **Pedidos já respondidos** — histórico compacto (até 20) com status e data da resposta; as
   mentorias aceitas têm "Conversar" (com as não lidas) e as encerradas depois do aceite, "Ver
   conversa".

Por que não mostramos `mentoring_goals` da mentoranda para a mentora: as metas de mentoria são
tratadas como dado interno do perfil ([03 §17](03-banco-de-dados.md#17-pegadinhas-e-boas-práticas)).
A mentora vê a mensagem que a mentoranda escreveu para ela, as áreas e os temas públicos.

## 4. Conversa da mentoria

Depois do aceite, mentora e mentoranda conversam em **`/mentoria/conversa/<id do pedido>`** — o
canal principal da dupla (o e-mail continua visível na aba Ativas). Só as duas participantes abrem
a página; nem a moderação lê ([09 §6](09-moderacao-e-seguranca.md#conversas-da-mentoria-são-privadas)).

```mermaid
sequenceDiagram
  actor L as Mentoranda
  participant DB as Postgres (RLS + triggers)
  actor M as Mentora
  L->>DB: insert mentorship_messages (sendMessageAction)
  DB-->>DB: participante? aceita? até 60/h? (CD015/CD027/CD026)
  DB-->>M: aviso "Nova mensagem de Larissa" (um não lido por conversa)
  M->>DB: abre a conversa (página visível) → read_at (markConversationReadAction)
  Note over L: a cada 15 s (aba visível) a página se atualiza: "Enviada" vira "Lida"
```

**Acesso.** O `layout.tsx` da rota confere sessão + onboarding (`requireOnboardedProfile`) e lê o
pedido com o cliente da sessão: pedido de outra dupla e pedido inexistente dão o mesmo resultado
(RLS) e a resposta é um **404 de verdade** (status HTTP), decidido antes de a página começar a ser
enviada — por isso a checagem fica no layout, fora do `loading.tsx` da conversa, e a página
`/mentoria` mora no grupo `(painel)` (o `loading.tsx` dela não envolve a conversa). Id que não é
UUID também é 404. A leitura (`getConversation`, com `cache` do React) é reaproveitada pelos
metadados ("Conversa com Marina" / "Conversa não encontrada") e pela página.

**Tela** (Server Component + três pedaços de cliente):

- **Cabeçalho** — avatar, nome (link para o perfil), título e instituição da outra participante,
  selo do papel dela (**Mentora**/**Mentoranda**), selo do status da mentoria, "Mentoria desde
  <data do aceite>" e "Denunciar perfil" (fluxo normal de denúncia, alvo `profile`). No desktop, ao
  lado: o pedido original e (mentoria ativa) o checklist do primeiro encontro.
- **Mensagens** (`MessageList`) — agrupadas por dia no fuso de São Paulo ("Hoje", "Ontem",
  "segunda-feira, 26 de outubro"); as dela à direita em `primary-soft`, as da outra à esquerda em
  `surface-2`; quebras de linha preservadas; horário relativo ("há 5 minutos", data completa no
  `title`); nas dela, **"Enviada"/"Lida"** com ícone (um ou dois tiques) e texto. Área rolável
  (`ConversationScroller`, `role="log"` + `aria-relevant="additions"`: o leitor de tela anuncia só
  as mensagens que chegam) que abre no fim e desce sozinha quando chega mensagem nova, se a pessoa
  estava perto do fim ou se a mensagem é dela. Mostra as 300 mais recentes.
- **Vazia** — "Comecem a conversa", com um texto para cada papel e **sugestões para começar**
  ("Combinar o primeiro encontro", "Escolher o formato", "Contar sobre a pesquisa"/"Perguntar o
  objetivo") que preenchem o campo para ela editar.
- **Campo de envio** (`MessageComposer`, só com a mentoria aceita) — `Textarea` com contador
  (2.000), **Enter envia** e **Shift+Enter** quebra a linha (no celular, onde não há Shift, Enter
  quebra a linha e o botão envia; Ctrl/Cmd+Enter também envia; Enter durante a composição de um
  acento não envia), `SubmitButton` "Enviar" ("Enviando…"), erros acima do campo numa região
  `aria-live` (inclusive os `CD…` do banco, em pt-BR) com o texto devolvido ao campo, e "Mensagem
  enviada." anunciada só para leitor de tela. As quebras de linha que o navegador envia como CRLF
  viram LF antes de contar os caracteres.
- **Só leitura** — mentoria concluída ou cancelada (depois do aceite): aviso "Mentoria concluída" /
  "Mentoria cancelada" ("a conversa fica guardada aqui só para leitura"), sem campo de envio e sem
  atualização automática. Pedido pendente, recusado ou cancelado antes do aceite ("Pedido
  cancelado"): aviso de que a conversa não abriu (`hasConversation` decide).
- **Atualização** (`ConversationLive`, não desenha nada) — com a mentoria aceita, `router.refresh()`
  a cada 15 s **só com a aba visível** (pausa com `visibilitychange`; ao voltar, atualiza na hora);
  o texto que está sendo digitado e a rolagem continuam. Quando há mensagem não lida da outra
  participante **e a aba está visível**, chama `markConversationReadAction` — marcar na renderização
  do servidor contaria pré-busca de link ou aba em segundo plano como leitura. Se a marcação falhar
  (rede, sessão), tenta de novo a cada 15 s e ao voltar para a aba; se chegar outra mensagem
  enquanto uma marcação está no ar, marca de novo quando ela termina.

**Server Actions** (`src/app/mentoria/actions.ts`):

| Action                       | Entrada                        | O que faz                                                                                                                                                                               | Retorno                                     |
| ---------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `sendMessageAction`          | `request_id`, `body` (1–2.000) | confere sessão + onboarding, valida (`messageSchema`), insere em `mentorship_messages` (o banco põe `sender_id` e a data e confere participante, status e limite) e revalida a conversa | `{ ok, message, nonce }` ou erro + `values` |
| `markConversationReadAction` | id do pedido (argumento)       | `read_at` nas mensagens recebidas não lidas da conversa e nos avisos `mentorship_message` dela com o link da conversa; se algo mudou, `revalidatePath("/", "layout")` (sino e selos)    | `{ ok, marked }`                            |

**Banco** (migration `20261028181500_mentorship_messages.sql`, detalhes em
[03](03-banco-de-dados.md#mentoria)): `mentorship_messages` com RLS (só participantes leem; envio
só em nome próprio e com o pedido `accepted`; só a destinatária altera `read_at`, que vale uma vez e
com a hora do servidor; ninguém apaga), limite de **60 mensagens por hora** por pessoa (`CD026`),
conversa encerrada `CD027`, conversa alheia ou inexistente `CD015`, autoria falsa `CD013`. Aviso
`mentorship_message` para a outra participante, **agrupado**: enquanto ela tiver um aviso não lido
daquela conversa, mensagens novas não criam outro (o link `/mentoria/conversa/<id>` identifica a
conversa); abrir a conversa marca o aviso como lido, e a próxima mensagem avisa de novo.

**Selos de não lidas** — `/mentoria` conta, numa consulta só, as mensagens recebidas e não lidas
das conversas da usuária (`loadUnreadCounts`) e mostra o número no "Conversar" (texto para leitor
de tela: "(2 mensagens não lidas)").

**LGPD** — o "Baixar meus dados" traz `mentoria.conversas` (as conversas com mensagens: o papel
dela, `{ id, full_name }` da outra participante e as mensagens trocadas, com `sender_id`, texto,
data e leitura). Excluir a conta de qualquer uma das duas apaga o pedido e a conversa inteira (para
as duas) e os avisos daquela conversa que ficaram com a outra participante.

## 5. Server Actions (`src/app/mentoria/actions.ts`)

Todas: conferem sessão + onboarding no servidor (`getCurrentUser`/`getCurrentProfile`), validam
com zod (`src/lib/mentorship/schemas.ts`), nunca recebem id de usuária do formulário, usam o
cliente com a sessão (RLS) e chamam `revalidatePath("/mentoria")`. Erros voltam no formato
`{ ok: false, error, fieldErrors?, values? }` (os valores digitados voltam para o formulário).
As duas actions da conversa (`sendMessageAction`, `markConversationReadAction`) estão na
[seção 4](#4-conversa-da-mentoria).

| Action                     | Quem                 | Entrada                                       | O que faz                                                                                                              | Sucesso                                      |
| -------------------------- | -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `findMentorsAction`        | quem busca mentoria  | —                                             | `findMentorsForCurrentUser({ limit: 6 })` (grava `mentor_suggestions`); sem `ai_consent` = só heurística               | `{ ok, count, source, warnings }`            |
| `grantAiConsentAction`     | membro               | `ai_consent=on`                               | `profiles.update({ ai_consent: true })` (o trigger grava a data) + `refreshMyEmbedding()`                              | → `?aba=sugestoes&aviso=consentimento`       |
| `createRequestAction`      | membro               | `mentor_id`, `message` (20–1.500)             | confere vagas/pedido aberto pela RPC `get_mentor_candidates`; insere `mentorship_requests` com nota/motivo da sugestão | → `?aba=enviadas&aviso=enviado`              |
| `cancelRequestAction`      | mentoranda do pedido | `request_id`                                  | `status → cancelled` (só `pending`/`accepted`, `mentee_id = eu`)                                                       | → `?aba=enviadas&aviso=cancelado`            |
| `respondRequestAction`     | mentora do pedido    | `request_id`, `decision`, `response_message?` | `status → accepted/declined` + resposta (só `pending`, `mentor_id = eu`); capacidade garantida pelo trigger (`CD001`)  | → ativas (`aceito`) / recebidas (`recusado`) |
| `completeMentorshipAction` | participantes        | `request_id`                                  | `status → completed` (só `accepted`)                                                                                   | → `?aba=ativas&aviso=concluido`              |
| `setAvailabilityAction`    | mentora              | `available=true/false`                        | `profiles.update({ mentor_available })`                                                                                | mensagem no próprio formulário               |

Os updates usam `.select("id")`: se nenhuma linha mudou (pedido já respondido, de outra pessoa
ou forjado), a usuária vê "Este pedido já foi respondido ou cancelado… Recarregue a página." e
nada é gravado. Notificações (novo pedido, aceite, recusa, cancelamento, conclusão) são criadas
pelos triggers do banco.

**Avisos (`?aviso=`)** — `enviado`, `cancelado`, `aceito`, `recusado`, `concluido`,
`consentimento` (`parseNotice`). Qualquer outro valor é ignorado: nenhum texto da URL é exibido.

**Erros** (`friendlyMentorshipError`): `CDxxx` → a mensagem pt-BR do banco; `23505` → pedido
duplicado; `23514` → tamanho da mensagem; `42501` → mentora sem receber pedidos / sem
permissão; `PGRST301/303` → sessão expirada; o resto → mensagem genérica por operação.

## 6. Leitura de dados (`src/lib/mentorship/queries.ts`, servidor)

| Função                                                             | Fonte                                                                                                               | Uso                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `loadMyRequests`                                                   | `mentorship_requests` + `mentee:profiles!mentorship_requests_mentee_id_fkey(...)` / `mentor:...mentor_id_fkey(...)` | todas as abas (contadores e listas)                                                      |
| `loadAreaIdsByProfile`                                             | `profile_research_areas`                                                                                            | áreas da outra participante e da mentoranda                                              |
| `loadAreaNames`                                                    | `research_areas`                                                                                                    | nomes das áreas                                                                          |
| `getMySavedSuggestions`                                            | `mentor_suggestions` (de `src/lib/matching/service.ts`)                                                             | sugestões salvas, sem IA                                                                 |
| `loadCandidateAvailability`                                        | RPC `get_mentor_candidates(p_limit: 100)`                                                                           | vagas abertas e pedido aberto por mentora                                                |
| `loadContacts`                                                     | RPC `get_mentorship_contact(p_request_id)`                                                                          | e-mail na aba Ativas (só mentorias aceitas)                                              |
| `loadDeepLinkMentor`                                               | `profiles` (colunas públicas explícitas)                                                                            | link direto `?mentora=`                                                                  |
| `loadSuggestionMatch`                                              | `mentor_suggestions` (nota e motivo da dupla)                                                                       | gravados junto com o pedido                                                              |
| `loadConversation` / `getConversation` (`conversation-queries.ts`) | `mentorship_requests` (+ perfis) e `mentorship_messages` (300 mais recentes)                                        | conversa (`getConversation` = mesma leitura, com `cache`, no layout, metadados e página) |
| `loadUnreadCounts` (`conversation-queries.ts`)                     | `mentorship_messages` recebidas com `read_at` nulo, por pedido                                                      | selos de não lidas em "Conversar"                                                        |

Perfis sempre com colunas explícitas (nunca `select('*')`). A montagem dos cartões é pura
(`buildMatchCards`, `resolveDeepLink` em `view-models.ts`): a mentora fora da lista de
disponíveis aparece sem botão de pedido; se a RPC falhar, o botão fica ligado e o banco decide.

## 7. Arquivos

```
src/app/mentoria/
  (painel)/page.tsx           abas, contadores, avisos, link direto, selos de não lidas
  (painel)/loading.tsx        esqueleto da página (só do painel: não envolve a conversa)
  (painel)/_sections/suggestions-tab.tsx   convite · consentimento · sugestões · link direto
  (painel)/_sections/request-tabs.tsx      Enviadas · Recebidas · Ativas
  actions.ts                  Server Actions (tabelas acima), inclusive as da conversa
  conversa/[id]/layout.tsx    checagem de acesso (404 de verdade) + metadados
  conversa/[id]/page.tsx      conversa: cabeçalho, mensagens, campo de envio
  conversa/[id]/loading.tsx   esqueleto da conversa
  conversa/not-found.tsx      "Não encontramos esta conversa"
src/components/mentorship/
  match-card.tsx              cartão de sugestão
  request-dialog.tsx          diálogo "Pedir mentoria" (cliente)
  find-mentors-panel.tsx      botão "Encontrar mentoras" + carregamento (cliente)
  ai-consent-card.tsx         cartão compacto "Ativar sugestões com IA" (cliente)
  deep-link-card.tsx          pedido por link direto + alertas
  request-cards.tsx           cartões de enviadas, recebidas, ativas e histórico
  respond-form.tsx            aceitar/recusar com resposta (cliente)
  availability-form.tsx       pausar/retomar pedidos (cliente)
  contact-card.tsx            e-mail com copiar/mailto (cliente)
  action-dialog.tsx           confirmação com erro dentro do diálogo (cliente)
  first-meeting-checklist.tsx · person-summary.tsx · status-badge.tsx · scroll-active-tab.tsx
  conversation-link.tsx       "Conversar"/"Ver conversa" com selo de não lidas
  message-list.tsx            mensagens por dia, bolhas, recibo Enviada/Lida
  message-composer.tsx        campo de envio: Enter/Shift+Enter, contador, sugestões (cliente)
  conversation-scroller.tsx   área rolável role="log" que acompanha mensagens novas (cliente)
  conversation-live.tsx       atualização a cada 15 s com a aba visível + marcar como lidas (cliente)
src/lib/mentorship/
  presentation.ts             abas, status, selo IA/afinidade, rascunho, capacidade, avisos (puro)
  view-models.ts              cartões de sugestão e link direto (puro)
  schemas.ts                  zod das actions
  errors.ts                   erros do banco → pt-BR (puro)
  queries.ts                  leituras (server-only)
  conversation.ts             conversa: estado, dias, sugestões, não lidas, limites (puro)
  conversation-queries.ts     leitura da conversa e das não lidas (server-only)
  types.ts                    estados das actions
```

## 8. Como testar

**Unitários** (helpers puros: `presentation`, `view-models`, `schemas`, `errors` e
`conversation`):

```bash
npx vitest run src/lib/mentorship
```

**Banco** (`supabase/tests/database/mentorship_messages.test.sql`, `npx supabase test db`): quem
está de fora (inclusive a moderação) não lê nem escreve; só com a mentoria aceita; autoria falsa;
recibo só pela destinatária, sem editar o texto nem desfazer a leitura; sem DELETE; limite de 60/h;
aviso agrupado; exclusão de conta em cascata.

**Manual / E2E** com o Supabase local e o seed (senha de todas: `ciencia-delas-demo`; e-mails
`@demo.cienciadelas.dev`). Para entrar sem a tela de login em testes Playwright, use
`node scripts/e2e/auth-cookies.mjs <email> ciencia-delas-demo http://localhost:<porta>`.

| Conta       | O que testar                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yasmin@`   | "Encontrar mentoras" (a Camila aparece com "Pedido enviado"); enviar um pedido; erro ao enviar o rascunho sem personalizar ou com menos de 20 caracteres                                          |
| `renata@`   | mentora com **1 vaga**: aceitar um pedido e tentar aceitar outro → erro `CD001`; recusar com resposta; pausar e retomar                                                                           |
| `fernanda@` | pedido pendente da Manuela em "Solicitações recebidas"; aba Sugestões mostra o convite (ela não busca mentoria)                                                                                   |
| `larissa@`  | "Mentorias ativas" com a Marina (contato, checklist, "Conversar"); "Encontrar mentoras" não traz a Marina; links diretos: `?mentora=<Marina>` (já em mentoria), `?mentora=<Aline>` (indisponível) |
| `debora@`   | mentoria concluída com a Patrícia: "Ver conversa" abre a conversa só para leitura                                                                                                                 |
| `gabriela@` | abrir `/mentoria/conversa/c1000000-0000-4000-8000-000000000001` (conversa da Larissa com a Marina) → 404                                                                                          |
| `marina@`   | mentora com 3 vagas e uma mentoria ativa; histórico de respostas; conversa com a Larissa (abra as duas contas em janelas diferentes: a mensagem chega em até 15 s e vira "Lida")                  |
| visitante   | `/mentoria` → `/entrar?next=%2Fmentoria`                                                                                                                                                          |

Para ver o cartão "Ativar sugestões com IA", desmarque a autorização em `/perfil` (seção
Privacidade) ou, localmente, `update profiles set ai_consent = false where id = '<id>'` e depois
volte para `true`. Sem autorização, "Encontrar mentoras" continua funcionando (selo "Sugestão por
afinidade").
Ao testar, prefixe mensagens com `[teste]` e limpe depois:

```sql
delete from mentorship_requests where message like '[teste]%';   -- leva as conversas junto
delete from mentor_suggestions where mentee_id = '<id da conta de teste>';
delete from mentorship_messages where request_id = '<id do pedido>' and body like '[teste]%';
delete from private.rate_limit_events where action = 'mentorship_message';  -- zera o limite de 60/h
```

A **jornada E2E** (`scripts/e2e/journey.mjs`, também no CI) cobre o caminho principal da conversa a cada
execução: larissa@ abre "Conversar" na aba Ativas e envia com Enter ("Enviada"); marina@ abre pelo aviso "Nova
mensagem de Larissa…", a mensagem vira lida no banco e ela responde; a página da larissa@, aberta, mostra a
resposta sozinha (atualização de 15 s) com o recibo "Lida"; gabriela@ recebe HTTP 404 sem o texto da conversa.
As telas da conversa (larissa@ e marina@) entram na varredura claro/escuro × 1440/390 px. As mensagens e os
avisos criados pelo teste são apagados no fim.

O que foi verificado na entrega da conversa (Playwright contra um build de produção e o Supabase
local, larissa ↔ marina e uma mentoria temporária gabriela ↔ patrícia criada e apagada pelo
roteiro): botão "Conversar" → conversa vazia com sugestões; sugestão + Enter envia; Shift+Enter
quebra a linha; erro de campo vazio; um único aviso para a Marina com duas mensagens; selo "2 não
lidas"; abrir pelo aviso marca como lidas; "Enviada" vira "Lida" na tela da Larissa sem recarregar;
a resposta chega sozinha e é marcada como lida; com a aba escondida nada atualiza nem é marcado, e
ao voltar atualiza na hora; outra membra e a moderação recebem 404 (HTTP); visitante vai para
`/entrar`; conclusão pela mentora → a página antiga recebe `CD027` em pt-BR com o texto de volta no
campo, e ao recarregar fica só leitura; "Ver conversa" na lista de concluídas; `axe-core` sem
violações; 390 e 1440 px, claro e escuro, sem rolagem horizontal.

O que foi verificado na entrega: todas as abas com mentoranda, mentora e visitante; envio,
cancelamento, aceite, recusa, capacidade cheia, pausa/retomada, conclusão, consentimento e links
diretos; formulário forjado (mentora tentando responder pedido de outra → nada muda no banco);
390 px e 1440 px, claro e escuro, sem rolagem horizontal; `axe-core` (WCAG 2.2 AA) sem
violações; sem erros de console nem de hidratação.

## 9. Limitações conhecidas

- **Sessão expirada no meio da página:** o proxy redireciona o POST da Server Action para
  `/entrar`, e o React mostra a tela de erro ("Algo saiu da órbita") em vez da mensagem amigável
  da action. Nada é gravado. Correção sugerida no `src/lib/supabase/proxy.ts`: não redirecionar
  requisições com o cabeçalho `Next-Action` (as actions já verificam a sessão).
- A RPC `get_mentor_candidates` não devolve mentoras sem vagas, então a mentoranda não vê
  "0 vagas": vê "sem vagas ou pausou novos pedidos".
- Sem chaves de IA, sem autorização da usuária (ou com a IA fora do ar) as sugestões usam só a
  heurística e o selo diz "Sugestão por afinidade"; o restante do fluxo é idêntico.
- **Conversa:** atualização por consulta a cada 15 s (não é Realtime); não há anexos, edição nem
  exclusão de mensagens; a página carrega as 300 mensagens mais recentes; denunciar uma mensagem
  específica ainda não existe — por enquanto, "Denunciar perfil" com o trecho nos detalhes
  ([09 §14](09-moderacao-e-seguranca.md#14-limitações-conhecidas-e-próximos-passos)).
