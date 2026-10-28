# Ártemis: Plano de Desenvolvimento Técnico e de Execução (MVP)

> **Documento para agentes de IA (Cursor, Copilot, v0.dev, Claude Code).**
> Leia este arquivo inteiro antes de gerar código. Ele é a fonte da verdade sobre escopo, stack, schema, rotas e prioridades do projeto.

---

## 0. Contexto e regras para agentes

### Projeto
- **Nome:** Ártemis
- **Evento:** Hackathon presencial, tema **"Ciência Delas" (SNCT 2026)**
- **Prazo:** 3 dias (até sexta-feira pela manhã)
- **Metodologia:** Vibe Coding (uso intensivo de IA para acelerar o código)
- **Equipe:** 4 pessoas (estudantes de Ciência da Computação e ADS)
- **Foco:** soluções inéditas com impacto social para promover o protagonismo de mulheres e meninas na ciência (STEM), com recorte para mulheres negras e trans
- **Público-alvo:** B2C (estudantes e cientistas/pesquisadoras)

### Ideia central
Ártemis é um ecossistema social e educacional para combater a evasão feminina em STEM, conectando alunas a oportunidades e redes de apoio. O sistema é aberto a todos os gêneros, mas as funcionalidades e a experiência são desenhadas para dar protagonismo às mulheres.

### Stack obrigatória
| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (strict) |
| Frontend | Next.js (App Router) + React |
| UI | Tailwind CSS + shadcn/ui + Lucide Icons |
| Temas | `next-themes` (Suporte nativo a Modo Claro e Modo Escuro) |
| Backend/Auth | Supabase (Auth, Postgres, Realtime, Edge Functions, Storage) |
| Hospedagem | Vercel |

### 0.1 Identidade Visual & Design System (Editorial & Acadêmica)
A interface adota a direção **Editorial & Acadêmica**, unindo autoridade e rigor científico ao calor e protagonismo da mulher em STEM, com **suporte completo a Tema Claro e Escuro**:

* **Tipografia:**
  - *Headings/Títulos:* **Plus Jakarta Sans** (geométrica, editorial, marcante).
  - *Corpo/Interface:* **Inter** (máxima legibilidade em listas, feeds, formulários e chat).

* **Paleta de Cores e Tokens:**
  - **Modo Claro (Light Mode):**
    - Fundo base: `#F8FAFC` (Slate 50 - clean e acolhedor)
    - Superfície / Cards: `#FFFFFF` (Borda: `#E2E8F0` Slate 200)
    - Texto principal: `#0B1120` (Navy Profundo para alto contraste)
    - Texto secundário/muted: `#64748B` (Slate 500)
    - Primária (Ação/Orquídea): `#8B5CF6` / `#7C3AED`
    - Secundária (Coral Científico): `#F43F5E`
    - Sucesso / Vagas abertas: `#059669` (Emerald)
  - **Modo Escuro (Dark Mode):**
    - Fundo base: `#0B1120` (Deep Academic Navy)
    - Superfície / Cards: `#131B2E` (Navy Meia-Noite - Borda: `#1E293B`)
    - Texto principal: `#F8FAFC` (Slate 50)
    - Texto secundário/muted: `#94A3B8` (Slate 400)
    - Primária (Orquídea Real Luminosa): `#A855F7`
    - Secundária (Coral Suave): `#FB7185`
    - Sucesso / Vagas abertas: `#10B981` (Emerald)

* **Emblema `<WomanBadge />` (Autodeclaração Feminina):**
  - *Light Mode:* `bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 ring-1 ring-fuchsia-300/60`
  - *Dark Mode:* `bg-fuchsia-950/40 text-fuchsia-200 border-fuchsia-500/30 ring-1 ring-fuchsia-400/40`
  - Acompanhado de ícone estelar/Vênus estilizado e micro-brilho, exibido ao lado do nome em posts, perfis, listas e chat.

### Regras que todo agente deve seguir
1. **TypeScript strict, sem `any`.** Use os tipos gerados pelo Supabase em `@/lib/types/database.ts` (`Database['public']['Tables']`).
2. **Server Components por padrão.** Páginas e listas fazem a query no servidor. Só o que tem interação (like, chat, formulários) vira `"use client"`.
3. **Mutations em Server Actions** (`"use server"`), com validação `zod`, `revalidatePath` e retorno tipado `{ ok: true } | { ok: false; error: string }`.
4. **Permissões validadas em dois lugares:** na Server Action **e** no banco (RLS). Nunca confie só na UI.
5. **Não crie colunas denormalizadas** para contadores. Use `select ..., post_likes(count)` do PostgREST.
6. **Respeite as etapas de prioridade** (seção 6). Não implemente itens da Etapa 3 antes de fechar as Etapas 1 e 2.
7. **Privacidade (LGPD):** a autodeclaração de gênero é dado pessoal sensível. Armazene apenas o boolean `is_self_declared_woman`. Não armazene a distinção cis/trans.
8. **Nunca exponha a `service_role` key** no client nem em variáveis `NEXT_PUBLIC_*`.
9. Interface em **português (pt-BR)**. Inclua skeletons de loading, estados vazios amigáveis e tratamento de erro.
10. **Suporte obrigatório a tema claro e escuro** via `next-themes` e variáveis CSS com tokens semânticos (`bg-background`, `text-foreground`, `bg-card`, etc).
11. **Imutabilidade e Continuidade de Migrations:** NUNCA altere ou edite uma migration SQL que já tenha sido executada. Toda e qualquer alteração de schema, trigger ou RLS DEVE ser criada em um novo arquivo sequencial (ex: `001_...`, `002_...`, `003_...`), garantindo continuidade estrita e rastreabilidade.

---

## 1. Requisitos do sistema

1. **Autenticação e Perfis:** login/cadastro (e-mail/senha). Dois tipos de conta: "Estudante" e "Cientista". Perfis com bio, avatar, curso/área. No cadastro, opção de autodeclaração **"Sou mulher (cis/trans)"**. Quem marcar recebe um **Emblema visual (Badge)** exclusivo no perfil.
2. **Feed (estilo Twitter):** postagens de texto e sistema de curtidas.
3. **Explorar (Match de IC):** criação de projetos de Iniciação Científica, busca e filtros. Botão **"Tenho Interesse"** (gera solicitação para o criador aceitar/recusar). O criador pode convidar usuários. Listagem de participantes no projeto.
4. **Conexões e Mensagens (DM):** "Seguir" e "Conectar" (requer aceite). Chat em tempo real (Supabase Realtime). Regra: se não houver conexão, a mensagem exige aprovação prévia do destinatário (estilo Instagram).
5. **Vitrine Científica:** postagens de trabalhos concluídos com carrossel de imagens opcional. Aba no perfil + link público.
6. **Notificações:** in-app e por e-mail.
7. **Trust & Safety:** aceite do código de conduta no cadastro. O sistema é aberto, mas o selo de autodeclaração feminina destaca as usuárias.

---

## 2. Modelo de dados (Supabase / Postgres)

```sql
-- ENUMS
create type account_type as enum ('student', 'scientist');
create type request_status as enum ('pending', 'accepted', 'rejected');
create type interest_origin as enum ('user_request', 'creator_invite');

-- USERS (estende auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text not null,
  account_type account_type not null,
  bio text,
  avatar_url text,
  course_or_area text,
  is_self_declared_woman boolean not null default false,  -- badge
  conduct_accepted_at timestamptz not null,               -- Trust & Safety
  is_verified_scientist boolean not null default false,   -- Etapa 3 (admin)
  created_at timestamptz not null default now()
);

-- POSTS + CURTIDAS
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create table post_likes (
  post_id uuid references posts on delete cascade,
  user_id uuid references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- PROJETOS DE IC
create table projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles on delete cascade,
  title text not null,
  description text not null,
  area text not null,
  tags text[] not null default '{}',
  slots int not null default 3,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

-- INTERESSE / CONVITE (accepted = participante)
create table project_interests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  origin interest_origin not null default 'user_request',
  message text,
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- SEGUIR (unilateral) e CONECTAR (com aceite)
create table follows (
  follower_id uuid references profiles on delete cascade,
  following_id uuid references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles on delete cascade,
  addressee_id uuid not null references profiles on delete cascade,
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index connections_pair_uq on connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- DM: conversa (com status de autorização) + mensagens
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles on delete cascade,
  user_b uuid not null references profiles on delete cascade,
  requested_by uuid not null references profiles,
  status request_status not null default 'pending',  -- accepted se já conectados
  created_at timestamptz not null default now()
);
create unique index conv_pair_uq on conversations
  (least(user_a, user_b), greatest(user_a, user_b));
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations on delete cascade,
  sender_id uuid not null references profiles,
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

-- VITRINE CIENTÍFICA
create table showcases (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles on delete cascade,
  title text not null,
  summary text not null,
  image_urls text[] not null default '{}',   -- Supabase Storage (carrossel)
  external_url text,
  created_at timestamptz not null default now()
);
```

### Decisões de simplificação
- Participantes de um projeto são as linhas com `status = 'accepted'` em `project_interests`, além do criador. **Não existe** tabela `project_members`.
- O convite do criador é uma linha com `origin = 'creator_invite'`, que o convidado aceita ou recusa.
- Contadores (curtidas, participantes) vêm de `select ..., post_likes(count)` do PostgREST. Não crie colunas denormalizadas.

### Privacidade (LGPD)
Guarde só o boolean `is_self_declared_woman`. O rótulo do checkbox é "Sou mulher (cis/trans)", mas **não** armazene a distinção cis/trans. Autodeclaração de gênero é dado pessoal sensível, então inclua uma linha de consentimento no cadastro.

---

## 3. Cronograma (4 pessoas × 3 dias)

### Papéis

| | Frente | Foco |
|---|---|---|
| **P1** | Tech Lead / Backend | Schema, RLS, triggers, tipos, deploy, Realtime |
| **P2** | Front: Identidade | Auth, perfil, badge, Feed |
| **P3** | Front: Rede | Explorar IC, Seguir/Conectar |
| **P4** | Front: Chat + UX | Shell/layout, Chat, Vitrine, seed e pitch |

### Dia 1: Fundação + Etapa 1

| Horário | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **Manhã (juntos, ~2h)** | Cria o projeto Supabase, roda a migration e gera tipos (`supabase gen types typescript`) | `create-next-app` + shadcn init + `@supabase/ssr` | Define as rotas (seção 4) | Layout base: navbar, tema, tokens de design |
| **Tarde** | RLS de `profiles`, `posts`, `projects`. Trigger `handle_new_user`. Deploy Vercel + env | Login/cadastro (tipo de conta, checkbox de autodeclaração, aceite do código de conduta) | Schema + queries de Projetos. Tela `/explore` (lista + filtros) | Componente `<WomanBadge/>`. Páginas de código de conduta e landing |
| **Noite** | RLS de interesses/conexões. Seed inicial | Perfil `/profile/[username]` + edição | `/explore/new` (criar IC) | Esqueleto de `/messages` (UI estática) |

**Meta do Dia 1:** cadastro, login, perfil com badge e criação de IC funcionando **em produção**.

### Dia 2: Fecha a Etapa 1 + inicia a Etapa 2

| Período | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **Manhã** | Server Actions de Like, Follow, Connect, Interesse | Feed: composer, lista, curtidas otimistas | `/explore/[id]`: "Tenho Interesse", painel do criador (aceitar/recusar/convidar), participantes | Chat: lista de conversas + janela de mensagens (UI) |
| **Tarde** | Realtime + RLS de `conversations`/`messages` | Polimento do Feed/Perfil. Seguir/Conectar na UI | `/network`: solicitações de conexão (aceitar/recusar) | Chat: integração com Realtime e fluxo de "pedido de mensagem" |
| **Noite** | Revisão de RLS: teste com 2 contas | Bug bash da Etapa 1 | Bug bash da Etapa 1 | Teste do chat com 2 contas |

**Meta do Dia 2 (checkpoint):** a Etapa 1 está completa e o chat funciona de ponta a ponta. Se o chat atrasar, **corte a Vitrine**, não a estabilidade.

### Dia 3: Etapa 2 + Entrega

| Período | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **Manhã** | Storage (bucket `showcases`) + RLS | Aba "Vitrine" no perfil | Link público `/vitrine/[id]` (SSR, sem login) | Formulário de Vitrine + carrossel (shadcn Carousel) |
| **Tarde** | Seed realista (usuárias, projetos, posts) | Responsividade mobile | Estados vazios e erros | Roteiro de demo + slides |
| **Noite** | **Feature freeze** → só correções | Ensaio do pitch | Ensaio do pitch | Ensaio do pitch |

**Sexta de manhã:** nada de código novo. Teste o link de produção e prepare uma conta demo e um plano B (vídeo gravado).

**Se sobrar tempo (Etapa 3):** o item mais barato é o algoritmo de prioridade, porque é só `.order('is_self_declared_woman', { ascending: false })` nas queries de busca e listagem. Faça esse primeiro e deixe o resto de lado.

---

## 4. Estrutura Next.js (App Router)

```
app/
├─ (auth)/
│  ├─ login/page.tsx
│  └─ signup/page.tsx
├─ auth/callback/route.ts
├─ (app)/                      # layout com guard de sessão + navbar
│  ├─ layout.tsx
│  ├─ feed/page.tsx
│  ├─ explore/
│  │  ├─ page.tsx              # lista + busca + filtros (searchParams)
│  │  ├─ new/page.tsx
│  │  └─ [id]/page.tsx         # detalhe, interesse, participantes
│  ├─ network/page.tsx         # seguidores, conexões, pedidos
│  ├─ messages/
│  │  ├─ page.tsx              # lista de conversas + pedidos
│  │  └─ [conversationId]/page.tsx
│  ├─ profile/[username]/page.tsx   # tabs: Sobre | Posts | Vitrine
│  └─ settings/profile/page.tsx
├─ vitrine/[id]/page.tsx       # PÚBLICA (fora do guard)
├─ conduta/page.tsx
└─ middleware.ts               # refresh de sessão
lib/
├─ supabase/{client,server,middleware}.ts
├─ actions/{posts,projects,connections,chat}.ts   # Server Actions
└─ types/database.ts           # gerado pelo Supabase
```

### Componentes principais

| Domínio | Componentes |
|---|---|
| Global | `Navbar`, `UserAvatar`, `WomanBadge`, `EmptyState`, `Skeletons` |
| Auth | `SignupForm` (react-hook-form + zod), `AccountTypeSelect`, `ConductCheckbox` |
| Perfil | `ProfileHeader`, `ProfileTabs`, `EditProfileForm`, `FollowButton`, `ConnectButton` |
| Feed | `PostComposer`, `PostCard`, `LikeButton` (otimista), `FeedList` |
| Explorar | `ProjectCard`, `ProjectFilters`, `ProjectForm`, `InterestButton`, `InterestRequestsPanel`, `ParticipantsList`, `InviteUserDialog` |
| Rede | `ConnectionRequestCard`, `NetworkTabs` |
| Chat | `ConversationList`, `ChatWindow` (client, Realtime), `MessageBubble`, `MessageRequestBanner` |
| Vitrine | `ShowcaseForm`, `ShowcaseCard`, `ImageCarousel`, `ShareLinkButton` |

**Regra de ouro:** páginas e listas como Server Components, que fazem a query. Só o que tem interação (like, chat, formulários) vira `"use client"`. Mutations vão em Server Actions com `revalidatePath`.

---

## 5. Prompts prontos para o Cursor

### Prompt 1: Feed

```
Contexto: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase
(@supabase/ssr). Tipos em @/lib/types/database.ts (gerados pelo Supabase).

Crie a rota app/(app)/feed/page.tsx como Server Component que busca os 30 posts
mais recentes com: posts + autor (profiles: username, full_name, avatar_url,
is_self_declared_woman) + contagem de curtidas + se o usuário logado já curtiu.
Use um único select aninhado do PostgREST.

Crie: 
- components/feed/PostComposer.tsx (client, textarea shadcn, limite 500 chars com
  contador, chama a Server Action createPost)
- components/feed/PostCard.tsx (mostra <WomanBadge/> ao lado do nome se
  is_self_declared_woman)
- components/feed/LikeButton.tsx (client, useOptimistic, chama toggleLike)
- lib/actions/posts.ts com createPost e toggleLike ("use server", validação com zod,
  revalidatePath('/feed'), retorno tipado { ok: true } | { ok: false; error: string }).

Sem `any`. Skeleton de loading em loading.tsx. Estado vazio amigável.
```

### Prompt 2: Explorar IC

```
Contexto: mesmo stack. Tabelas: projects, project_interests (status:
pending|accepted|rejected; origin: user_request|creator_invite), profiles.

Crie /explore (page.tsx Server Component) com busca e filtros via searchParams
(q, area, somente_abertos). Busca com ilike em title/description e overlap em tags.
Paginação por cursor simples. Componentes: ProjectFilters (client, atualiza a URL
com useRouter + debounce), ProjectCard.

Crie /explore/[id]/page.tsx:
- Detalhes do projeto + ParticipantsList (interesses accepted + criador).
- Se o usuário NÃO é o criador: <InterestButton/> com 3 estados (Tenho Interesse /
  Pendente / Participando) conforme project_interests.
- Se É o criador: <InterestRequestsPanel/> com aceitar/recusar e
  <InviteUserDialog/> (busca de usuários por username e cria interest
  origin=creator_invite).

Server Actions em lib/actions/projects.ts: requestInterest, respondInterest,
inviteUser, respondInvite. Valide permissões também na action. Tudo tipado, sem any.
```

### Prompt 3: Chat com Realtime

```
Contexto: mesmo stack. Tabelas conversations (user_a, user_b, requested_by,
status pending|accepted|rejected) e messages (conversation_id, sender_id, content).

Regra: se os usuários têm connection accepted, a conversa nasce 'accepted'. Senão
nasce 'pending': o solicitante envia UMA mensagem e o destinatário precisa
aceitar/recusar antes de a conversa continuar.

Crie:
- /messages: ConversationList (Server Component) com abas "Conversas" e "Pedidos".
- /messages/[conversationId]: ChatWindow (client) que carrega o histórico (últimas
  50, via props do Server Component) e assina com supabase.channel(`conv:${id}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
  filter: `conversation_id=eq.${id}` }, ...).
  - Cleanup obrigatório com supabase.removeChannel no return do useEffect.
  - Deduplicar mensagens por id (otimista + evento realtime).
  - Auto-scroll para a última mensagem.
- MessageRequestBanner: se status=pending e eu não sou o solicitante, mostra
  Aceitar/Recusar. Se sou o solicitante e já enviei 1 mensagem, desabilita o input.
- Server Actions: startConversation, sendMessage, respondRequest.

TypeScript strict, sem any, tipos de Database['public']['Tables'].
```

---

## 6. Etapas de desenvolvimento (prioridades estritas)

### ETAPA 1: MVP (obrigatório)
- Auth/Perfis (incluindo checkbox de autodeclaração e badge visual)
- Feed (curtidas)
- Explorar IC (criar, buscar, interesse, aceite)
- Conexões (Follow/Connect)

### ETAPA 2: Importante (se der tempo)
- Chat em tempo real (com pedido de autorização)
- Vitrine Científica (aba no perfil + link público)

### ETAPA 3: Final / Backlog (só se sobrar tempo)
- Comentários aninhados no Feed
- Notificações (in-app + e-mail)
- Painel Admin para verificar Cientistas
- Algoritmo de prioridade: usuárias que se autodeclararam mulheres aparecem no topo das buscas e das listagens de projetos de IC (implementação barata: `.order('is_self_declared_woman', { ascending: false })`)

---

## 7. Alertas técnicos (Supabase)

### 7.1 RLS: os erros que mais custam tempo
- **RLS ligado sem policy = tabela "vazia".** Se uma lista vem vazia sem erro, é quase sempre policy faltando. Teste sempre com **duas contas** e não pelo SQL Editor, que usa a role `postgres` e ignora RLS.
- **Auto-promoção de privilégio.** Uma policy de `update` em `profiles` sem restrição de colunas deixa qualquer um editar `is_verified_scientist`. Restrinja por coluna:
  ```sql
  revoke update on profiles from authenticated;
  grant update (username, full_name, bio, avatar_url, course_or_area,
                is_self_declared_woman) on profiles to authenticated;
  ```
- Use `(select auth.uid())` em vez de `auth.uid()` direto nas policies, que é mais rápido. Views ignoram RLS por padrão, então crie com `security_invoker = true` ou evite views no MVP.
- Nunca exponha a `service_role` key no client nem em `NEXT_PUBLIC_*`.

### 7.2 Realtime: o chat "funciona local e não em produção"
- A tabela precisa estar na publicação: `alter publication supabase_realtime add table messages;`. Sem isso, nenhum evento chega e nenhum erro aparece.
- O `postgres_changes` respeita RLS, então o usuário precisa de policy de `select` em `messages`. Eventos de DELETE não passam por filtro de RLS, por isso evite expor deletes em tempo real.
- **Canais duplicados:** o React Strict Mode monta o `useEffect` duas vezes em dev. Sem `removeChannel` no cleanup, você recebe mensagens em dobro. Deduplique por `id`.

### 7.3 A regra de "aprovação prévia" tem que valer no banco, não só na UI
Se só o front esconde o input, qualquer pessoa manda mensagem pelo client do Supabase. Reforce na policy de insert:

```sql
create policy msg_insert on messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (select auth.uid()) in (c.user_a, c.user_b)
      and (
        c.status = 'accepted'
        or (c.status = 'pending'
            and c.requested_by = (select auth.uid())
            and not exists (select 1 from messages m where m.conversation_id = c.id))
      )
  )
);
```

Garanta também, com policy de `update`, que **só o destinatário** (quem não é `requested_by`) consiga mudar `conversations.status`.

### 7.4 Bônus para a demo
Desative a confirmação de e-mail no Auth enquanto desenvolve. O SMTP padrão do Supabase tem limite muito baixo de envios por hora e trava os testes de cadastro da equipe. Antes de apresentar, decida se mantém desligada ou configura um SMTP próprio, como o Resend.

---

## 8. Próximos passos sugeridos
1. Gerar a **migration SQL completa com todas as policies de RLS**.
2. Gerar o trigger **`handle_new_user`** + formulário de cadastro (com checkbox de autodeclaração e aceite do código de conduta).
