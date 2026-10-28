# Documentação Técnica e Funcionamento do Código — Ártemis

Este documento registra a arquitetura, o fluxo de dados, as regras de negócio e o estado de desenvolvimento do projeto **Ártemis**.

---

## 1. Visão Geral da Arquitetura

O sistema segue a divisão entre:
- **Backend (Supabase/PostgreSQL):** Banco de dados relacional, controle de concorrência, triggers de autenticação, Realtime para mensageria e RLS (Row Level Security) rigoroso para garantir privacidade e segurança direto na fonte.
- **Frontend (Next.js 15 App Router):** Server Components por padrão para máxima performance e SEO, Server Actions para mutações tipadas, Tailwind CSS + shadcn/ui para componentes visuais e `next-themes` para suporte aos modos Claro e Escuro.
- **Camada de Integração (`lib/`):** Clientes Supabase SSR (`@supabase/ssr`), schemas de validação `zod` e tipos gerados do banco de dados (`lib/types/database.ts`).

```
hackathon-ifsp-jcr-ciencia-delas-2026/
├── supabase/                    # [BACKEND & BANCO]
│   ├── migrations/              # DDL, RLS, Triggers e Funções SQL (001…005, imutáveis)
│   └── seed.sql                 # Dados demonstrativos (ver seção 4: precisa de ajuste p/ Supabase hospedado)
├── app/                         # [FRONTEND] Next.js 15 App Router
│   ├── (auth)/                  # Rotas públicas: /login (com aviso de confirmação) e /signup
│   ├── auth/callback/           # Callback do Supabase Auth
│   ├── (app)/                   # Rotas protegidas (guard de sessão no layout)
│   │   ├── feed/                # Feed + loading.tsx (skeleton)
│   │   ├── explore/             # Lista+filtros, /new, /[id], /[id]/edit + loading.tsx
│   │   ├── network/             # Rede: pedidos, conexões, seguindo, seguidores
│   │   ├── profile/[username]/  # Perfil com tabs (Posts, Projetos de IC, Vitrine) e contadores
│   │   └── settings/profile/    # Edição de perfil
│   ├── conduta/                 # Código de conduta (linkado no cadastro)
│   └── layout.tsx & globals.css # Root layout com ThemeProvider e tokens semânticos
├── components/                  # [INTERFACE & COMPONENTES]
│   ├── common/                  # WomanBadge, ThemeToggle
│   ├── layout/                  # Navbar (com pin de convites da Rede)
│   ├── auth/, feed/, explore/,  # Domínios (formulários, cards, botões client)
│   ├── profile/                 # FollowButton, ConnectButton, EditProfileForm
│   └── theme-provider.tsx
└── lib/                         # [LÓGICA E SERVIÇOS]
    ├── actions/                 # Server Actions: auth, posts, projects, connections
    ├── supabase/                # Clients para Server, Client e Middleware
    └── types/                   # database.ts (gerado) e explore.ts (linhas do PostgREST)
```

> **Nota sobre shadcn/ui:** a dependência base (`class-variance-authority`) está instalada, mas os componentes de `components/ui/` **não foram inicializados** — a interface segue Tailwind puro + Lucide, no mesmo padrão visual dos tokens semânticos. Inicializar o shadcn é opcional/backlog.

---

## 2. Modelo de Dados e Regras de Segurança (RLS)

### Tabelas Principais

1. **`profiles`**:
   - Estende `auth.users` do Supabase.
   - Criada automaticamente via trigger `handle_new_user` após o cadastro no Supabase Auth.
   - Armazena `account_type` (`student` ou `scientist`), `is_self_declared_woman` (boolean sensível - LGPD), `conduct_accepted_at` (termo de conduta) e `is_verified_scientist`.
   - **RLS:** Leitura pública para usuários autenticados. Atualização restrita ao próprio usuário com colunas sensíveis revogadas (não pode se auto-promover a cientista verificada).

2. **`posts` e `post_likes`**:
   - Posts com limite de 500 caracteres.
   - Contagem de curtidas é feita em tempo de query (`post_likes(count)`), sem colunas denormalizadas.
   - **RLS:** Criação restrita ao autor autenticado; deleção permitida apenas ao autor.

3. **`projects` e `project_interests`**:
   - Projetos de Iniciação Científica criados **apenas por contas Cientista** (`account_type = 'scientist'`): validado na Server Action `createProject` **e** na policy `projects_insert_auth` (migration 005).
   - `project_interests` gerencia tanto as solicitações de alunas (`origin = 'user_request'`) quanto convites do criador (`origin = 'creator_invite'`). Participantes confirmados são as linhas com `status = 'accepted'`.
   - O criador pode editar (`update`), excluir (`delete`) o projeto e remover participantes (delete da linha `accepted`) — RLS `projects_update_own`/`projects_delete_own`/`project_interests_delete` + checagem de `creator_id` nas actions.
   - Ao atingir `slots` cheios na aceitação, a action fecha o projeto automaticamente (`is_open = false`).

4. **`follows` e `connections`**:
   - `follows`: relação unilateral de seguir.
   - `connections`: relação bilateral com pedido e aceite. Índice único de par (`least`, `greatest`) para evitar duplicidade.

5. **`conversations` e `messages`**:
   - Proteção contra assédio: se os usuários não possuem conexão aceita, a conversa nasce `status = 'pending'`.
   - O solicitante só pode enviar **1 mensagem inicial** até que o destinatário aceite o pedido.
   - **Regra reforçada no RLS:** a política `msg_insert` bloqueia inserções extras se a conversa estiver pendente e o solicitante já tiver enviado uma mensagem.

### 2.1 Histórico de Migrations (Sequencial & Imutável)
> **Regra Fundamental:** Migrations já executadas no banco são **imutáveis**. Qualquer nova alteração deve ser criada como uma migration subsequente contínua.

| Arquivo | Descrição | Status de Aplicação |
|---|---|---|
| `001_initial_schema.sql` | Schema base completo: enums, 9 tabelas (`profiles`, `posts`, `post_likes`, `projects`, `project_interests`, `follows`, `connections`, `conversations`, `messages`, `showcases`), políticas de RLS completas e trigger inicial `handle_new_user`. | ✅ Executado no Supabase |
| `002_fix_signup_trigger.sql` | Continuidade: recria a função `handle_new_user()` adicionando `set search_path = public`, tratamento com `exception when others` para tipos enum e loop de desambiguação para garantir que o `@username` seja sempre único sem travar o cadastro. | ⏳ Substituído pela 003 |
| `003_revision_add_email_and_indexes.sql` | Revisão Completa: adiciona a coluna `email text unique` em `profiles`, sincroniza com `auth.users`, implementa `handle_new_user()` definitivo (com email, username único e `search_path = public`) e cria índices de alta performance (GIN para tags de IC, índices compostos para feed e DM). | ✅ Executado no Supabase |
| `004_feed_interactive_fixes.sql` | Correções do Etapa 1.5 (Feed): garante coluna `email` (idempotente via `do $$`), trigger `handle_new_user` definitivo, índices de feed (`posts(created_at desc)`, `post_likes(user_id)`) e reforço de grants. **Atenção:** a última linha (`alter publication supabase_realtime add table messages`) já estava aplicada — na execução foi comentada; em reexecução, pular essa linha. | ✅ Executado no Supabase (linha de publication comentada) |
| `005_scientist_only_projects_and_connection_count.sql` | 1) Recria a policy `projects_insert_auth`: **apenas contas `account_type = 'scientist'` criam projetos de IC** (reforço no RLS da regra validada também na Server Action `createProject`). 2) Cria a função `connection_count(p_user_id uuid)` (security definer, grant só para `authenticated`) usada pelo perfil para exibir a contagem de conexões aceitas — a policy `connections_select_involved` impediria contar as de terceiros. **Observação:** a assinatura dessa função foi adicionada manualmente em `lib/types/database.ts` (`Functions`); ao regenerar os tipos, manter a assinatura. | ⏳ Executar no SQL Editor (obrigatório para o contador de conexões do perfil) |

---

## 3. Registro de Etapas e Progresso

| Etapa | Módulo | Status | Descrição |
|---|---|---|---|
| **Etapa 1.1** | Identidade Visual & Design System | ✅ Concluído | Definidos tokens claro/escuro, cores e regras no `AGENTS.md` e `DESIGN_SYSTEM.md`. |
| **Etapa 1.2** | Backend & Migration SQL | ✅ Concluído | Criado schema DDL, RLS policies rigorosas, trigger `handle_new_user`, `seed.sql` e tipos TypeScript estritos em `lib/types/database.ts`. |
| **Etapa 1.3** | Setup do Projeto Next.js | ✅ Concluído | Next.js 15 App Router, TypeScript strict, Tailwind, `next-themes`, `ThemeProvider`, `ThemeToggle`, `WomanBadge`, layout raiz e landing page. |
| **Etapa 1.4** | Auth & Perfis + `<WomanBadge />` | ✅ Concluído | Telas de login/cadastro, tipo de conta (Estudante/Cientista), autodeclaração feminina com preview do badge, aceite de conduta, Server Actions (`signUp`, `signIn`, `signOut`), Navbar autenticada, rota `/profile/[username]` e `/settings/profile`. |
| **Etapa 1.5** | Feed com Curtidas Otimistas | ✅ Concluído | PostComposer (limite 500 chars), lista de posts, autor com `<WomanBadge/>`, `toggleLike` corrigido (PK composta `post_id,user_id`, sem `any`), `feed/loading.tsx` (skeleton). |
| **Etapa 1.6** | Explorar IC (Match Científico) | ✅ Concluído | `/explore` (busca `ilike` em título/descrição, filtro por área e "somente abertos", paginação), `/explore/new` (ProjectForm com zod), `/explore/[id]` (detalhe, `<InterestButton/>` 3 estados, `InterestRequestsPanel` aceitar/recusar com checagem de vagas, `InviteUserDialog` com busca de usuários, `InviteResponseBanner` para convidados e `ParticipantsList`). Server Actions em `lib/actions/projects.ts`; tipos em `lib/types/explore.ts`. |
| **Etapa 1.7** | Conexões & Seguir | 🔄 Quase concluído | `/network` (tabs conexões/pedidos), `FollowButton`, `ConnectButton` e `lib/actions/connections.ts` escritos; falta teste manual com 2 contas. |
| **Etapa 2.1** | Chat Realtime com Aprovação | ⏳ Pendente | Supabase Realtime + bloqueio de assédio. |
| **Etapa 2.2** | Vitrine Científica & Storage | ⏳ Pendente | Carrossel de trabalhos e página pública SSR. |

### 3.1 Alterações recentes (sprint pós-Etapa 1.6)

| Item | Descrição | Status |
|---|---|---|
| **G-1** | **Somente cientistas publicam IC:** validação em `createProject` (Server Action), painel de recusa em `/explore/new`, botão "Novo projeto" oculto no `/explore` para estudantes e policy reescrita na migration `005` (regra em dois lugares, conforme AGENTS.md §0). | ✅ Concluído (executar `005`) |
| **G-2** | **Pin de convites na aba "Rede" da Navbar:** `(app)/layout.tsx` conta `connections` com `status = 'pending'` onde o usuário é `addressee` (em paralelo com o profile) e repassa `pendingConnectionCount` ao `<Navbar/>`, que renderiza um badge coral (desktop + mobile, `9+` acima de 9). Badge zera via `revalidatePath("/", "layout")` nas actions de conexão + `router.refresh()` no `ConnectButton`. | ✅ Concluído |
| **G-3** | **Gestão de IC pelo criador:** `updateProject`, `deleteProject` e `removeParticipant` em `lib/actions/projects.ts` (todas revalidam permissão de `creator_id` + RLS). UI: rota `/explore/[id]/edit` (ProjectForm em modo edição com `initialValues`), `DeleteProjectButton` (confirm em 2 etapas) e `RemoveParticipantButton` nos participantes (`ParticipantsList` com `canManage`). | ✅ Concluído |
| **G-4** | **Contagem de conexões no perfil:** bloco "conexões" nos metadados do `/profile/[username]` via `supabase.rpc("connection_count", …)` — função security definer da migration `005` (necessária porque a policy de `connections` só deixa ver as próprias linhas; sem ela, o count de terceiros daria 0). | ⏳ Requer migration `005` |
| **G-5** | **Performance:** queries paralelizadas — feed (perfil + posts/likes: 4 roundtrips → 2), layout da Navbar (profile + pin), `/explore` (account_type + listagem). Ver nota 3.2. | ✅ Concluído |

### 3.2 Nota de performance (dev × produção)

- **`npm run dev` é lento por natureza:** compilação lazy por rota no primeiro acesso, React Strict Mode (efeitos/montagens duplicados), Hot Module Replacement e sem cache de build. Não é bug do projeto nem necessariamente do seu computador.
- **Para medir de verdade:** `npm run build && npm start` — aí roda o build de produção (Server Components pré-compilados, JS minificado). No hackathon/demo, use produção ou a preview da Vercel.
- Já otimizado no código: nenhuma query N+1 (listas usam embeds do PostgREST com contagem via `count: "exact"`/`post_likes`), middleware ignora assets estáticos e as dependências independentes rodam em `Promise.all`.

---

## 4. Comandos & Checklist de Demo

### Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Desenvolvimento (lento por natureza — ver nota 3.2) |
| `npm run build && npm start` | Build de produção — **use isto para demo/medida de performance** |
| `npx tsc --noEmit` | Checagem de tipos isolada (deve sair com exit 0) |

### Checklist antes da demo

1. **Migration `005` executada** no SQL Editor (`005_scientist_only_projects_and_connection_count.sql`) — sem ela, o contador de conexões do perfil fica em 0 e a restrição de RLS de "só cientista cria IC" não vale (a validação da Server Action continua valendo).
2. **Conta de teste precisa ser `scientist`** para criar IC (as contas criadas como Estudante são bloqueadas por regra):
   ```sql
   update public.profiles set account_type = 'scientist' where username = '<seu_username>';
   ```
3. **Confirmação de e-mail desligada** no Dashboard (Authentication → Providers → Email → "Confirm email" = off) — liberada durante o desenvolvimento (AGENTS.md §7.4). Decidir antes da apresentação se mantém desligada (demo) ou configura SMTP próprio (ex.: Resend).
4. **Seed:** o `seed.sql` atual **não roda em Supabase hospedado** — insere `profiles` com UUIDs que não existem em `auth.users` (FK). Reescrever inserindo também em `auth.users` (com `crypt()`, deixando a trigger criar os profiles) antes de usar dados de demonstração.
5. Contas pendentes de confirmação antigas (criadas com o confirm ligado) continuam bloqueadas no login — reparar com:
   ```sql
   update auth.users set email_confirmed_at = now(), confirmed_at = now() where email = '<email>';
   ```
6. Teste manual com **2 contas**: feed + curtidas, interesse/aceite em IC, convite de conexão (pin na Navbar aceitando), e (Etapa 2.1) chat quando existir.
