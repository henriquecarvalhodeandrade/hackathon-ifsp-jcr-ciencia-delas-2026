# Setup e deploy

Como rodar a Artemis na sua máquina, configurar cada serviço (todos com plano gratuito) e publicar
na Vercel + Supabase Cloud.

> Resumo rápido: `npm install` → `npx supabase start` → copiar as chaves para `.env.local` → `npm run dev`
> → entrar com `larissa@demo.cienciadelas.dev` / `ciencia-delas-demo`.

## 1. Pré-requisitos

| Ferramenta                        | Versão                 | Para quê                              |
| --------------------------------- | ---------------------- | ------------------------------------- |
| Node.js                           | 20.9+ (recomendado 22) | Next.js 16                            |
| npm                               | 10+                    | dependências                          |
| Docker Desktop (ou Docker Engine) | atual                  | Supabase local (`npx supabase start`) |
| Git                               | qualquer               | clonar o repositório                  |

O CLI do Supabase já vem como dependência de desenvolvimento (`npx supabase ...`), não precisa instalar à parte.

## 2. Rodando localmente (recomendado para o time)

```bash
git clone https://github.com/henriquecarvalhodeandrade/hackathon-ifsp-jcr-ciencia-delas-2026.git
cd hackathon-ifsp-jcr-ciencia-delas-2026
npm install

# Sobe Postgres, Auth, API, Storage e a caixa de e-mails (Mailpit) em Docker.
# Na primeira vez aplica as migrations e os seeds de demonstração (supabase/seed.sql e depois
# supabase/seeds/*.sql, como manda o [db.seed] do supabase/config.toml).
npx supabase start

cp .env.example .env.local
```

O `npx supabase start` imprime as chaves. Copie para o `.env.local`:

| Saída do `supabase start`                | Variável no `.env.local`               |
| ---------------------------------------- | -------------------------------------- |
| `API URL` (http://127.0.0.1:54321)       | `NEXT_PUBLIC_SUPABASE_URL`             |
| `Publishable key` (`sb_publishable_...`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `Secret key` (`sb_secret_...`)           | `SUPABASE_SECRET_KEY`                  |

Rode `npx supabase status` para ver de novo. Depois:

```bash
npm run dev            # http://localhost:3000
```

Serviços locais úteis:

| Serviço                                                                  | Endereço                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| App                                                                      | http://localhost:3000                                     |
| API do Supabase                                                          | http://127.0.0.1:54321                                    |
| Banco (psql)                                                             | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| **Mailpit** (todos os e-mails de cadastro, login e newsletter caem aqui) | http://127.0.0.1:54324                                    |
| Studio (se não tiver sido desligado)                                     | http://127.0.0.1:54323                                    |

### Contas de demonstração

Senha de todas: **`ciencia-delas-demo`** (dados fictícios — não use o seed em produção). Vale no banco local;
num projeto da nuvem preparado com `setup-supabase-cloud.mjs --with-demo-seed`, o script troca todas por senhas
aleatórias (as de `admin@` e `moderacao@` ficam no arquivo do `--write-env`; ver §4.1).

| Para testar                         | Conta                             |
| ----------------------------------- | --------------------------------- |
| Mentoranda com mentoria ativa       | `larissa@demo.cienciadelas.dev`   |
| Mentoranda com pedido pendente      | `yasmin@demo.cienciadelas.dev`    |
| Mentora (recebe pedidos)            | `marina@demo.cienciadelas.dev`    |
| Mentoria concluída com declaração   | `debora@demo.cienciadelas.dev`    |
| Moderadora                          | `moderacao@demo.cienciadelas.dev` |
| Administradora (newsletter, papéis) | `admin@demo.cienciadelas.dev`     |

A lista completa está em [`03-banco-de-dados.md` §15](03-banco-de-dados.md#15-contas-de-demonstração).

Com `DEMO_MODE=true` no servidor, `/demo` deixa entrar como Larissa, Marina ou Débora com um clique, sem
senha e sem e-mail ([`14-painel-e-modo-demo.md`](14-painel-e-modo-demo.md)). Use só na apresentação.

Para testar o fluxo completo de **cadastro**, crie uma conta nova em `/cadastro`: o e-mail de confirmação chega
no Mailpit; clique no link e você cai no onboarding.

> **App em outra porta?** O Supabase Auth local só aceita destinos em `http://localhost:3000` e
> `http://127.0.0.1:3000` (`additional_redirect_urls` no `supabase/config.toml`). Com o app em outra porta
> (por exemplo, `next start -p 3400`), os links de confirmação e de acesso apontam para a porta 3000: troque
> a porta no endereço do link antes de abrir. Se precisar disso sempre, inclua a porta em
> `additional_redirect_urls` e reinicie o Supabase (`npx supabase stop && npx supabase start`, sem apagar
> os dados). Não use curingas de porta: a lista de destinos permitidos também protege contra
> redirecionamentos para fora do site.

### Comandos do dia a dia

| Comando                             | O que faz                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                       | servidor de desenvolvimento                                  |
| `npm run check`                     | lint + typecheck + testes unitários                          |
| `npm test`                          | testes unitários (Vitest)                                    |
| `npm run db:test`                   | testes do banco (pgTAP: RLS, triggers, RPCs)                 |
| `npm run db:reset`                  | recria o banco local do zero (migrations + seeds)            |
| `npm run db:validate`               | migrations + seeds + pgTAP num banco novo, sem Docker        |
| `npm run db:types`                  | regenera `src/lib/database.types.ts` a partir do banco local |
| `npx supabase migration new <nome>` | cria uma migration nova                                      |
| `npm run ai:backfill`               | gera embeddings dos perfis (precisa de `GEMINI_API_KEY`)     |
| `npm run format`                    | formata o código (Prettier)                                  |

> Sem Docker? Dá para validar as migrations num Postgres 16 comum com `npm run db:validate`
> (ver [`03-banco-de-dados.md`](03-banco-de-dados.md)). O app, porém, precisa de um Supabase (local ou cloud).

## 3. Variáveis de ambiente

Todas estão documentadas em [`.env.example`](../.env.example). Resumo:

| Variável                               | Obrigatória?                                            | Onde conseguir                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | sim em produção                                         | URL pública do site (links de e-mail, redirects de login)                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`             | **sim**                                                 | `supabase status` ou Project Settings → API                                                                                                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **sim**                                                 | `sb_publishable_...` (ou a anon key legada)                                                                                                                                              |
| `SUPABASE_SECRET_KEY`                  | para newsletter, cron, exclusão de conta e painel admin | `sb_secret_...` (ou service_role legada) — **nunca** com `NEXT_PUBLIC_`                                                                                                                  |
| `GEMINI_API_KEY`                       | opcional (IA)                                           | https://aistudio.google.com/apikey — grátis, sem cartão                                                                                                                                  |
| `GROQ_API_KEY`                         | opcional (IA, fallback)                                 | https://console.groq.com/keys — grátis                                                                                                                                                   |
| `OPENROUTER_API_KEY`                   | opcional (IA, fallback)                                 | https://openrouter.ai/keys                                                                                                                                                               |
| `AI_PROVIDER`                          | opcional                                                | `gemini`, `groq`, `openrouter` ou `none`; vazio = primeira chave encontrada                                                                                                              |
| `RESEND_API_KEY`                       | opcional (envio da newsletter)                          | https://resend.com/api-keys                                                                                                                                                              |
| `NEWSLETTER_FROM`                      | com Resend                                              | remetente de um **domínio verificado** no Resend                                                                                                                                         |
| `NEWSLETTER_MAX_PER_RUN`               | opcional                                                | teto de e-mails por execução (padrão 90)                                                                                                                                                 |
| `CRON_SECRET`                          | sim em produção                                         | string aleatória longa (`openssl rand -hex 32`)                                                                                                                                          |
| `CONTACT_EMAIL`                        | opcional                                                | contato usado no User-Agent do Crossref                                                                                                                                                  |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`      | opcional                                                | `true` depois de configurar o Google no Supabase                                                                                                                                         |
| `DEMO_MODE`                            | só na apresentação                                      | `true` (exatamente) liga o `/demo`; **nunca** com membras de verdade; desligue (`false` ou apague) depois do evento. Só servidor                                                         |
| `DEMO_PASSWORD`                        | opcional (plano B do `/demo`)                           | senha das contas fictícias, usada só se faltar `SUPABASE_SECRET_KEY`. Só servidor, nunca `NEXT_PUBLIC_`. Não serve num banco preparado com `--with-demo-seed` (as senhas foram trocadas) |

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
   - **Ambiente de demonstração:** rode o arquivo inteiro (inclui as contas e dados fictícios) e depois os
     `supabase/seeds/*.sql`, em ordem (painel, reconhecimento, Pergunte, trajetória). O
     `scripts/deploy/setup-supabase-cloud.mjs --with-demo-seed --write-env` faz as duas coisas e, logo depois,
     troca a senha pública (`ciencia-delas-demo`) de **todas** as contas `@demo.cienciadelas.dev` por senhas
     aleatórias: as de `admin@` e `moderacao@` ficam só no arquivo do `--write-env` (`DEMO_ADMIN_PASSWORD`,
     `DEMO_MODERACAO_PASSWORD`), e as personas entram pelo `/demo` sem senha. Rodando o SQL à mão, troque você
     mesma a senha dessas duas contas (_Authentication → Users_): a senha do seed é pública.
3. **Authentication → URL Configuration**:
   - _Site URL_: `https://<seu-app>.vercel.app`
   - _Redirect URLs_: `https://<seu-app>.vercel.app/**` e, para previews, `https://*-<sua-conta>.vercel.app/**`
4. **Authentication → Email Templates**: cole o conteúdo de `supabase/templates/*.html` (confirmação, link mágico,
   recuperação, troca de e-mail, convite) e os assuntos que estão em `supabase/config.toml`. Os templates apontam
   para `/auth/confirm` com `token_hash` (fluxo PKCE recomendado para SSR).
5. **Authentication → Sign In / Providers → Email**: deixe "Confirm email" ligado; senha mínima 8.
6. (Opcional) **Google**: crie credenciais OAuth no Google Cloud, cole Client ID/Secret em _Providers → Google_,
   adicione `https://<PROJECT_REF>.supabase.co/auth/v1/callback` como URI de redirecionamento no Google e defina
   `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` na Vercel.
7. Gere os tipos a partir da nuvem quando mudar o schema: `SUPABASE_PROJECT_REF=<ref> npm run db:types:remote`.
8. Antes da apresentação, rode **Advisors → Security e Performance** no painel e confira que não há alertas
   críticos.

> O e-mail embutido do Supabase Free envia poucas mensagens por hora. Para um evento com muitas inscrições,
> configure SMTP próprio (pode ser o próprio Resend) em _Project Settings → Auth → SMTP_.

### 4.2 Vercel (plano Hobby)

1. Importe o repositório em https://vercel.com/new (framework detectado: Next.js).
2. Em _Settings → Environment Variables_, cadastre as variáveis da seção 3 (no mínimo as três do Supabase,
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
2. Verifique um domínio seu em _Domains_ (registros SPF e DKIM no DNS). Sem domínio verificado, o remetente de
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
- [ ] Seed de demonstração **não** aplicado em produção (ou contas demo removidas), nem os `supabase/seeds/*.sql`.
- [ ] Num projeto de demonstração acessível pela internet, nenhuma conta `@demo.cienciadelas.dev` com a senha do
      seed (o `--with-demo-seed` do script troca todas; as de `admin@`/`moderacao@` ficam no `--write-env`).
- [ ] `DEMO_MODE` desligado em produção (ligue só no ambiente da apresentação, durante o evento).
- [ ] `npm run check`, `npm run db:test` e `npm run build` passando.
- [ ] Advisors do Supabase sem alertas críticos.

## 6. Problemas comuns

| Sintoma                                           | Causa provável                                                           | Solução                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Faixa "Configure o Supabase" no topo              | `.env.local` sem URL/chave                                               | Seção 2                                                                                     |
| Cadastro não chega                                | Em dev o e-mail está no Mailpit; em produção, limite do SMTP do Supabase | Abra http://127.0.0.1:54324 ou configure SMTP                                               |
| Link do e-mail volta para `localhost` em produção | Site URL / Redirect URLs                                                 | Seção 4.1 passo 3                                                                           |
| `permission denied for table ...` (42501)         | Tentativa de ler/escrever algo que o RLS ou os GRANTs não permitem       | Esperado para dados de outras pessoas; para tabelas novas, declare os `GRANT`s na migration |
| Mentoria sem "Sugestão por IA"                    | Sem chave de IA, sem consentimento, ou cota gratuita esgotada (429)      | Modo heurístico continua funcionando; veja os logs do servidor                              |
| "Another next dev server is already running"      | Next 16 permite um `next dev` por pasta                                  | Feche o outro servidor ou rode `next build && next start -p 3001`                           |
| Tipos desatualizados após mudar o banco           | `database.types.ts` antigo                                               | `npm run db:types`                                                                          |

## 7. Integração contínua (GitHub Actions)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda a cada push e pull request (em
qualquer branch) e também sob demanda (_Actions → CI → Run workflow_; o botão só aparece depois que o workflow
chega ao branch padrão, `main`). Um push novo no mesmo branch (ou PR) cancela a execução anterior. O selo no topo
do README mostra o resultado da última execução no branch padrão (`main`), não a do seu branch.

| Job               | O que roda (na ordem)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App**           | `npm ci` → `npx prettier --check .` → `npx eslint --max-warnings 0` → `npx tsc --noEmit` → `npx vitest run` → `node --test scripts/deploy/*.test.mjs` → `npx next build` (Node 22)                                                                                                                                                                                                                                                                                                       |
| **Banco (pgTAP)** | CLI do Supabase 2.122.0 (`supabase/setup-cli`) → `supabase db start` (só o Postgres, com migrations, `seed.sql` e `supabase/seeds/*.sql`) → `supabase test db`                                                                                                                                                                                                                                                                                                                           |
| **Jornada E2E**   | Só depois do App passar: `npm ci` → CLI do Supabase 2.122.0 → `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor` → `.env.local` gerado de `supabase status -o env` → `npx next build` → `DEMO_MODE=true npx next start -p 3000` → `npx playwright install --with-deps chromium` → `BASE_URL=http://localhost:3000 node scripts/e2e/journey.mjs` → os roteiros `painel-demo.mjs` (com `DEMO=1`), `reconhecimento.mjs`, `pergunte.mjs` e `trajetoria.mjs` |

- O build do job App roda **sem nenhuma variável do app** de propósito: garante que a Artemis compila sem
  Supabase, IA ou e-mail configurados (as páginas mostram o aviso de configuração). Nenhum segredo é necessário no
  GitHub (nem para a jornada E2E, que usa só as chaves da stack local criada no próprio runner).
- Para reproduzir antes do push: `npx prettier --check .` (`npm run format` corrige),
  `npx eslint --max-warnings 0` (no CI, um aviso do ESLint já reprova; o `npm run lint` local só falha com erro),
  `npm run typecheck`, `npm test`, `node --test scripts/deploy/*.test.mjs`, `npm run build` e `npm run db:test`
  (com o Supabase local rodando). A jornada E2E está logo abaixo.
- Ao atualizar o CLI do Supabase em `package.json`, atualize também `version` nos jobs Banco e Jornada E2E.

### Jornada E2E no CI

O job `e2e` roda a jornada completa de [`scripts/e2e/journey.mjs`](../scripts/e2e/journey.mjs) (visitante,
cadastro com confirmação por e-mail, onboarding, mentoria e a conversa da mentoria, fórum, moderação, Boletim, Vitrine e a varredura de
telas claro/escuro × 1440/390 px) num build de produção, contra um Supabase local completo no runner. Tem limite
de 30 minutos.

- **Stack:** `supabase start` sem Studio, imgproxy, Edge Functions, Logflare, Vector, Realtime e Supavisor (o app
  não usa nenhum deles): ficam Postgres (migrations + `seed.sql` + `supabase/seeds/*.sql`), Auth, API, Storage e
  Mailpit. A CLI baixa as imagens do registro padrão.
- **Modo demonstração:** o `next start` do job roda com `DEMO_MODE=true`, para o `painel-demo.mjs` testar o
  `/demo`. Os outros roteiros usam contas separadas (reconhecimento: gabriela@ e aline@; Pergunte: visitante,
  moderacao@ e marina@; trajetória: larissa@, cujas marcas são restauradas no fim) e apagam ou restauram o que
  criam. A saída de cada um vai para `artemis-e2e/<roteiro>` dentro do artefato.
- **`.env.local` montado no próprio job:**

  | Variável do app                        | Valor                                                                                                                                         |
  | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
  | `NEXT_PUBLIC_SUPABASE_URL`             | `API_URL` de `supabase status -o env`                                                                                                         |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`                                                                                                                             |
  | `SUPABASE_SECRET_KEY`                  | `SECRET_KEY`                                                                                                                                  |
  | `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000`, o `site_url` do Auth local (`supabase/config.toml`); por isso o app sobe na porta 3000                               |
  | `CRON_SECRET`                          | aleatório a cada execução (`openssl rand -hex 32`)                                                                                            |
  | `MAILPIT_URL`                          | `http://127.0.0.1:54324`: num build de produção, os e-mails do próprio app (Boletim e confirmação da inscrição) só vão para o Mailpit com ela |

  Sem chave de IA nem de e-mail: a mentoria usa o modo por afinidade e o Mailpit faz o papel da caixa de entrada
  (a jornada lê os e-mails pela API dele e reescreve a origem dos links para `BASE_URL`).

- **Playwright** é devDependency com versão **fixa** (`playwright` em `package.json`, sem `^`); o job baixa o
  Chromium dessa versão e as bibliotecas do sistema com `npx playwright install --with-deps chromium`. Ao trocar a
  versão, rode a jornada localmente antes do push (`npx playwright install chromium` baixa o navegador novo).
- **Rede externa:** a única chamada é a busca do DOI no Crossref. Se ela falhar (rede, lentidão, Crossref fora do
  ar), a etapa da Vitrine preenche o paper à mão e segue; o resumo diz qual caminho foi usado.
- **Quando falha:** o script sai com código 1 (2 se faltar pré-requisito); cada etapa ou verificação com problema
  vira uma anotação de erro na execução, a tabela das etapas (com tempos) e os problemas vão para a aba _Summary_
  do job, o fim do log do `next start` aparece no passo "Log do servidor" e o artefato
  `e2e-capturas-<tentativa>` (14 dias, em _Actions → a execução → Artifacts_) traz a pasta de saída da jornada
  (`falhas/` com captura e árvore de acessibilidade da etapa que quebrou, `capturas/`, galeria `index.html` e
  `report.json`) e o `next-start.log`.
- **Reproduzir localmente, igual ao CI** (na raiz; uma execução por vez, porque o Boletim da semana é gerado e
  enviado de verdade):

  ```bash
  npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor
  npx playwright install chromium   # uma vez por versão do Playwright
  MAILPIT_URL=http://127.0.0.1:54324 npx next build
  DEMO_MODE=true MAILPIT_URL=http://127.0.0.1:54324 npx next start -p 3000   # deixe rodando; o resto em outro terminal
  BASE_URL=http://localhost:3000 node scripts/e2e/journey.mjs
  # roteiros das funcionalidades (o painel-demo precisa do servidor com DEMO_MODE=true):
  DEMO=1 BASE_URL=http://localhost:3000 node scripts/e2e/painel-demo.mjs
  for s in reconhecimento pergunte trajetoria; do BASE_URL=http://localhost:3000 node scripts/e2e/$s.mjs; done
  ```

  Com a porta 3000 ocupada (por exemplo, pelo `npm run dev`), use outra porta em `next start` e em `BASE_URL`:
  os links dos e-mails são reescritos para `BASE_URL`. A pasta de saída é `OUT_DIR` (padrão: pasta temporária do
  sistema); as demais opções (`SKIP_SWEEP=1`, `KEEP_DATA=1`, `HEADED=1`…) estão no topo do script.
