# Setup e deploy

Como rodar a Artemis na sua máquina, configurar cada serviço (todos com plano gratuito) e publicar
na Vercel + Supabase Cloud.

> Resumo rápido: `npm install` → `npx supabase start` → copiar as chaves para `.env.local` → `npm run dev`
> → entrar com `larissa@demo.cienciadelas.dev` / `ciencia-delas-demo`.

## 1. Pré-requisitos

| Ferramenta | Versão | Para quê |
| --- | --- | --- |
| Node.js | 20.9+ (recomendado 22) | Next.js 16 |
| npm | 10+ | dependências |
| Docker Desktop (ou Docker Engine) | atual | Supabase local (`npx supabase start`) |
| Git | qualquer | clonar o repositório |

O CLI do Supabase já vem como dependência de desenvolvimento (`npx supabase ...`), não precisa instalar à parte.

## 2. Rodando localmente (recomendado para o time)

```bash
git clone https://github.com/henriquecarvalhodeandrade/hackathon-ifsp-jcr-ciencia-delas-2026.git
cd hackathon-ifsp-jcr-ciencia-delas-2026
npm install

# Sobe Postgres, Auth, API, Storage e a caixa de e-mails (Mailpit) em Docker.
# Na primeira vez aplica as migrations e o seed de demonstração.
npx supabase start

cp .env.example .env.local
```

O `npx supabase start` imprime as chaves. Copie para o `.env.local`:

| Saída do `supabase start` | Variável no `.env.local` |
| --- | --- |
| `API URL` (http://127.0.0.1:54321) | `NEXT_PUBLIC_SUPABASE_URL` |
| `Publishable key` (`sb_publishable_...`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `Secret key` (`sb_secret_...`) | `SUPABASE_SECRET_KEY` |

Rode `npx supabase status` para ver de novo. Depois:

```bash
npm run dev            # http://localhost:3000
```

Serviços locais úteis:

| Serviço | Endereço |
| --- | --- |
| App | http://localhost:3000 |
| API do Supabase | http://127.0.0.1:54321 |
| Banco (psql) | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| **Mailpit** (todos os e-mails de cadastro, login e newsletter caem aqui) | http://127.0.0.1:54324 |
| Studio (se não tiver sido desligado) | http://127.0.0.1:54323 |

### Contas de demonstração

Senha de todas: **`ciencia-delas-demo`** (dados fictícios — não use o seed em produção).

| Para testar | Conta |
| --- | --- |
| Mentoranda com mentoria ativa | `larissa@demo.cienciadelas.dev` |
| Mentoranda com pedido pendente | `yasmin@demo.cienciadelas.dev` |
| Mentora (recebe pedidos) | `marina@demo.cienciadelas.dev` |
| Moderadora | `moderacao@demo.cienciadelas.dev` |
| Administradora (newsletter, papéis) | `admin@demo.cienciadelas.dev` |

A lista completa está em [`03-banco-de-dados.md` §15](03-banco-de-dados.md#15-contas-de-demonstração).

Para testar o fluxo completo de **cadastro**, crie uma conta nova em `/cadastro`: o e-mail de confirmação chega
no Mailpit; clique no link e você cai no onboarding.

### Comandos do dia a dia

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run check` | lint + typecheck + testes unitários |
| `npm test` | testes unitários (Vitest) |
| `npm run db:test` | testes do banco (pgTAP: RLS, triggers, RPCs) |
| `npm run db:reset` | recria o banco local do zero (migrations + seed) |
| `npm run db:types` | regenera `src/lib/database.types.ts` a partir do banco local |
| `npx supabase migration new <nome>` | cria uma migration nova |
| `npm run ai:backfill` | gera embeddings dos perfis (precisa de `GEMINI_API_KEY`) |
| `npm run format` | formata o código (Prettier) |

> Sem Docker? Dá para validar as migrations num Postgres 16 comum com `npm run db:validate`
> (ver [`03-banco-de-dados.md`](03-banco-de-dados.md)). O app, porém, precisa de um Supabase (local ou cloud).

## 3. Variáveis de ambiente

Todas estão documentadas em [`.env.example`](../.env.example). Resumo:

| Variável | Obrigatória? | Onde conseguir |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | sim em produção | URL pública do site (links de e-mail, redirects de login) |
| `NEXT_PUBLIC_SUPABASE_URL` | **sim** | `supabase status` ou Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **sim** | `sb_publishable_...` (ou a anon key legada) |
| `SUPABASE_SECRET_KEY` | para newsletter, cron, exclusão de conta e painel admin | `sb_secret_...` (ou service_role legada) — **nunca** com `NEXT_PUBLIC_` |
| `GEMINI_API_KEY` | opcional (IA) | https://aistudio.google.com/apikey — grátis, sem cartão |
| `GROQ_API_KEY` | opcional (IA, fallback) | https://console.groq.com/keys — grátis |
| `OPENROUTER_API_KEY` | opcional (IA, fallback) | https://openrouter.ai/keys |
| `AI_PROVIDER` | opcional | `gemini`, `groq`, `openrouter` ou `none`; vazio = primeira chave encontrada |
| `RESEND_API_KEY` | opcional (envio da newsletter) | https://resend.com/api-keys |
| `NEWSLETTER_FROM` | com Resend | remetente de um **domínio verificado** no Resend |
| `NEWSLETTER_MAX_PER_RUN` | opcional | teto de e-mails por execução (padrão 90) |
| `CRON_SECRET` | sim em produção | string aleatória longa (`openssl rand -hex 32`) |
| `CONTACT_EMAIL` | opcional | contato usado no User-Agent do Crossref |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | opcional | `true` depois de configurar o Google no Supabase |

**O app funciona sem as chaves opcionais:** sem IA, a mentoria usa o score heurístico; sem Resend, as edições da
newsletter ficam só no site (e, em desenvolvimento, os e-mails vão para o Mailpit).

## 4. Deploy: Supabase Cloud + Vercel

### 4.1 Supabase Cloud (plano Free)

1. Crie um projeto em https://supabase.com/dashboard (região **South America (São Paulo)**).
2. Ligue o CLI ao projeto e envie as migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   As migrations criam tabelas, RLS, funções e o bucket `avatars`. Os **dados de referência** (64 áreas de
   pesquisa e 8 categorias do fórum) ficam no `supabase/seed.sql`, que o `db push` não aplica:
   - **Produção:** no SQL Editor, rode só as seções **1. Áreas de pesquisa** e **1b. Categorias do fórum** do
     `seed.sql` (linhas iniciais, antes de `2. DEMONSTRAÇÃO`).
   - **Ambiente de demonstração:** rode o arquivo inteiro (inclui as contas e dados fictícios).
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://<seu-app>.vercel.app`
   - *Redirect URLs*: `https://<seu-app>.vercel.app/**` e, para previews, `https://*-<sua-conta>.vercel.app/**`
4. **Authentication → Email Templates**: cole o conteúdo de `supabase/templates/*.html` (confirmação, link mágico,
   recuperação, troca de e-mail, convite) e os assuntos que estão em `supabase/config.toml`. Os templates apontam
   para `/auth/confirm` com `token_hash` (fluxo PKCE recomendado para SSR).
5. **Authentication → Sign In / Providers → Email**: deixe "Confirm email" ligado; senha mínima 8.
6. (Opcional) **Google**: crie credenciais OAuth no Google Cloud, cole Client ID/Secret em *Providers → Google*,
   adicione `https://<PROJECT_REF>.supabase.co/auth/v1/callback` como URI de redirecionamento no Google e defina
   `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` na Vercel.
7. Gere os tipos a partir da nuvem quando mudar o schema: `SUPABASE_PROJECT_REF=<ref> npm run db:types:remote`.
8. Antes da apresentação, rode **Advisors → Security e Performance** no painel e confira que não há alertas
   críticos.

> O e-mail embutido do Supabase Free envia poucas mensagens por hora. Para um evento com muitas inscrições,
> configure SMTP próprio (pode ser o próprio Resend) em *Project Settings → Auth → SMTP*.

### 4.2 Vercel (plano Hobby)

1. Importe o repositório em https://vercel.com/new (framework detectado: Next.js).
2. Em *Settings → Environment Variables*, cadastre as variáveis da seção 3 (no mínimo as três do Supabase,
   `NEXT_PUBLIC_SITE_URL` e `CRON_SECRET`).
3. Faça o deploy. O `vercel.json` já registra o **cron semanal** da newsletter:
   `GET /api/cron/newsletter` toda segunda às 12:00 UTC (09:00 em Brasília). A Vercel envia
   `Authorization: Bearer $CRON_SECRET` automaticamente. No Hobby o horário tem precisão de ±59 min e só roda em
   produção.
4. Teste o cron manualmente:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<seu-app>.vercel.app/api/cron/newsletter
   ```

Alternativa sem Vercel Cron: agende pelo próprio Supabase com `pg_cron` + `pg_net`
([`03-banco-de-dados.md` §16](03-banco-de-dados.md)).

### 4.3 Primeira administradora

Depois de criar sua conta no site em produção, promova-a no SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'voce@exemplo.com');
```

Administradoras podem promover moderadoras pelo painel `/admin`.

### 4.4 Newsletter de verdade (Resend)

1. Crie a conta no Resend e uma API key.
2. Verifique um domínio seu em *Domains* (registros SPF e DKIM no DNS). Sem domínio verificado, o remetente de
   teste `onboarding@resend.dev` **só entrega para o e-mail da própria conta Resend**.
3. Defina `RESEND_API_KEY` e `NEWSLETTER_FROM="Artemis <boletim@seu-dominio>"` na Vercel.
4. Plano gratuito: 100 e-mails/dia e 3.000/mês. O serviço envia em lotes e retoma na execução seguinte
   (`NEWSLETTER_MAX_PER_RUN`). Detalhes: [`08-newsletter.md`](08-newsletter.md).

### 4.5 IA gratuita

1. Gere uma chave no Google AI Studio e defina `GEMINI_API_KEY` (texto com `gemini-3.5-flash-lite` e embeddings
   com `gemini-embedding-2`).
2. Opcional: `GROQ_API_KEY` como reserva (modelo `openai/gpt-oss-120b`).
3. Gere os embeddings dos perfis já existentes: `npm run ai:backfill` (com as variáveis de produção num
   `.env.local` temporário).
4. Atenção aos termos do plano gratuito do Gemini (uso dos dados para melhorar produtos e exigência de 18+): o app
   pede consentimento explícito e não envia nome, e-mail nem links. Ver [`04-mentoria-com-ia.md`](04-mentoria-com-ia.md).

## 5. Checklist antes de publicar

- [ ] Preencher contato da controladora/encarregada de dados em `/privacidade` (`src/app/privacidade/page.tsx`)
      e a equipe em `/sobre` (`src/app/sobre/page.tsx`).
- [ ] `CRON_SECRET` forte e `SUPABASE_SECRET_KEY` só no servidor.
- [ ] Site URL e Redirect URLs corretas no Supabase.
- [ ] Templates de e-mail em pt-BR colados no painel.
- [ ] Seed de demonstração **não** aplicado em produção (ou contas demo removidas).
- [ ] `npm run check`, `npm run db:test` e `npm run build` passando.
- [ ] Advisors do Supabase sem alertas críticos.

## 6. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Faixa "Configure o Supabase" no topo | `.env.local` sem URL/chave | Seção 2 |
| Cadastro não chega | Em dev o e-mail está no Mailpit; em produção, limite do SMTP do Supabase | Abra http://127.0.0.1:54324 ou configure SMTP |
| Link do e-mail volta para `localhost` em produção | Site URL / Redirect URLs | Seção 4.1 passo 3 |
| `permission denied for table ...` (42501) | Tentativa de ler/escrever algo que o RLS ou os GRANTs não permitem | Esperado para dados de outras pessoas; para tabelas novas, declare os `GRANT`s na migration |
| Mentoria sem "Sugestão por IA" | Sem chave de IA, sem consentimento, ou cota gratuita esgotada (429) | Modo heurístico continua funcionando; veja os logs do servidor |
| "Another next dev server is already running" | Next 16 permite um `next dev` por pasta | Feche o outro servidor ou rode `next build && next start -p 3001` |
| Tipos desatualizados após mudar o banco | `database.types.ts` antigo | `npm run db:types` |
