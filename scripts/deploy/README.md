# Deploy: Supabase Cloud (+ Vercel)

`setup-supabase-cloud.mjs` configura um projeto **novo** do Supabase Cloud para o app em um comando:
migrations, dados de referência, Auth (URLs, confirmação de e-mail, senha mínima, modelos de e-mail em pt-BR),
bucket de avatares e chaves da API. Opcionalmente grava as variáveis num arquivo local e cadastra tudo na
Vercel. Pode ser rodado de novo quantas vezes quiser: todos os passos são idempotentes.

Tudo usa planos gratuitos (Supabase Free e Vercel Hobby). Node 22+, sem dependências novas: o script usa o
`fetch` do Node e o CLI do Supabase que já vem no projeto (`npx supabase`).

## 1. O que você precisa

| O quê                                                                      | Onde conseguir                                                          | Variável                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| Projeto no Supabase (região **South America (São Paulo)**)                 | https://supabase.com/dashboard → _New project_                          | —                                |
| **Personal Access Token** do Supabase                                      | https://supabase.com/dashboard/account/tokens → _Generate new token_    | `SUPABASE_ACCESS_TOKEN`          |
| **Project ref** (20 letras; também aparece em `https://<ref>.supabase.co`) | _Project Settings → General → Project ID_                               | `SUPABASE_PROJECT_REF`           |
| **Senha do banco** (a que você definiu ao criar o projeto)                 | se esqueceu: _Project Settings → Database → Reset database password_    | `SUPABASE_DB_PASSWORD`           |
| URL pública do site                                                        | ex.: `https://seu-app.vercel.app` (pode ser a URL que a Vercel vai dar) | flag `--site-url`                |
| (Opcional) Token da Vercel                                                 | https://vercel.com/account/tokens                                       | `VERCEL_TOKEN`                   |
| (Opcional) Time da Vercel                                                  | _Team Settings → General → Team ID_ (`team_...`) ou o slug do time      | `VERCEL_TEAM_ID`                 |
| (Opcional) Projeto da Vercel                                               | nome ou id do projeto já importado (padrão: o `name` do `package.json`) | `VERCEL_PROJECT`                 |
| (Opcional) Chaves de IA                                                    | https://aistudio.google.com/apikey · https://console.groq.com/keys      | `GEMINI_API_KEY`, `GROQ_API_KEY` |

> Não cole o token em chats nem em issues; guarde num arquivo `.env*` (ignorado pelo git) ou nos segredos do
> ambiente e revogue depois de usar, se quiser.

### Permissões do token (tokens escopados)

Desde outubro de 2026, os tokens criados em _Account → Access Tokens_ são **escopados**: você escolhe projetos,
permissões (Read / Read-write) e validade, e não dá para mudar depois (só apagar e criar outro). Para este script,
crie o token **só para o projeto do app**, com:

| Permissão no painel  | Nível      | Para quê                                                                       |
| -------------------- | ---------- | ------------------------------------------------------------------------------ |
| Project Settings     | Read-write | conferir o projeto; o `PATCH` do Auth exige Project Settings + Auth Config     |
| Auth Config          | Read-write | `site_url`, Redirect URLs, confirmação de e-mail, modelos, SMTP                |
| Database             | Read-write | migrations por HTTPS, dados de referência, bucket (SQL pela API)               |
| Storage              | Read       | conferir o bucket `avatars`                                                    |
| API Keys             | Read-write | listar e, se faltar, criar as chaves publishable/secret                        |
| API Key Secrets      | Read       | revelar as chaves para gravar no `.env` e na Vercel                            |
| Connection Pooling   | Read       | `supabase link`/`db push` (só sem `--migrations-via-api`)                      |
| Production Branches  | Read       | `supabase link` pode pedir (só sem `--migrations-via-api`)                     |

Se faltar alguma, a API responde **403** e o script mostra as permissões que faltam (campo `missing_permissions`).
Alternativa mais simples (e mais ampla): _Create legacy token_, que tem o acesso total da sua conta.
Referências: https://supabase.com/docs/guides/platform/personal-access-tokens e
https://supabase.com/changelog/scoped-personal-access-tokens-ga.

## 2. Como rodar

Na raiz do repositório, depois de `npm install`:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
export SUPABASE_PROJECT_REF=abcdefghijklmnopqrst
export SUPABASE_DB_PASSWORD='a-senha-do-banco'

# 1) Simulação: não altera nada. Com token, só faz leituras (GET) para conferir o acesso.
node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --dry-run

# 2) Para valer, gravando as variáveis em .env.cloud (ignorado pelo git, permissão 600)
node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --write-env

# 3) (Opcional) Também cadastrando as variáveis na Vercel
export VERCEL_TOKEN=...            # e, se o projeto for de um time, VERCEL_TEAM_ID=team_...
node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --write-env --vercel
```

Prefere não exportar no terminal? Coloque as variáveis num arquivo `.env.deploy` (o `.gitignore` já ignora
`.env*`) e use o carregador do próprio Node:

```bash
node --env-file=.env.deploy scripts/deploy/setup-supabase-cloud.mjs --site-url=https://seu-app.vercel.app --write-env
```

Esse jeito funciona igual no Windows (PowerShell ou cmd), no macOS e no Linux. No PowerShell, o equivalente ao
`export` é `$env:SUPABASE_ACCESS_TOKEN = "sbp_..."`. O script chama o CLI do Supabase instalado em
`node_modules` direto pelo Node (sem shell e sem depender do `npx` no PATH); só sem o `npm install` ele cai
para `npx supabase`.

As flags liga/desliga (`--dry-run`, `--vercel`, `--with-demo-seed`, `--migrations-via-api`) não aceitam valor:
`--with-demo-seed=false` é recusado com erro, em vez de ligar a flag sem querer.

### Numa sessão na nuvem (rede só HTTPS, atrás de proxy)

Algumas redes (como as sessões do Claude Code na nuvem) só liberam HTTPS por um proxy: o `supabase db push`
não consegue abrir a conexão TCP com o Postgres e o `fetch` do Node ignora o proxy por padrão. Nesse caso:

```bash
NODE_USE_ENV_PROXY=1 node scripts/deploy/setup-supabase-cloud.mjs \
  --site-url=https://seu-app.vercel.app --migrations-via-api --write-env
```

`NODE_USE_ENV_PROXY=1` (Node 22.21+) faz o `fetch` usar `HTTPS_PROXY`. Com `--migrations-via-api` tudo vai por
HTTPS e a senha do banco não é usada.

### Flags

| Flag                       | O que faz                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--site-url=<https://...>` | **obrigatória.** URL pública do site (vira o _Site URL_ do Auth e `NEXT_PUBLIC_SITE_URL`)                                                                                                                                                                       |
| `--dry-run`                | simula tudo. Sem token: offline. Com token: só leituras (`GET` e SQL pelo endpoint somente leitura). Nada é gravado em lugar nenhum                                                                                                                             |
| `--write-env[=<arquivo>]`  | grava as variáveis do app num arquivo `.env*` dentro do repositório (padrão `.env.cloud`)                                                                                                                                                                       |
| `--vercel`                 | cadastra as variáveis na Vercel (precisa de `VERCEL_TOKEN`; sem ele, imprime a lista para cadastro manual)                                                                                                                                                      |
| `--redirect-url=<url>`     | acrescenta uma _Redirect URL_ (repetível). Ex.: previews da Vercel: `--redirect-url='https://*-sua-conta.vercel.app/**'`                                                                                                                                        |
| `--migrations-via-api`     | aplica as migrations por **HTTPS** (API de gerenciamento) em vez de `supabase link` + `db push`. Use em redes que não liberam conexão TCP com o Postgres (portas 5432/6543), como sessões na nuvem atrás de proxy. Registra o histórico no mesmo formato do CLI |
| `--with-demo-seed`         | aplica o `seed.sql` **inteiro**, com contas **fictícias** e senha **pública**. Só para um projeto de demonstração                                                                                                                                               |
| `--help`                   | ajuda                                                                                                                                                                                                                                                           |

> **Por que `.env.cloud` e não `.env.production.local`?** O Next.js carrega `.env.production.local` sozinho em
> qualquer `next build`/`next start` local (inclusive nos testes E2E), que passariam a usar o banco de produção.
> O `.env.cloud` não é carregado automaticamente; use-o quando quiser de propósito, por exemplo
> `node --env-file=.env.cloud ...`. O script aceita outro nome `.env*`, mas avisa quando o Next.js o carregaria.

## 3. O que cada passo faz

| #   | Passo                                                                                                                                                                                                                                                                                                                                                                                                                       | Como                                                                                                                                                                                              | Em `--dry-run`                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Confere o projeto: acesso, nome, região e status (falha com mensagem clara em 401/403/404 ou projeto pausado)                                                                                                                                                                                                                                                                                                               | `GET /v1/projects/{ref}`                                                                                                                                                                          | executa (leitura)                                                           |
| 2   | Liga o CLI ao projeto e aplica as migrations (tabelas, RLS, funções, bucket `avatars`)                                                                                                                                                                                                                                                                                                                                      | `npx supabase link --project-ref <ref>` e `npx supabase db push --linked --yes`, com `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` **no ambiente** (a senha não aparece na lista de processos) | só imprime os comandos                                                      |
| 2′  | (com `--migrations-via-api`) Lê o histórico `supabase_migrations.schema_migrations`, aplica só as migrations pendentes — cada arquivo numa única requisição, que roda como **uma transação** (se falhar, nada fica aplicado nem registrado) — e registra `version`, `name` e `statements` como o CLI faz. Um `supabase db push` depois reconhece tudo como aplicado                                                         | `POST /v1/projects/{ref}/database/query`                                                                                                                                                          | lê o histórico por `POST .../database/query/read-only` e lista as pendentes |
| 3   | Aplica os **dados de referência** (64 áreas de pesquisa e 8 categorias do fórum), extraídos do `supabase/seed.sql` entre os marcadores `-- 1. Áreas de pesquisa` e `-- 2. DEMONSTRAÇÃO`. O script confere que todo `INSERT` tem `ON CONFLICT` antes de enviar. Com `--with-demo-seed`, envia o `seed.sql` inteiro — só se a conta de demonstração ainda não existir                                                         | `POST /v1/projects/{ref}/database/query` (se esse endpoint _beta_ sumir, cai para `npx supabase db query --linked --file`)                                                                        | só mostra o tamanho                                                         |
| 4   | Configura o Auth: `site_url`; `uri_allow_list` (mantém as que existem e acrescenta `<site>/**` + `--redirect-url`); confirmação de e-mail ligada (`mailer_autoconfirm=false`); senha mínima 8; os **5 modelos** pt-BR (`confirmation`, `magic_link`, `recovery`, `email_change`, `invite`) com os assuntos do `supabase/config.toml` e o HTML de `supabase/templates/*.html`; SMTP próprio, se `SMTP_*` estiverem definidas | `GET` e `PATCH /v1/projects/{ref}/config/auth`                                                                                                                                                    | lê a config atual e mostra o que seria enviado                              |
| 5   | Confere o bucket público `avatars` (se faltar, aplica o `INSERT` idempotente da migration de storage)                                                                                                                                                                                                                                                                                                                       | `GET /v1/projects/{ref}/storage/buckets`                                                                                                                                                          | executa (leitura)                                                           |
| 6   | Obtém as chaves: prefere as novas (`sb_publishable_...`/`sb_secret_...`); se não existirem, cria; se não der, usa as legadas (`anon`/`service_role`, que o Supabase vai desativar até o fim de 2026)                                                                                                                                                                                                                        | `GET /v1/projects/{ref}/api-keys?reveal=true` e, se preciso, `POST /v1/projects/{ref}/api-keys?reveal=true`                                                                                       | lê sem revelar (`reveal=false`)                                             |
| 7   | Monta as variáveis do app e, com `--write-env`, grava o arquivo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (reaproveitado do ambiente ou do arquivo; senão, 32 bytes aleatórios em hex). Outras linhas do arquivo são preservadas                                                                                                    | arquivo local, permissão 600, conferido com `git check-ignore`                                                                                                                                    | mostra mascarado, não grava                                                 |
| 8   | Com `--vercel` + `VERCEL_TOKEN`: confere o projeto e faz _upsert_ das variáveis acima (+ `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `NEWSLETTER_FROM` se existirem no seu ambiente) em **Production** e **Preview**. `NEXT_PUBLIC_*` vão como _Config_ (`encrypted`); chaves e senhas como _Secret_ (`sensitive`). Depois imprime como fazer o novo deploy                                   | `GET /v9/projects/{idOrName}` e `POST /v10/projects/{idOrName}/env?upsert=true`                                                                                                                   | só a leitura do projeto                                                     |
| 9   | Checklist: o que foi feito e o que falta                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                                 | —                                                                           |

## 4. Depois do script (o que continua manual)

1. **Deploy na Vercel.** As `NEXT_PUBLIC_*` entram no build: depois de cadastrar as variáveis, faça um novo deploy
   (_Deployments → ⋯ → Redeploy_, um `git push` na branch de produção ou `npx vercel deploy --prod`).
2. **SMTP próprio (importante).** Sem SMTP próprio, o Supabase só entrega e-mails de Auth para **membros do time do
   projeto** e com limite de cerca de 2 por hora; quem é de fora **não recebe** a confirmação de cadastro.
   Para abrir o site ao público, configure um SMTP (ex.: Resend com domínio verificado) e rode o script de novo
   com as variáveis abaixo, ou cole em _Authentication → Emails → SMTP Settings_:

   ```bash
   export SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend
   export SMTP_PASS="$RESEND_API_KEY" SMTP_ADMIN_EMAIL=nao-responda@seu-dominio SMTP_SENDER_NAME=Artemis
   ```

   Enquanto isso, a dona do projeto (membro do time) consegue criar a própria conta normalmente.

3. **Primeira administradora.** Crie sua conta no site publicado e rode no _SQL Editor_:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```

4. **(Opcional) Google.** _Authentication → Sign In / Providers → Google_ (Client ID/Secret do Google Cloud), com
   `https://<ref>.supabase.co/auth/v1/callback` como URI de redirecionamento no Google; depois
   `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` na Vercel.
5. **(Opcional) Resend** com domínio verificado para o Boletim chegar a todas as inscritas
   (`RESEND_API_KEY`, `NEWSLETTER_FROM`). Sem isso, as edições ficam publicadas no site.
6. **(Opcional) Previews:** rode de novo com `--redirect-url='https://*-sua-conta.vercel.app/**'`.
7. Rode _Advisors → Security_ e _Performance_ no painel do Supabase.
8. Embeddings dos perfis já existentes (com `GEMINI_API_KEY` definida):
   `(set -a; . ./.env.cloud; set +a; npm run ai:backfill)` — o backfill não sobrescreve variáveis que já
   estão no ambiente, então as do `.env.cloud` têm prioridade sobre o `.env.local`.

Guia geral do deploy: [`docs/07-setup-e-deploy.md`](../../docs/07-setup-e-deploy.md).

## 5. Segurança

- **Nenhum segredo é impresso.** Token, senha do banco, chaves, `CRON_SECRET` e chaves de IA aparecem mascarados
  (só o prefixo e o tamanho, ex.: `sb_secret_****(41 caracteres)`); toda a saída passa por um filtro que troca
  qualquer segredo conhecido pela versão mascarada.
- A senha do banco vai para o CLI pela variável de ambiente `SUPABASE_DB_PASSWORD`, não pela linha de comando.
- O arquivo de `--write-env` precisa se chamar `.env*`, ficar dentro do repositório e estar no `.gitignore`
  (o script confere com `git check-ignore` e recusa caso contrário). É gravado com permissão 600.
- `--dry-run` nunca escreve: nem no Supabase, nem na Vercel, nem no disco; e não pede as chaves reveladas.
- `--with-demo-seed` cria contas **fictícias** com a senha **pública** documentada no repositório. Nunca use num
  site aberto ao público; se usou, apague as contas de demonstração antes de divulgar.
- Pode rodar de novo: migrations já aplicadas são puladas, os `INSERT`s têm `ON CONFLICT`, o Auth é um `PATCH`, as
  variáveis da Vercel usam `upsert=true` e o `CRON_SECRET` existente é reaproveitado.
- Os erros da API mostram só o status e a mensagem do serviço (já filtrados); valores das variáveis nunca são
  repetidos na saída.

## 6. Testes

```bash
node --test scripts/deploy/*.test.mjs
```

Cobrem as funções puras (flags, `config.toml`, recorte do `seed.sql`, payload do Auth, máscaras, arquivo `.env`,
variáveis da Vercel) e o fluxo completo com `fetch` e CLI simulados (simulação offline e com token, execução
completa, 401/404, projeto pausado, falha no `link`, seed de demonstração, criação de chaves, bucket ausente,
fallback do SQL pelo CLI, erros da Vercel, migrations por HTTPS: projeto novo, reexecução, migration com erro,
histórico divergente, simulação somente leitura e dica de proxy; 403 de token escopado, flags booleanas com
valor, chamada do CLI no Windows/macOS/Linux e execução direta do script, inclusive por symlink). Usam
`node:test` porque o `vitest.config.ts` do app só inclui `src/**`.

O caminho `--migrations-via-api` também foi conferido num Postgres 16 local (com o stub de
`scripts/db/supabase-stub.sql`): as 12 migrations aplicadas uma a uma no formato exato que o script envia
(uma mensagem por arquivo), dados de referência reaplicados sem duplicar (64/8), migration com erro desfeita
sem deixar tabela nem histórico, e o próprio CLI 2.122 (`supabase migration list` e `db push --dry-run`)
reconhecendo todas como aplicadas ("Remote database is up to date").

## 7. Problemas comuns

| Sintoma                                                      | Causa provável                                | O que fazer                                                                     |
| ------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `token do Supabase inválido ou expirado (401)`               | token errado/revogado                         | gere outro em https://supabase.com/dashboard/account/tokens                     |
| `projeto não encontrado (404)`                               | ref errado ou token de outra conta            | confira _Project Settings → General_                                            |
| `sem permissão (403). Faltam no token: ...`                  | token escopado sem alguma permissão           | crie outro token com a tabela da seção 1 (não dá para editar um token)          |
| `O projeto está pausado`                                     | projetos Free pausam após um tempo sem uso    | _Restore project_ no painel e rode de novo                                      |
| `"supabase link" falhou`                                     | senha do banco errada                         | _Project Settings → Database → Reset database password_                         |
| `"supabase db push" falhou` com migrations fora do histórico | o banco remoto foi alterado à mão             | `npx supabase migration list` e, se for o caso, `npx supabase migration repair` |
| Cadastro não recebe e-mail                                   | SMTP padrão só entrega para o time do projeto | seção 4, item 2                                                                 |
| Variáveis novas não aparecem no site                         | build antigo                                  | novo deploy na Vercel                                                           |

## 8. Referências (conferidas em 28/10/2026)

- API de gerenciamento do Supabase: https://supabase.com/docs/reference/api (spec: https://api.supabase.com/api/v1-json)
  — [`v1-get-project`](https://supabase.com/docs/reference/api/v1-get-project),
  [`v1-run-a-query`](https://supabase.com/docs/reference/api/v1-run-a-query),
  [`v1-update-auth-service-config`](https://supabase.com/docs/reference/api/v1-update-auth-service-config),
  [`v1-list-all-buckets`](https://supabase.com/docs/reference/api/v1-list-all-buckets),
  [`v1-get-project-api-keys`](https://supabase.com/docs/reference/api/v1-get-project-api-keys),
  [`v1-create-project-api-key`](https://supabase.com/docs/reference/api/v1-create-project-api-key),
  [`v1-read-only-query`](https://supabase.com/docs/reference/api/v1-read-only-query)
- Modelos de e-mail pela API: https://supabase.com/docs/guides/auth/auth-email-templates
- SMTP padrão e limites: https://supabase.com/docs/guides/auth/auth-smtp
- Redirect URLs e curingas da Vercel: https://supabase.com/docs/guides/auth/redirect-urls
- Chaves da API (publishable/secret e legadas): https://supabase.com/docs/guides/api/api-keys
- CLI: https://supabase.com/docs/reference/cli/supabase-link,
  https://supabase.com/docs/reference/cli/supabase-db-push e
  https://supabase.com/docs/guides/deployment/managing-environments (variáveis `SUPABASE_ACCESS_TOKEN` e
  `SUPABASE_DB_PASSWORD`)
- Vercel: https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables,
  https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name e
  https://vercel.com/docs/environment-variables/sensitive-environment-variables
- Resend como SMTP do Supabase: https://resend.com/docs/send-with-supabase-smtp
