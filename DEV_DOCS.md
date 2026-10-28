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
│   ├── migrations/              # DDL, RLS, Triggers e Funções SQL
│   └── seed.sql                 # Dados demonstrativos realistas para o Hackathon
├── app/                         # [FRONTEND] Next.js 15 App Router
│   ├── (auth)/                  # Rotas públicas: Login e Cadastro com termo e badge
│   ├── (app)/                   # Rotas protegidas (Feed, Explorar, Mensagens, Perfil)
│   ├── vitrine/[id]/            # Rota pública de trabalhos de pesquisa
│   └── layout.tsx & globals.css # Root layout com ThemeProvider e tokens semânticos
├── components/                  # [INTERFACE & COMPONENTES]
│   ├── common/                  # WomanBadge, Navbar, ThemeToggle, EmptyState, Skeletons
│   ├── ui/                      # Componentes base do shadcn/ui
│   └── feed/, explore/, ...     # Componentes específicos de cada domínio
└── lib/                         # [LÓGICA E SERVIÇOS]
    ├── actions/                 # Server Actions ("use server") tipadas e validadas
    ├── supabase/                # Clients para Server, Client e Middleware
    └── types/database.ts        # Tipagem TypeScript estrita do banco
```

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
   - Projetos de Iniciação Científica criados por cientistas ou alunas.
   - `project_interests` gerencia tanto as solicitações de alunas (`origin = 'user_request'`) quanto convites do criador (`origin = 'creator_invite'`). Participantes confirmados são as linhas com `status = 'accepted'`.

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
| `003_revision_add_email_and_indexes.sql` | Revisão Completa: adiciona a coluna `email text unique` em `profiles`, sincroniza com `auth.users`, implementa `handle_new_user()` definitivo (com email, username único e `search_path = public`) e cria índices de alta performance (GIN para tags de IC, índices compostos para feed e DM). | ⏳ Pronto para execução no SQL Editor |

---

## 3. Registro de Etapas e Progresso

| Etapa | Módulo | Status | Descrição |
|---|---|---|---|
| **Etapa 1.1** | Identidade Visual & Design System | ✅ Concluído | Definidos tokens claro/escuro, cores e regras no `AGENTS.md` e `DESIGN_SYSTEM.md`. |
| **Etapa 1.2** | Backend & Migration SQL | ✅ Concluído | Criado schema DDL, RLS policies rigorosas, trigger `handle_new_user`, `seed.sql` e tipos TypeScript estritos em `lib/types/database.ts`. |
| **Etapa 1.3** | Setup do Projeto Next.js | ✅ Concluído | Next.js 15 App Router, TypeScript strict, Tailwind, `next-themes`, `ThemeProvider`, `ThemeToggle`, `WomanBadge`, layout raiz e landing page. |
| **Etapa 1.4** | Auth & Perfis + `<WomanBadge />` | ✅ Concluído | Telas de login/cadastro, tipo de conta (Estudante/Cientista), autodeclaração feminina com preview do badge, aceite de conduta, Server Actions (`signUp`, `signIn`, `signOut`), Navbar autenticada, rota `/profile/[username]` e `/settings/profile`. |
| **Etapa 1.5** | Feed com Curtidas Otimistas | 🔄 Próximo | PostComposer (limite 500 chars), lista de posts, autor com badge e toggleLike otimista via Server Actions. |
| **Etapa 1.6** | Explorar IC (Match Científico) | ⏳ Pendente | Busca, filtros, solicitação de interesse e painel do criador. |
| **Etapa 1.7** | Conexões & Seguir | ⏳ Pendente | Seguir e pedidos de conexão na UI. |
| **Etapa 2.1** | Chat Realtime com Aprovação | ⏳ Pendente | Supabase Realtime + bloqueio de assédio. |
| **Etapa 2.2** | Vitrine Científica & Storage | ⏳ Pendente | Carrossel de trabalhos e página pública SSR. |
