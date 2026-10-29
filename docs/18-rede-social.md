# 18 · Rede social: feed, rede, portfólio, ICs e mensagens

> O retorno da banca/equipe: "o site está bonito, mas falta o cerne da interação entre as usuárias,
> igual ao LinkedIn". Até aqui só dava para conversar dentro de uma mentoria aceita e não havia onde
> contar o dia a dia da pesquisa. Esta etapa acrescenta cinco áreas que se alimentam umas das outras:
>
> - **Feed** (`/feed`): publicações curtas sobre trabalhos, projetos e conquistas, com curtidas e
>   comentários; abas "Todas" e "Seguindo".
> - **Rede** (`/rede`): conectar-se (convite aceito pelas duas) e seguir (de um lado só), com
>   sugestões de pessoas.
> - **Portfólio** (`/portfolio` e no perfil): artigos, projetos, apresentações, prêmios… de cada uma.
> - **Explorar ICs** (`/ics`): pesquisadoras publicam vagas de iniciação científica e estudantes se
>   candidatam pela plataforma.
> - **Mensagens** (`/mensagens`): conversa direta entre quaisquer duas membras, com pedido de
>   mensagem para quem ainda não é conexão.

**Hospedagem:** nada novo. Tudo é Postgres + RLS no mesmo Supabase; as mensagens chegam pelo
**Realtime** do Supabase (incluído no plano gratuito, respeita o RLS) e, se ele cair, por uma
atualização periódica da página. Nenhum servidor de WebSocket próprio.

---

## 1. Rotas

| Rota                     | Quem                     | O quê                                                                                                  |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `/feed`                  | membra                   | Caixa de publicação + publicações (`?aba=todas` padrão, `?aba=seguindo`), 20 por vez (`?antes=<iso>`). |
| `/feed/p/[id]`           | membra                   | Uma publicação com todos os comentários. Oculta/apagada → 404.                                         |
| `/rede`                  | membra                   | Abas `convites` (recebidos e enviados), `conexoes`, `seguindo`, `seguidoras`, `sugestoes` (padrão).    |
| `/portfolio`             | membra                   | O próprio portfólio: adicionar, editar, destacar e apagar itens.                                       |
| `/pesquisadoras/[id]`    | membra                   | (já existia) + botões Conectar / Seguir / Mensagem, números da rede, portfólio e publicações recentes. |
| `/ics`                   | membra                   | Explorar oportunidades: busca, filtros (área, tipo, bolsa, modalidade, etapa), só abertas por padrão.  |
| `/ics/[id]`              | membra                   | Detalhe; candidatar-se (carta de apresentação) ou ver o andamento da própria candidatura.              |
| `/ics/nova`              | pesquisadora (mestrado+) | Publicar oportunidade (com opção de compartilhar no feed).                                             |
| `/ics/[id]/editar`       | dona da vaga             | Editar, encerrar ou reabrir.                                                                           |
| `/ics/[id]/candidaturas` | dona da vaga             | Candidaturas recebidas: em análise, aprovar, não aprovar (com recado opcional).                        |
| `/ics/minhas`            | membra                   | `?aba=candidaturas` (as minhas) e `?aba=publicadas` (as vagas que publiquei).                          |
| `/mensagens`             | membra                   | Caixa de entrada (`?aba=conversas` padrão, `?aba=pedidos`).                                            |
| `/mensagens/[id]`        | as duas participantes    | A conversa, ao vivo. Outras pessoas → 404.                                                             |

Todas entram em `PROTECTED_PREFIXES` (`/feed`, `/rede`, `/portfolio`, `/ics`, `/mensagens`).

## 2. Banco (migrations `20261029000000` a `20261029000500`)

Convenções de sempre (docs/03): RLS em tudo, `revoke all` + `grant` por coluna, funções
`security definer` com `search_path = ''`, horários do servidor (o cliente não antedata nada),
anti-spam em `private.rate_limit_events` via `private.enforce_rate_limit`, notificações criadas por
triggers e **agrupadas** (enquanto houver um aviso não lido do mesmo tipo e link, não cria outro).

### 2.1 Rede — `follows`, `connections`

```text
follows (follower_id uuid default auth.uid(), followee_id uuid, created_at)  PK (follower_id, followee_id)
connections (id uuid, requester_id uuid default auth.uid(), addressee_id uuid,
             status connection_status ('pending'|'accepted'|'declined') default 'pending',
             message text ≤ 300, created_at, responded_at)
             único por par (em qualquer direção)
```

- **Seguir:** qualquer membra segue qualquer membra com cadastro completo; deixa de seguir apagando a
  linha. Todas as membras veem quem segue quem (números do perfil). Aviso `new_follower` → link
  `/pesquisadoras/<quem seguiu>`.
- **Conectar:** convite (`pending`) com recado opcional. Só quem **recebeu** aceita ou recusa
  (`update status`). Aceitar cria o "seguir" nos dois sentidos. Se a outra pessoa já tinha mandado um
  convite pendente, mandar um de volta **aceita** o dela. Convite recusado não pode ser refeito por
  quem convidou (só quem recusou pode apagar ou aceitar depois). Quem convidou vê convite recusado
  como "pendente" (a interface não conta que foi recusado). Apagar uma conexão aceita: qualquer uma
  das duas. Avisos: `connection_request` → link `/pesquisadoras/<quem convidou>`;
  `connection_accepted` → link `/pesquisadoras/<quem aceitou>`.
- Conexões **aceitas** são visíveis a todas as membras; pendentes e recusadas, só às duas.
- RPC `get_connection_suggestions(p_limit int default 8)` → `id, full_name, avatar_url, headline,
institution, career_stage, shared_areas int, mutual_connections int, same_institution bool` (sem
  quem já tem convite/conexão comigo e sem eu mesma; ordem: pontuação desc).
- RPC `get_network_counts(p_profile_id uuid)` → `followers int, following int, connections int`.

### 2.2 Portfólio — `portfolio_items`

```text
portfolio_items (id, owner_id default auth.uid(), kind portfolio_kind, title 3–200, description ≤ 2000,
                 url http(s) ≤ 500, venue ≤ 160, year 1950–2100, tags text[] ≤ 8 × 40 (normalizadas),
                 pinned bool default false, created_at, updated_at)
portfolio_kind: article | project | presentation | poster | thesis | award | course | other
```

Todas as membras leem; só a dona cria, edita e apaga. Até 50 itens por pessoa (`CD066`) e 20 por hora.

### 2.3 ICs — `research_opportunities`, `opportunity_applications`

```text
research_opportunities (id, owner_id default auth.uid(), kind opportunity_kind default 'ic',
  title 5–160, description 30–4000, requirements ≤ 2000, area_id → research_areas (null ok),
  keywords text[] ≤ 10 × 40, institution ≤ 160, city ≤ 80, state UF,
  modality meeting_format default 'in_person', has_scholarship bool, scholarship_info ≤ 160,
  weekly_hours 1–40 (null ok), vacancies 1–20 default 1,
  target_stages career_stage[] (1–8, default {undergraduate}), deadline date (null ok),
  status opportunity_status ('open'|'closed') default 'open', application_count int (trigger),
  search_text (gerada), created_at, updated_at, closed_at)
opportunity_kind: ic | ic_junior | tcc | extension | volunteer

opportunity_applications (id, opportunity_id, applicant_id default auth.uid(), message 30–2000,
  status application_status default 'submitted', owner_note ≤ 1000, created_at, updated_at,
  responded_at)  único (opportunity_id, applicant_id)
application_status: submitted | in_review | accepted | declined | withdrawn
```

- Publicar: só com `career_stage` em mestrado, doutorado, pós-doc, pesquisadora, docente ou indústria
  (`CD070`); 5 por dia. Todas as membras leem todas as vagas. A dona edita, encerra/reabre e apaga.
- Candidatar-se: vaga aberta e dentro do prazo (`CD071`), nunca na própria (`CD072`), uma vez por
  vaga (`CD073`), 10 por dia. A candidata vê só as dela; a dona da vaga vê as da vaga.
- Mudanças de status (`CD074` se inválida): a dona leva `submitted|in_review` → `in_review`,
  `accepted` ou `declined` (e pode mudar de ideia entre essas três), com `owner_note`; a candidata
  só desiste (`withdrawn`) enquanto `submitted` ou `in_review`. `application_count` conta as não
  desistidas.
- Avisos: `opportunity_application` → dona, link `/ics/<id>/candidaturas`;
  `application_update` → candidata (em análise, aprovada, não aprovada), link `/ics/<id>`.
- Candidatura aprovada abre conversa direta já aceita (ver 2.5).

### 2.4 Feed — `posts`, `post_likes`, `post_comments`

```text
posts (id, author_id default auth.uid(), kind post_kind default 'update', body 1–3000,
       link_url http(s) ≤ 500, portfolio_item_id → portfolio_items (set null),
       opportunity_id → research_opportunities (set null), like_count int, comment_count int,
       created_at, updated_at)
post_kind: update | project | achievement | publication | event
post_likes (post_id, user_id default auth.uid(), created_at)  PK (post_id, user_id)
post_comments (id, post_id, author_id default auth.uid(), body 1–1500, created_at, updated_at)
```

- Todas as membras leem. A autora edita `kind`, `body`, `link_url` e apaga; anexos só do que é dela
  (item do próprio portfólio, vaga que ela publicou — `CD080`). 20 publicações/hora (`CD081`).
- Curtir/descurtir: uma por pessoa. Contadores mantidos por trigger (ninguém grava neles).
- Comentários: 30/hora (`CD082`); a autora do comentário edita e apaga; a autora da publicação também
  apaga comentários na publicação dela.
- Avisos: `post_like` e `post_comment` → autora da publicação, link `/feed/p/<id>`.
- A moderação apaga publicações e comentários (denúncia → `/admin`, registrado no Registro).

### 2.5 Mensagens — `direct_conversations`, `direct_messages`

```text
direct_conversations (id, user_a, user_b (user_a < user_b), initiator_id,
  status conversation_status ('request'|'active'|'declined'),
  user_a_read_at, user_b_read_at, last_message_at, last_message_preview ≤ 140, last_sender_id,
  created_at)  único (user_a, user_b)
direct_messages (id, conversation_id, sender_id default auth.uid(), body 1–2000, created_at)
```

- Ninguém insere conversa direto: `start_direct_conversation(p_other uuid) returns uuid` acha ou cria
  a do par. Nasce `active` se as duas são conexões, têm mentoria aceita/concluída ou candidatura
  aprovada entre si; senão `request`. 20 conversas novas por dia (`CD089`).
- **Pedido de mensagem:** enquanto a conversa é `request`, quem começou manda **uma** mensagem e
  espera (`CD086`). Quem recebeu aceita respondendo (ou pelo botão Aceitar) ou recusa; recusada,
  quem começou não manda mais nada e continua vendo "aguardando" (o mesmo `CD086`: a recusa nunca é
  revelada). `respond_conversation_request(p_conversation_id uuid,
p_accept boolean)`.
- **Proteção de estudantes do ensino médio** (podem ter menos de 18 anos): quem tem
  `career_stage = 'high_school'` só recebe mensagem de conexões (`CD084` para as demais).
- 60 mensagens por hora (`CD088`). Mensagens não são editadas nem apagadas (como na mentoria).
- `mark_conversation_read(p_conversation_id uuid)` grava a leitura de quem chamou.
- `list_my_conversations()` → `id, status, initiator_id, last_message_at, last_message_preview,
last_sender_id, unread bool, other_id, other_name, other_avatar_url, other_headline,
other_career_stage, created_at` (mais recentes primeiro).
- `count_unread_conversations() returns int` (sininho de mensagens do cabeçalho).
- Aviso `direct_message` → link `/mensagens/<id>` (agrupado por conversa).
- Realtime: `direct_messages` e `direct_conversations` estão na publicação `supabase_realtime`.

### 2.6 Códigos de erro novos

| Código | Quando                                                                     |
| ------ | -------------------------------------------------------------------------- |
| CD060  | Perfil não encontrado ou sem cadastro completo (seguir, conectar, DM)      |
| CD061  | Já existe convite ou conexão entre as duas                                 |
| CD062  | Só quem recebeu o convite responde; convite recusado não volta a ser feito |
| CD063  | Muitos "seguir" na última hora (100/h)                                     |
| CD064  | Muitos convites de conexão no dia (30/dia)                                 |
| CD065  | Não dá para seguir, conectar ou conversar consigo mesma                    |
| CD066  | Portfólio cheio (50 itens)                                                 |
| CD067  | Muitos itens de portfólio na última hora (20/h)                            |
| CD070  | Só pesquisadoras (mestrado em diante) publicam oportunidades               |
| CD071  | Vaga encerrada ou fora do prazo                                            |
| CD072  | Candidatura na própria vaga                                                |
| CD073  | Já se candidatou a esta vaga                                               |
| CD074  | Mudança de status de candidatura não permitida                             |
| CD075  | Muitas vagas publicadas no dia (5/dia)                                     |
| CD076  | Muitas candidaturas no dia (10/dia)                                        |
| CD080  | Anexo que não é seu                                                        |
| CD081  | Muitas publicações na última hora (20/h)                                   |
| CD082  | Muitos comentários na última hora (30/h)                                   |
| CD083  | Publicação não encontrada                                                  |
| CD084  | Estudante do ensino médio só recebe mensagens de conexões                  |
| CD085  | Conversa não encontrada                                                    |
| CD086  | Pedido de mensagem: espere a resposta para mandar outra                    |
| CD088  | Muitas mensagens na última hora (60/h)                                     |
| CD089  | Muitas conversas novas no dia (20/dia)                                     |

Erros de unicidade (`23505`) viram as mensagens de `CD061`/`CD073` no app.

### 2.7 Moderação

`report_target` ganha `feed_post`, `feed_comment` e `opportunity`. O `<ReportButton />` aparece em
publicações, comentários e vagas; `/admin` mostra e apaga esses alvos (`moderate_delete_content`),
com registro no Registro de moderação. Conversas diretas são privadas: denuncia-se o **perfil**.

## 3. Interface (onde mora cada coisa)

| Área      | Lógica e consultas      | Componentes                    | Rotas               |
| --------- | ----------------------- | ------------------------------ | ------------------- |
| Feed      | `src/lib/feed`          | `src/components/feed`          | `src/app/feed`      |
| Rede      | `src/lib/network`       | `src/components/network`       | `src/app/rede`      |
| Portfólio | `src/lib/portfolio`     | `src/components/portfolio`     | `src/app/portfolio` |
| ICs       | `src/lib/opportunities` | `src/components/opportunities` | `src/app/ics`       |
| Mensagens | `src/lib/messages`      | `src/components/messages`      | `src/app/mensagens` |

- **Cabeçalho:** Feed, Rede, ICs, Mentoria e Fórum na barra; o resto em "Mais" (no celular, a lista
  inteira). Ícone de mensagens com o número de conversas com mensagem nova
  (`count_unread_conversations`); Meu portfólio e Mensagens no menu da conta.
- **Perfil (`/pesquisadoras/[id]`):** `ProfileNetwork` (números, Conectar, Seguir) com o
  `MessageButton`, `PortfolioSection` e "No feed" (`RecentPosts`).
- **Painel:** bloco "Na sua rede" (`src/components/painel/network-card.tsx`) com conversas novas,
  convites para responder e candidaturas novas nas vagas dela, e o atalho para o feed.
- **Ao vivo:** a conversa e a caixa de entrada assinam o Realtime do Supabase e chamam
  `router.refresh()`; a atualização periódica fica como rede de segurança (5 s sem Realtime, 20 s
  com ele; 30 s na caixa de entrada). As assinaturas não usam filtro no servidor: o canal abre antes
  de o navegador ter a sessão e o Realtime recusa filtros com o papel `anon`
  (`subscription_check_filters`); o RLS já limita os eventos às conversas dela e o filtro por
  conversa é feito no navegador.

## 4. LGPD

- **Portabilidade:** "Baixar meus dados" tem a seção `rede_social` (seguindo, seguidoras, conexões,
  portfólio, publicações, curtidas, comentários, vagas publicadas, candidaturas enviadas e recebidas e
  mensagens diretas), com as outras pessoas reduzidas a id e nome
  ([11](11-perfis-e-autenticacao.md)). Convites e pedidos de mensagem que ela enviou e foram
  recusados saem como pendentes, como nas telas.
- **Exclusão da conta:** tudo sai em cascata pelas FKs (seguir, conexões, itens, vagas e
  candidaturas, publicações, curtidas, comentários, conversas e mensagens); os avisos de outras pessoas
  que apontam para o perfil, as publicações, as vagas ou as conversas apagadas também somem
  (triggers `*_after_delete`).
- **Mensagens diretas são privadas:** nem a moderação lê. Denuncia-se o perfil.
- **Estudantes do ensino médio** (podem ter menos de 18 anos) só recebem mensagem de quem tem vínculo
  com elas (`CD084`): conexão aceita, mentoria ou candidatura aprovada.

## 5. Testes

- **Banco:** `supabase/tests/database/rede_social.test.sql` (11 grupos: estrutura, seguir, conectar,
  recusa, RPCs, portfólio, vagas, candidaturas, feed, mensagens diretas, moderação). Como os outros,
  roda dentro de `begin … rollback`.
- **Sem Docker:** além de `scripts/db/validate-local.sh`, as migrations, os seeds e os testes foram
  validados num Postgres embutido (PGlite) e depois no próprio Supabase Cloud — os sete arquivos de
  `supabase/tests/database` passam lá (96 grupos). Na nuvem, o `rls.test.sql` só acusa a função
  `public.rls_auto_enable`, criada pelo próprio Supabase (ver [13](13-proximos-passos.md)).
- **Unidade (Vitest):** `src/lib/{feed,network,portfolio,opportunities,messages}/*.test.ts` e a
  exportação em `src/lib/profile/export*.test.ts`.

## 6. Como demonstrar (com o seed `supabase/seeds/50_rede_social.sql`)

1. Entre como **Larissa** em `/demo` → o selo de mensagens mostra 2; `/feed` traz 12 publicações com
   curtidas e comentários e as vagas de IC ao lado.
2. `/ics` → filtros por área, bolsa e etapa; a vaga da Marina mostra a candidatura **aprovada** dela,
   com o recado e o botão de mensagem.
3. `/rede?aba=convites` → convite da Juliana para aceitar (o "seguir" mútuo aparece na hora).
4. `/mensagens` → conversa nova da Marina e, em "Pedidos", o pedido de mensagem da Renata.
5. Troque para a **Marina**: `/ics/minhas?aba=publicadas` → candidatura da Yasmin para responder;
   `/mensagens?aba=pedidos` → pedido da Gabriela.

## 7. Limitações conhecidas

- Convite recusado: quem convidou não consegue apagá-lo (senão poderia convidar de novo em laço), e
  continua vendo "Convite enviado"; "Cancelar convite" nesse caso não muda nada.
- "Seguindo" no feed lê até 300 pessoas seguidas (os ids vão na URL da consulta); para redes maiores,
  uma RPC ou view.
- As sugestões de conexão incluem contas da equipe (coordenação e moderação), que também são membras.
