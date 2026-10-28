# Próximos passos — publicar a Artemis

> Documento de passagem (handoff). Tudo o que dependia só do código está pronto e testado contra um Supabase
> local. O que falta depende de **contas da equipe** (Supabase, Vercel e a chave de IA), que só vocês podem criar.

## O que já está pronto

- App completo (Next.js 16 + Supabase): autenticação, onboarding, perfis, diretório, fórum com anonimato,
  mentoria com IA (com modo por afinidade quando a IA não está disponível), Vitrine Delas, ranking, Boletim
  Delas, notificações, moderação com auditoria, design system.
- Banco: migrations com RLS e GRANTs explícitos, seed de demonstração, testes pgTAP.
- Testes: unitários (Vitest), banco (pgTAP), jornada completa no navegador (`scripts/e2e/journey.mjs`).
- Documentação em `docs/` e decisões em `docs/adr/`.

## O que falta (precisa de vocês)

### 1. Supabase Cloud (grátis)

1. Criar conta e projeto em https://supabase.com/dashboard (região **South America (São Paulo)**).
   Anotar a **senha do banco** definida na criação.
2. Criar um **Personal Access Token** em https://supabase.com/dashboard/account/tokens.
3. Pegar o **Project ref** (Project Settings → General; é o código do endereço `https://<ref>.supabase.co`).
4. Escolher um caminho:
   - **Eu (Claude) configuro:** cadastrar no ambiente da sessão (menu do ambiente na barra de título → Edit →
     variáveis de ambiente/segredos) as variáveis abaixo e abrir uma **sessão nova** neste branch.
     Nunca colar tokens no chat.

     | Variável                | Valor                   |
     | ----------------------- | ----------------------- |
     | `SUPABASE_ACCESS_TOKEN` | o Personal Access Token |
     | `SUPABASE_PROJECT_REF`  | o Project ref           |
     | `SUPABASE_DB_PASSWORD`  | a senha do banco        |

     O token precisa das permissões listadas em [`scripts/deploy/README.md`](../scripts/deploy/README.md) §1
     (tokens escopados viraram padrão no painel). Depois é só pedir: "configure o Supabase Cloud com o script de
     deploy". Na sessão na nuvem o comando é
     `NODE_USE_ENV_PROXY=1 node scripts/deploy/setup-supabase-cloud.mjs --site-url=https://<app>.vercel.app --migrations-via-api --write-env`
     (o sandbox não abre conexão direta com o Postgres, por isso as migrations vão por HTTPS).

   - **Vocês configuram:** seguir [`07-setup-e-deploy.md`](07-setup-e-deploy.md) §4.1 ou rodar o script
     `scripts/deploy/setup-supabase-cloud.mjs` (instruções no topo do arquivo).

### 1b. Decisão: e-mails de cadastro

O SMTP padrão do Supabase **só entrega e-mails para membros do time do projeto** (cerca de 2 por hora). Escolham:

- **Demo do hackathon, sem domínio:** rodar o script com `--auto-confirm-email` — qualquer pessoa cria conta sem
  confirmar o e-mail (link mágico e recuperação de senha ainda precisam de e-mail).
- **Site aberto ao público:** domínio verificado no Resend (grátis) usado como SMTP (`SMTP_*`, ver
  `scripts/deploy/README.md` §4) — confirmação de e-mail continua ligada.

### 2. Chave de IA (grátis)

1. Criar a chave em https://aistudio.google.com/apikey (conta Google, sem cartão).
2. Cadastrar como `GEMINI_API_KEY` no ambiente da sessão (para eu testar o caminho com IA de verdade e gerar os
   embeddings dos perfis) **e** na Vercel (para o site publicado).
3. Opcional, reserva: `GROQ_API_KEY` (https://console.groq.com/keys).

> Plano gratuito do Gemini: o Google pode usar os dados enviados para melhorar produtos e exige 18+.
> O app já pede consentimento e não envia nome, e-mail nem links.

### 3. Vercel (grátis)

1. Importar o repositório em https://vercel.com/new (branch `claude/plataforma-ciencia-delas` ou `main`
   depois do merge).
2. Cadastrar as variáveis que o script do Supabase imprime no final (URL, chave publicável, chave secreta) mais
   `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` e `GEMINI_API_KEY`.
3. Opcional: para eu fazer o deploy, `VERCEL_TOKEN` (https://vercel.com/account/tokens) no ambiente da sessão.

### 4. Antes da apresentação

- [ ] Preencher contato da controladora/encarregada de dados em `/privacidade` e a equipe em `/sobre`.
- [ ] Decidir se o site público usa as contas de demonstração (seed) ou começa vazio.
- [ ] Opcional: domínio verificado no Resend para o Boletim chegar a todas as inscritas
      (sem isso, o Boletim fica publicado no site).
- [ ] Revisar os textos de `/conduta` com a equipe.

## Contas usadas até aqui

- **Supabase:** nenhuma. Todo o desenvolvimento usou o Supabase **local** (Docker, `npx supabase start`), com as
  chaves padrão de desenvolvimento que o CLI gera.
- **IA:** nenhuma chave. O código de IA foi testado com respostas simuladas; o app rodou no modo por afinidade.
- **GitHub:** só a integração da sessão, para enviar commits a este branch.
