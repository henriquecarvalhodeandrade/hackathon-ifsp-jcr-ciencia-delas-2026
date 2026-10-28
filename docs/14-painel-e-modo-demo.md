# 14 · Meu painel e modo demonstração

> O **`/painel`** é o início de quem já faz parte da rede: próximos passos, o que está esperando
> por ela e perguntas que ela responde em poucos minutos. O **modo demonstração** (`/demo`, só com
> `DEMO_MODE=true`) deixa a equipe e a banca entrarem como pessoas fictícias com um clique, sem
> senha e sem e-mail. Nenhuma migration: tudo usa dados que já existiam.

**Resumo:** antes, uma membra logada que abria `/` via a landing de vendas de novo, sem nenhum
"e agora?". Agora, quem terminou o onboarding cai no `/painel` ao abrir `/` e ao entrar sem destino
(`?next`). O painel é calmo e pessoal: uma lista curta de passos (sem sequência, sem culpa, sem
selo vermelho novo), o que pede uma ação dela e o que há de novo na rede. A página pública continua
a um clique (`/?visao=publica`). Para a apresentação, `/demo` abre a sessão da Larissa (mentoranda)
ou da Marina (mentora) direto no servidor, com o link mágico gerado pela API admin e validado na
hora — nenhum e-mail sai, nenhuma senha é digitada, nenhum segredo vai para o navegador.

---

## 1. Rotas e redirecionamentos

| Rota / situação                          | Antes                     | Agora                                                     |
| ---------------------------------------- | ------------------------- | --------------------------------------------------------- |
| `GET /` com membra que terminou o perfil | landing                   | `307 → /painel` (antes de carregar os dados da landing)   |
| `GET /?visao=publica` (qualquer pessoa)  | —                         | landing de sempre (link no rodapé do painel)              |
| `GET /` visitante ou cadastro incompleto | landing                   | landing (sem mudança)                                     |
| Login sem `?next`                        | `/forum`                  | `/painel` (`/entrar` manda `next=/painel` no formulário)  |
| `/entrar` ou `/cadastro` já logada       | `?next` ou `/forum`       | `?next` ou `/painel` (proxy)                              |
| `safeNextPath(x)` sem destino padrão     | `/forum`                  | `/painel`                                                 |
| `/painel` visitante                      | —                         | `/entrar?next=%2Fpainel` (`requireOnboardedProfile`)      |
| `/painel` cadastro incompleto            | —                         | `/onboarding?next=%2Fpainel`                              |
| Menu da conta                            | Meu perfil, Notificações… | **Meu painel** (primeiro item), Meu perfil, Notificações… |
| `/demo` com `DEMO_MODE` desligado        | —                         | 404 (`notFound()`), como qualquer rota inexistente        |

`/painel` e `/demo` têm `robots: noindex`. O `/painel` entra em `PROTECTED_PREFIXES` na integração
(até lá a própria página redireciona); `/demo` **não** é protegido — é a porta de entrada.

## 2. Os blocos do `/painel`

A página (`src/app/painel/page.tsx`) chama `requireOnboardedProfile("/painel")` e
`loadPainelData` (`src/lib/painel/queries.ts`, só servidor). Cada bloco é um Server Component
independente em `src/components/painel/` que recebe os próprios dados; se uma leitura falhar, só
aquele bloco mostra "Não conseguimos carregar esta parte agora" e os outros continuam.

Layout: duas colunas a partir de 1024 px (principal: passos + pendências; lateral: perguntas +
novidades) e uma coluna no celular. Há dois **slots comentados** para a integração: depois de
"O que está esperando você" (`<RecognitionTodos />`, lane reconhecimento) e depois das perguntas
(`<AwaitingQuestionsCard />`, lane pergunte).

### 2.1 Leituras (6 idas ao Supabase, um único `Promise.all`)

Todas com o cliente da **sessão** (o RLS decide o que ela vê) e com limite explícito.

| #   | Leitura                                                    | Para quê                                                                                                                                                                                                | Limite                                                |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `profiles` (ela) com relações embutidas                    | áreas, nº de sugestões, mensagens enviadas, apresentação com nome em `apresente-se`, respostas nos últimos 30 dias, a própria autoria anônima, papers enviados, destaques dados, notificações não lidas | 1 linha; áreas 20, apresentação 1, autoria anônima 50 |
| 2   | `mentorship_requests` em que ela participa                 | nome da outra pessoa e mensagens não lidas por conversa (mesma regra de `loadUnreadCounts`, embutida para não custar outra ida)                                                                         | 100                                                   |
| 3   | `forum_threads` sem resposta, abertos, dos últimos 30 dias | candidatos a "Perguntas esperando por você" (`author_id` nulo **ou** diferente do dela)                                                                                                                 | 40                                                    |
| 4   | `papers` visíveis dos últimos 7 dias                       | Novidades: papers nas áreas dela (ou os mais destacados da semana)                                                                                                                                      | 30 (mostra 3)                                         |
| 5   | `profiles` que terminaram o cadastro nos últimos 14 dias   | Novidades: "Chegaram à rede" (quem divide área com ela primeiro)                                                                                                                                        | 40 (mostra 3)                                         |
| 6   | `newsletter_editions` publicada/enviada mais recente       | Novidades: último Boletim Delas (filtro de status explícito: admins enxergam rascunhos pelo RLS)                                                                                                        | 1                                                     |

O perfil dela (palavras-chave, temas, disponibilidade) já vem de `requireOnboardedProfile`, que é
memoizado por requisição e compartilhado com o cabeçalho — não conta como leitura extra.

### 2.2 "Seus próximos passos" (`computeNextSteps`, puro)

Um medidor "N de 5" e a lista. Passos feitos ficam esmaecidos, com o sinal de concluído; **só o primeiro pendente**
ganha o botão principal; os outros pendentes são links discretos. Tudo feito: "Tudo em dia por aqui.
Obrigada por fazer a rede andar." Campos pessoais opcionais (pronomes, cidade, trajetória, foto…)
nunca aparecem como "faltando".

**Mentoranda** (padrão):

| #   | Passo                     | Feito quando                                                                        | Destino                                  |
| --- | ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Complete seu perfil       | frase de apresentação + ≥ 1 área + ≥ 3 palavras-chave (a descrição diz o que falta) | `/perfil#pesquisa`                       |
| 2   | Apresente-se no fórum     | tem um tópico **com nome** na categoria `apresente-se`                              | `/forum/novo?categoria=apresente-se`     |
| 3   | Encontre mentoras         | tem linhas em `mentor_suggestions` **ou** já pediu mentoria                         | `/mentoria?aba=sugestoes`                |
| 4   | Envie um pedido           | tem qualquer pedido como mentoranda                                                 | `/mentoria?aba=sugestoes`                |
| 5   | Mande a primeira mensagem | já enviou uma mensagem de mentoria                                                  | conversa da mentoria aceita mais recente |

Sem mentoria aceita, o passo 5 fica travado, sem botão: "Depois que uma mentora aceitar, a conversa
aparece aqui."

**Quem não busca mentoria** (nem é mentora): passos 1 e 2, mais "Explore a Vitrine" (`/papers`;
feito quando ela destacou ou enviou um paper) e "Encontre pesquisadoras da sua área"
(`/pesquisadoras`; feito quando ela puxou conversa no fórum nos últimos 30 dias). Medidor "N de 4".

**Mentora** (`is_mentor`, tem prioridade):

| #   | Passo                    | Feito quando                                        | Destino                   |
| --- | ------------------------ | --------------------------------------------------- | ------------------------- |
| 1   | Conte como pode ajudar   | `mentoring_offer` preenchido + ≥ 1 tema de mentoria | `/perfil#mentoria`        |
| 2   | Abra sua disponibilidade | `mentor_available` e capacidade ≥ 1                 | `/mentoria?aba=recebidas` |
| 3   | Responda aos pedidos     | 0 pedidos recebidos pendentes                       | `/mentoria?aba=recebidas` |
| 4   | Ajude no fórum           | respondeu a um tópico nos últimos 30 dias           | `/forum`                  |
| 5   | Divulgue um paper        | enviou ≥ 1 paper à Vitrine                          | `/papers/novo`            |

"Respondeu" conta respostas com nome e anônimas (a autoria anônima vem do registro dela mesma,
que o RLS só entrega para ela).

### 2.3 "O que está esperando você"

Só o que pede uma ação dela, cada linha levando direto ao lugar:

- conversas de mentoria com mensagens não lidas → `/mentoria/conversa/<id>` ("N mensagens novas");
- mentora: pedidos recebidos pendentes, com a idade do mais antigo ("chegou há 3 dias") →
  `/mentoria?aba=recebidas`;
- mentoranda: cada pedido enviado pendente ("Aguardando a resposta de Fernanda Okabe", "pedido
  enviado há 2 dias") → `/mentoria?aba=enviadas` (até 3, mais um resumo do resto);
- notificações não lidas → `/notificacoes`.

Vazio: "Nada pendente agora. Que tal ver as conversas do fórum?".

### 2.4 Perguntas (`rankQuestionsForMember`, puro)

Título "Perguntas esperando por você" (mentora) ou "Sem resposta ainda: talvez você saiba ajudar"
(demais), com "Em 5 minutos você ajuda uma iniciante.".

1. Candidatos: até 40 tópicos sem resposta, não trancados, dos últimos 30 dias e que não são dela.
   Tópicos anônimos chegam **sem autoria** e assim ficam — o painel nunca tenta descobrir quem
   escreveu. A única exceção é a própria autoria anônima dela (lida do registro que o RLS já
   entrega só para ela), para não pedir que ela responda a si mesma.
2. Pontos, sem acento e sem diferença de caixa (`normalizeTerm`): palavra-chave do perfil numa tag
   (3), no título (2) ou no corpo (1), sempre como palavra inteira; nome de uma área dela no texto
   (2); tema de mentoria dela inferido do texto por `inferTopicsFromText` (1). Palavra-chave de uma
   letra (ex.: "r") só vale como tag exata.
3. As 3 com mais pontos (empate: a mais recente) com o motivo: "Fala de: estatística". Se faltarem,
   as mais recentes completam a lista com "Sem resposta ainda". Anônimos aparecem como "Anônima".

### 2.5 Novidades da semana

- **Na Vitrine:** até 3 papers dos últimos 7 dias nas áreas dela; sem nenhum, os 3 mais destacados
  entre os papers novos da semana.
- **Chegaram à rede:** até 3 pessoas que terminaram o cadastro nos últimos 14 dias — quem divide uma
  área com ela primeiro ("Também pesquisa …"), as mais recentes completam — com
  "Dê as boas-vindas" → `/pesquisadoras/<id>`.
- **Boletim Delas:** a última edição publicada → `/newsletter/<slug>`.

Rodapé: "Ver a página pública da Artemis" → `/?visao=publica`.

## 3. Modo demonstração

### 3.1 Como funciona

| Peça                                             | O que faz                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.demoMode` (`src/lib/env.ts`)                | `true` **só** com `DEMO_MODE=true` exatamente. `env.demoPassword` lê `DEMO_PASSWORD` (opcional, só servidor). Nenhuma variável `NEXT_PUBLIC_`.      |
| `src/lib/demo/personas.ts`                       | Lista fixa e pura: `larissa` e `marina` (ids e e-mails do seed). `getPersona`, `listPersonas`, `isDemoEmail`, `personaByEmail`.                     |
| `/demo` (`src/app/demo/page.tsx`)                | `notFound()` sem o modo; um cartão por persona com "Entrar como …"; aviso honesto; "Roteiro de 3 minutos" com 6 links e "Já vi" no navegador.       |
| `enterDemoPersona` (`src/app/demo/actions.ts`)   | Confere de novo o modo e a lista (zod + `getPersona`); recusa slug desconhecido; abre a sessão; `revalidatePath("/", "layout")`; vai para o painel. |
| `openDemoSession` (`src/lib/demo/session.ts`)    | Ver 3.2.                                                                                                                                            |
| `DemoBanner` (`src/components/demo/`)            | Faixa acima do cabeçalho: "Modo demonstração · você está como Marina (perfil fictício) · Trocar persona · Sair".                                    |
| Cartão no `/entrar`                              | "Só quer conhecer? Entre como uma pessoa fictícia" → `/demo` (só com o modo ligado).                                                                |
| Trava de exclusão (`src/lib/profile/account.ts`) | Com o modo ligado, contas `@demo.cienciadelas.dev` não se excluem.                                                                                  |

### 3.2 Abrindo a sessão sem senha e sem e-mail

1. Sem chave secreta e sem `DEMO_PASSWORD`: devolve "O modo demonstração precisa da chave secreta do
   Supabase no servidor." **sem** deslogar ninguém.
2. Sai da sessão atual **só neste navegador** (`signOut({ scope: "local" })`). O padrão
   (`"global"`) derrubaria todas as pessoas da banca que estão usando a mesma conta.
3. Com `SUPABASE_SECRET_KEY`: `auth.admin.getUserById(<id do seed>)` confere que a conta existe com
   o e-mail esperado (o `generateLink("magiclink")` **criaria** a conta se ela não existisse);
   `auth.admin.generateLink({ type: "magiclink", email })` gera o token **sem enviar e-mail**; e
   `auth.verifyOtp({ token_hash, type: "email" })` no cliente com cookies grava a sessão no navegador
   de quem clicou. Se duas pessoas clicam juntas, o token mais novo invalida o anterior: há uma
   segunda tentativa automática.
4. Sem a chave, com `DEMO_PASSWORD`: `signInWithPassword` (plano B).

### 3.3 Modelo de segurança

- **Portão por ambiente:** com `DEMO_MODE` diferente de `true`, `/demo` é 404, o cartão do `/entrar`
  some, a faixa não aparece (e não faz nenhuma chamada ao Supabase) e a action recusa tudo.
- **Lista fixa:** o formulário só manda o slug; o servidor nunca confia nele. Nada de e-mail vindo do
  cliente. `admin@` e `moderacao@` **nunca** são personas (há uma lista de bloqueio além da lista
  fixa, e um teste para isso): o modo demonstração não dá poder de moderação a ninguém.
- **Segredos só no servidor:** a chave secreta e a `DEMO_PASSWORD` ficam no servidor; o navegador só
  recebe os cookies de sessão. A action tem a proteção de CSRF do Next (Origin × Host).
- **Faixa sempre visível** para contas fictícias, com "Sair" (POST para `/auth/sair`).
- **Contas compartilhadas:** várias pessoas usam a mesma persona ao mesmo tempo, e o que uma
  publica aparece para as outras (o `/demo` avisa). Por isso a exclusão de conta fictícia é recusada
  ("Contas de demonstração não podem ser excluídas. Elas voltam ao normal quando a equipe reinicia
  os dados."). A mesma trava existe para troca de senha (`DEMO_PASSWORD_REFUSED` em
  `src/lib/demo/guard.ts`, a ser ligada em `/redefinir-senha` na integração). A sessão é real: quem
  quiser pode alterar o perfil da persona — por isso os dados são reiniciados depois do evento.
- **Limites do Supabase Auth:** todas as entradas saem do IP do servidor; o limite padrão é de 30
  validações de token por 5 minutos por IP (`[auth.rate_limit]` do `config.toml`). Sobra para uma
  apresentação; num evento com muita gente, aumente no painel do Supabase.
- **Desligue depois do evento:** `DEMO_MODE=false` (ou apague a variável). Nunca ligue numa instância
  com membras reais.

### 3.4 Como reiniciar as personas

- **Local:** `npx supabase db reset` (recria o banco, aplica migrations e todos os seeds).
- **Nuvem:** rode de novo os seeds no banco da apresentação (`supabase/seed.sql` e depois
  `supabase/seeds/*.sql`, pelo SQL Editor ou `psql`). Os seeds são idempotentes; para voltar ao
  estado exato do começo (sem o que a banca escreveu), recrie o banco antes.

## 4. Dados de demonstração (`supabase/seeds/10_painel.sql`)

Idempotente, fictício, textos terminando em "(demonstração)", roda depois de `supabase/seed.sql`.

| O quê                                                                                                                                   | id                                     | Por quê                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Yasmin em `duvidas-pesquisa`: "Como começo a analisar meus dados em Python sem me perder?" (tags python, estatística, análise de dados) | `a1000000-0000-4000-8000-000000000101` | Pergunta sem resposta; combina com a palavra-chave "python" da Marina e da Larissa           |
| Manuela em `carreira`: "Vale a pena fazer o mestrado logo depois da graduação?" (tags mestrado, carreira)                               | `a1000000-0000-4000-8000-000000000102` | Pergunta sem resposta; combina com os temas "pós-graduação" e "carreira acadêmica" da Marina |
| Pedido de mentoria **pendente** Yasmin → Marina (há 2 dias)                                                                             | `c1a00000-0000-4000-8000-000000000001` | A persona "mentora com pedidos para responder" precisa de um pedido de verdade               |

O prefixo `c1000000-…-0000000001xx` já é usado pelo `20_reconhecimento.sql`; por isso o pedido usa
`c1a00000-…`.

O que cada persona vê no seed: **Larissa** — 4 de 5 passos, próximo "Mande a primeira mensagem" (mentoria
aceita com a Marina), as duas perguntas. **Marina** — 2 de 5, próximo "Responda aos pedidos", o pedido
da Yasmin e as notificações não lidas em "O que está esperando você", as duas perguntas com
"Fala de: python" e "Fala de: carreira acadêmica".

## 5. Testes

| Arquivo                                    | O que cobre                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/painel/next-steps.test.ts`        | ordem e "feito" da mentoranda; variante sem mentoria; trilha da mentora; tudo feito; mensagem travada até o aceite; nunca cobra campos opcionais                             |
| `src/lib/painel/questions-for-you.test.ts` | "Estatistica" × "estatística"; título/corpo como palavra inteira; área e tema; exclui o tópico dela (inclusive o anônimo dela); trancados e antigos; mais recentes; máximo 3 |
| `src/lib/painel/queries.test.ts`           | no máximo 6 idas, todas com limite (inclusive listas embutidas); filtros de segurança; montagem; um bloco falhando sozinho                                                   |
| `src/lib/demo/personas.test.ts`            | slug desconhecido → null; `isDemoEmail`; admin e moderação nunca na lista; lista imutável                                                                                    |
| `src/lib/demo/gate.test.ts`                | modo desligado → `/demo` 404, action recusa sem abrir sessão, faixa sem chamada ao Supabase; ligado → personas, slug forjado recusado, redirecionamento, faixa               |
| `src/lib/demo/session.test.ts`             | link mágico sem e-mail, `signOut` local, conta inexistente não é criada, corrida, plano B por senha, sem configuração; exclusão de conta fictícia recusada                   |
| `src/lib/profile/redirect.test.ts`         | destino padrão `/painel`                                                                                                                                                     |
| `scripts/e2e/painel-demo.mjs`              | jornada com Playwright (abaixo)                                                                                                                                              |

E2E (`scripts/e2e/painel-demo.mjs`, independente da `journey.mjs`): visitante em `/painel` →
`/entrar?next=%2Fpainel`; landing intacta; larissa@ entra pelo formulário sem `next` e cai no painel
com os títulos das seções; `/` → `/painel` e `/?visao=publica` → landing; "Meu painel" é o primeiro
item do menu da conta; marina@ vê um tópico do seed com "Fala de: …". Com `DEMO=1` (servidor com
`DEMO_MODE=true`): cartão no `/entrar`, "Entrar como Marina" → painel com a faixa, troca para a
Larissa, slugs forjados (`admin`, `moderacao`, `admin@…`, `helena`, `LARISSA`) recusados sem mexer na
sessão e exclusão recusada (com uma conta **temporária** do domínio demo, apagada no fim — nunca com
as personas). Sem `DEMO`: `/demo` é 404 e não há faixa. Por fim, capturas claro/escuro × 1440/390 do
painel (Larissa e Marina) e do `/demo`, com rolagem horizontal, contraste AA, console e hidratação.
As asserções olham títulos e links, não o estado de cada passo (outras execuções podem mexer nas
sugestões e mensagens da Larissa).

```bash
# servidor de produção local (porta 3801), com e sem o modo demonstração
MAILPIT_URL=http://127.0.0.1:54324 npx next build
DEMO_MODE=true npx next start -p 3801
DEMO=1 BASE_URL=http://localhost:3801 node scripts/e2e/painel-demo.mjs
# … e com o servidor sem DEMO_MODE:
BASE_URL=http://localhost:3801 node scripts/e2e/painel-demo.mjs
```
