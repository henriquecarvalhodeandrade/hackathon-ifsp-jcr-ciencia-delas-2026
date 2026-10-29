# Próximos passos — publicar a Artemis

> Documento de passagem (handoff). Tudo o que dependia só do código está pronto e testado contra um Supabase
> local, inclusive a IA com a chave do Gemini da equipe. O que falta depende de **contas da equipe** (Supabase e
> Vercel), que só vocês podem criar.

## O que já está pronto

- App completo (Next.js 16 + Supabase): autenticação, onboarding, perfis, diretório, fórum com anonimato,
  mentoria com IA (com modo por afinidade quando a IA não está disponível), Vitrine Delas, ranking, Boletim
  Delas, notificações, moderação com auditoria, design system.
- **Quatro funcionalidades da história do pitch** ("da primeira curiosidade à mentoria reconhecida"), todas
  sem nenhuma chave de IA:
  - **Pergunte a uma cientista** (`/pergunte`): estudantes perguntam sem conta e sem nome; a moderação publica
    (aba Perguntas do `/admin`) e cientistas da rede respondem em público — [16](16-pergunte-a-uma-cientista.md).
  - **Afinidade de trajetória:** marcas opcionais no perfil viram "Vocês têm em comum: as duas foram as
    primeiras da família na universidade" nas sugestões de mentoras, um filtro no diretório e uma seção no
    perfil — [17](17-afinidade-de-trajetoria.md).
  - **Meu painel** (`/painel`): o início de quem já é da rede (login sem destino e a `/` de quem tem perfil
    completo vão para lá) e o **modo demonstração** (`/demo`, só com `DEMO_MODE=true`): entrar como Larissa,
    Marina ou Débora com um clique, roteiro de 3 minutos e QR code para o slide —
    [14](14-painel-e-modo-demo.md).
  - **Reconhecimento da mentoria:** ao concluir, retorno privado, declaração de participação com QR code
    verificável em `/verificar` e impacto agregado na landing (só a partir de 5 retornos) —
    [15](15-reconhecimento-da-mentoria.md).
- **Conversa da mentoria** em `/mentoria/conversa/<pedido>`: depois do aceite, mentora e mentoranda trocam
  mensagens pela plataforma (botão "Conversar" com o número de não lidas, aviso agrupado por conversa, recibo
  "Enviada"/"Lida", atualização a cada 15 s com a aba visível). Concluída ou cancelada, fica só para leitura.
  É privada até para a moderação (quem está de fora recebe 404) e tem limite de 60 mensagens por hora —
  [12 §4](12-mentoria-fluxos.md#4-conversa-da-mentoria). Denunciar uma mensagem específica ainda não existe
  (por enquanto, "Denunciar perfil").
- **Busca sem acento** e sem diferença de maiúsculas no fórum, na Vitrine e no diretório ("Jacarei" encontra
  "Jacareí"; cada palavra precisa aparecer em algum campo) — [03](03-banco-de-dados.md#busca-sem-acento-search_text).
- **Importar do ORCID** em `/papers/novo`: lista as publicações públicas do ORCID iD (o do perfil já vem
  preenchido) e preenche o formulário, pelo Crossref quando há DOI. API pública, sem chave —
  [05](05-papers-e-ranking.md#12-importar-do-orcid).
- **Baixar meus dados** (LGPD, portabilidade) em `/perfil#dados`: um JSON com tudo o que é da membra, inclusive
  as publicações anônimas e as conversas da mentoria — [11](11-perfis-e-autenticacao.md#baixar-meus-dados-portabilidade).
- **Instalável no celular (PWA):** manifesto e ícones; sem modo offline (README, "Instalar no celular").
- Segurança: **limites anti-spam no banco** por pessoa (tópicos, respostas, comentários, papers, destaques,
  denúncias, pedidos e mensagens da mentoria — valem também pela API); **auditoria** de toda ação da moderação, inclusive
  exclusões feitas em qualquer tela; avatares só do Storage do projeto; **cabeçalhos de segurança HTTP**
  (anti-clickjacking, `nosniff`, HSTS…) — [09](09-moderacao-e-seguranca.md#10-checklist-de-segurança).
- Banco: migrations com RLS e GRANTs explícitos, seeds de demonstração (`supabase/seed.sql` e
  `supabase/seeds/*.sql`, aplicados juntos pelo `config.toml`), testes pgTAP.
- Testes: unitários (Vitest), banco (pgTAP), jornada completa no navegador (`scripts/e2e/journey.mjs`, com
  Playwright: cadastro, onboarding, mentoria e conversa, fórum, moderação, Boletim, Vitrine e a varredura de
  telas claro/escuro × 1440/390 px, inclusive `/painel`, `/pergunte` e `/verificar`) e um roteiro por
  funcionalidade nova (`painel-demo`, `reconhecimento`, `pergunte`, `trajetoria`).
- **CI no GitHub Actions** (`.github/workflows/ci.yml`): a cada push e pull request roda formatação, lint, tipos,
  testes unitários, testes do script de deploy, build e pgTAP e, depois, a **jornada E2E** num build de produção
  contra um Supabase local completo no próprio runner (se falhar, as capturas ficam como artefato) —
  [07 §7](07-setup-e-deploy.md#7-integração-contínua-github-actions). Os três jobs (App, Banco e Jornada E2E) já
  rodaram de verdade no GitHub e passaram — a jornada leva cerca de 4 minutos no runner. Na primeira execução,
  a jornada pegou uma quebra de 7 px no `/design-system` no celular, já corrigida.
- **IA validada com a API real** (28/10/2026, chave da equipe, só dados fictícios do seed): embeddings
  (`gemini-embedding-2`, 768 dimensões) dos perfis com consentimento, sugestões de mentoras explicadas pelo
  `gemini-3.5-flash-lite` (cerca de 4 s), resumo acessível da Vitrine e abertura do Boletim (cerca de 1 s),
  revogação do consentimento e as falhas (chave inválida, tempo esgotado, cota) caindo nas regras com aviso.
  A validação achou e corrigiu respostas sem acentos, a voz das autoras no resumo e a faixa de similaridade, que
  foi calibrada — [04 §4.1 e §15](04-mentoria-com-ia.md#15-validação-com-a-api-real-28102026).
- Documentação em `docs/` e decisões em `docs/adr/`.

## O que falta (precisa de vocês)

### 1. Supabase Cloud (grátis)

> **Feito em 28/10/2026:** projeto `artemis` (South America · São Paulo, plano gratuito) na conta pessoal da equipe,
> configurado pelo script com `--site-url=http://localhost:3000 --migrations-via-api --with-demo-seed
--auto-confirm-email --write-env`: as 24 migrations, os dados de demonstração (senhas das contas fictícias trocadas
> por aleatórias), o Auth (cadastro sem confirmar e-mail, login aceitando `localhost:3000`), o bucket de avatares e os
> embeddings dos 19 perfis de demonstração (`npm run ai:backfill`). Testado com o app apontando para a nuvem: páginas,
> `/demo` e sugestões com IA (Gemini). Para rodar no computador **sem Docker**: copiar as variáveis do `.env.cloud`
> (URL, chave publicável, chave secreta, `CRON_SECRET`) mais `GEMINI_API_KEY` e `DEMO_MODE=true` para o `.env.local`
> e rodar `npm run dev`.
>
> **Plano gratuito:** sem SMTP próprio o Supabase não aceita os modelos de e-mail em português; os e-mails de link
> mágico e recuperação saem no modelo padrão (em inglês) até configurar SMTP (seção 1b).
>
> **Quando a Vercel existir:** rodar o script de novo com `--site-url=https://<app>.vercel.app
--redirect-url='http://localhost:3000/**'` (com um token novo; o usado no setup deve ser revogado).

O passo a passo abaixo serve para refazer em outro projeto.

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
     (o sandbox não abre conexão direta com o Postgres, por isso as migrations vão por HTTPS). Para o banco da
     apresentação, acrescente `--with-demo-seed` (ele exige `--write-env`; ver §4).

   - **Vocês configuram:** seguir [`07-setup-e-deploy.md`](07-setup-e-deploy.md) §4.1 ou rodar o script
     `scripts/deploy/setup-supabase-cloud.mjs` (instruções no topo do arquivo).

### 1b. Decisão: e-mails de cadastro

O SMTP padrão do Supabase **só entrega e-mails para membros do time do projeto** (cerca de 2 por hora). Escolham:

- **Demo do hackathon, sem domínio:** rodar o script com `--auto-confirm-email` — qualquer pessoa cria conta sem
  confirmar o e-mail (link mágico e recuperação de senha ainda precisam de e-mail).
- **Site aberto ao público:** domínio verificado no Resend (grátis) usado como SMTP (`SMTP_*`, ver
  `scripts/deploy/README.md` §4) — confirmação de e-mail continua ligada.

### 2. Chave de IA (grátis)

A equipe já forneceu uma chave do Gemini (plano gratuito), usada **só localmente**, no `.env.local` (fora do
git), para validar a IA com os dados fictícios do seed. Falta:

1. **Trocar a chave antes de publicar.** Ela foi colada no chat da sessão, então trate-a como exposta: em
   https://aistudio.google.com/apikey, crie uma chave nova e apague a antiga. Não cole a nova no chat:
   cadastre-a direto nas configurações (ambiente da sessão e Vercel) e no `.env.local` de quem roda o app
   localmente.
2. Cadastrar a chave (a nova) como `GEMINI_API_KEY` na **Vercel** (para o site publicado) e, se quiserem que eu
   continue testando, no ambiente da sessão.
3. Depois de criar o banco na nuvem, gerar os embeddings dos perfis: `npm run ai:backfill` (com as variáveis
   da nuvem; ver [04 §10](04-mentoria-com-ia.md#10-backfill-de-embeddings)).
4. Opcional, reserva: `GROQ_API_KEY` (https://console.groq.com/keys).

> Plano gratuito do Gemini: o Google pode usar os dados enviados para melhorar produtos e exige 18+.
> O app já pede consentimento e não envia nome, e-mail nem links.

### 3. Vercel (grátis)

1. Importar o repositório em https://vercel.com/new (branch `claude/plataforma-ciencia-delas` ou `main`
   depois do merge).
2. Cadastrar as variáveis que o script do Supabase imprime no final (URL, chave publicável, chave secreta) mais
   `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` e `GEMINI_API_KEY`.
3. Opcional: para eu fazer o deploy, `VERCEL_TOKEN` (https://vercel.com/account/tokens) no ambiente da sessão.

### 3b. Limpeza no GitHub

- Apagar o branch `claude/ci-permission-probe` (criado só para testar se esta sessão podia enviar workflows do
  GitHub Actions; contém um workflow vazio acionado só manualmente). A sessão não tem permissão para apagar
  branches remotos: em GitHub → Branches → lixeira ao lado do nome.

### 4. Antes da apresentação

- [ ] Preencher contato da controladora/encarregada de dados em `/privacidade` e a equipe em `/sobre` (a
      equipe preenche: nada disso pode ser inventado).
- [ ] Recriar o banco da apresentação logo antes do evento (`npx supabase db reset` no local, ou recriar o
      projeto e rodar o `setup-supabase-cloud.mjs --with-demo-seed --write-env` na nuvem): aplica as migrations, o
      `seed.sql` e os `supabase/seeds/*.sql` e apaga sobras de testes (ex.: "Jornada E2E …" ou "Relato de teste
      automatizado" em capturas antigas). Alguns dados do seed são relativos à data: rode perto do dia.
- [ ] **Senha de `admin@` e `moderacao@` na nuvem:** o `--with-demo-seed` troca a senha pública do seed
      (`ciencia-delas-demo`) de **todas** as contas `@demo.cienciadelas.dev` por senhas aleatórias. As da equipe
      ficam **só** no arquivo do `--write-env` (padrão `.env.cloud`, fora do git): `DEMO_ADMIN_EMAIL` /
      `DEMO_ADMIN_PASSWORD` e `DEMO_MODERACAO_EMAIL` / `DEMO_MODERACAO_PASSWORD`. Para mostrar a moderação ou o
      `/admin` no pitch, entre pelo `/entrar` com esses valores. Não cadastre essas quatro na Vercel e não as
      projete nem cole no chat. Cada nova execução com `--with-demo-seed` troca as senhas de novo (pegue as
      novas no arquivo) e encerra as sessões abertas dessas duas contas. As personas (Larissa, Marina, Débora)
      continuam entrando pelo `/demo` com um clique; `DEMO_PASSWORD` não serve nesse banco (as senhas mudaram).
      Se eu rodar o script numa sessão na nuvem, o `.env.cloud` fica no contêiner da sessão, que é descartado:
      abram o arquivo pelo app e guardem as quatro variáveis num gerenciador de senhas antes de encerrar a sessão.
- [ ] **Nunca** rodar `scripts/e2e/journey.mjs` nem os roteiros (`painel-demo`, `reconhecimento`, `pergunte`,
      `trajetoria`) contra o banco da apresentação: eles escrevem de verdade (e limpam depois, mas a
      apresentação pode pegar o meio do caminho).
- [ ] `DEMO_MODE=true` só no ambiente da apresentação e só durante o evento; desligar logo depois (`false` ou
      apagar a variável na Vercel + novo deploy) e reiniciar os dados (as personas são compartilhadas: a banca pode
      editar o perfil delas). Banco preparado de outro jeito (sem o script, ex.: `seed.sql` colado no SQL Editor)
      ainda tem a senha pública: troque a de `admin@` e `moderacao@` (Supabase → Authentication → Users) ou rode o
      script com `--with-demo-seed --write-env` ([14 §3.3](14-painel-e-modo-demo.md)).
- [ ] Definir `NEXT_PUBLIC_SITE_URL` com o endereço público **antes** de imprimir ou projetar QR codes (o do
      `/demo` e o da declaração apontam para esse endereço).
- [ ] Para o slide: declaração fictícia `ART-7K2M-Q9XD-4HNP` (`/verificar/ART-7K2M-Q9XD-4HNP`, com o selo
      "Dados de demonstração") e o link de acompanhamento da pergunta pendente
      `/pergunte/acompanhar/DemoPergunte-Artemis2026-IFSPjcr` ([16 §7](16-pergunte-a-uma-cientista.md)).
- [ ] Decidir se o site público usa as contas de demonstração (seed) ou começa vazio.
- [ ] Opcional: domínio verificado no Resend para o Boletim chegar a todas as inscritas
      (sem isso, o Boletim fica publicado no site).
- [ ] Revisar os textos de `/conduta` com a equipe.
- [ ] Abrir um pull request de `claude/plataforma-ciencia-delas` para `main` quando quiserem juntar o trabalho
      (o selo de CI do README passa a mostrar o resultado depois que o workflow chegar ao `main`).

## Como retomar comigo

1. Cadastrem as variáveis da seção 1 (e, se quiserem, `VERCEL_TOKEN` e a `GEMINI_API_KEY` **nova**, depois de
   trocar a chave — seção 2) nas configurações do ambiente, sem colar valores no chat.
2. Abram uma **sessão nova** neste repositório, no branch `claude/plataforma-ciencia-delas`.
3. Peçam: "continue a partir do docs/13: configure o Supabase Cloud, teste a IA e publique na Vercel".

Com as variáveis presentes, eu rodo o script de deploy (primeiro em `--dry-run`), gero os embeddings dos perfis
no banco da nuvem (`npm run ai:backfill`), confiro a IA no site publicado (já validada localmente —
[04 §15](04-mentoria-com-ia.md#15-validação-com-a-api-real-28102026)) e confiro o resto do site.

## Contas usadas até aqui

- **Supabase:** o desenvolvimento e os testes usaram o Supabase **local** (Docker, `npx supabase start`), com as
  chaves padrão do CLI. Em 28/10/2026 a equipe criou o projeto `artemis` na conta pessoal e passou um token de acesso,
  usado só para configurá-lo (seção 1); o token deve ser revogado depois do setup. As chaves do projeto ficam só no
  `.env.cloud` (fora do git).
- **IA:** a chave do Gemini (plano gratuito) fornecida pela equipe em 28/10/2026, usada **só localmente** (no
  `.env.local`, fora do git e de qualquer arquivo versionado) e **só com os dados fictícios do seed**, para validar
  o caminho real da IA e calibrar o matching ([04 §15](04-mentoria-com-ia.md#15-validação-com-a-api-real-28102026)).
  Ela ainda **não** está na Vercel. Como foi colada no chat, recomendamos trocá-la antes de publicar (seção 2).
- **GitHub:** só a integração da sessão, para enviar commits a este branch.
