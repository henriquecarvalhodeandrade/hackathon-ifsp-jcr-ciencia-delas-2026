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

`/painel` e `/demo` têm `robots: noindex` (e estão no `robots.txt`). O `/painel` está em
`PROTECTED_PREFIXES`: o proxy manda a visitante para `/entrar?next=%2Fpainel` com um 307 de verdade;
`/demo` **não** é protegido — é a porta de entrada. Login sem destino (senha, link mágico, Google)
cai no `/painel`; no celular, o painel é a aba "Início" da barra de abas de baixo e "Meu painel" é o
primeiro item de "Sua conta", que abre a gaveta do menu (§2.6).

## 2. Os blocos do `/painel`

A página (`src/app/painel/page.tsx`) chama `requireOnboardedProfile("/painel")` e
`loadPainelData` (`src/lib/painel/queries.ts`, só servidor). Cada bloco é um Server Component
independente em `src/components/painel/` que recebe os próprios dados; se uma leitura falhar, só
aquele bloco mostra "Não conseguimos carregar esta parte agora" e os outros continuam.

Layout: duas colunas a partir de 1024 px (principal: pendências, "Da sua rede" e passos; lateral:
perguntas + novidades) e uma coluna no celular. **Ordem da coluna principal:** quando há algo
esperando por ela, "O que está esperando você" abre a página e "Da sua rede" vem logo depois — no
celular, é o que aparece na primeira tela (antes, a parte social ficava abaixo de um cartão de passos
de ~900 px); sem pendências, "Seus próximos passos" abre. No celular, os passos já feitos mostram só o
título (a descrição volta do `sm` em diante). Blocos com leitura própria (fora das 6 idas):
"Da sua rede" (`NetworkPostsCard`, §2.5) e dois de outras funcionalidades, que somem quando não há
nada: depois dos passos, `<RecognitionTodos />` ("Para fechar suas mentorias",
[docs/15](15-reconhecimento-da-mentoria.md)); depois das perguntas, `<AwaitingQuestionsCard />`
("Estudantes perguntando", [docs/16](16-pergunte-a-uma-cientista.md)). As pendências da rede social
(`loadNetworkWaiting`, `src/lib/painel/network.ts`: caixa de entrada, convites e candidaturas — 3 idas)
são lidas em paralelo com o `loadPainelData` e entram em "O que está esperando você".

### 2.1 Leituras (6 idas ao Supabase, um único `Promise.all`)

Todas com o cliente da **sessão** (o RLS decide o que ela vê) e com limite explícito.

| #   | Leitura                                                    | Para quê                                                                                                                                                                                                                                                                                                          | Limite                                                |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `profiles` (ela) com relações embutidas                    | áreas, nº de sugestões, mensagens enviadas, apresentação com nome em `apresente-se`, respostas nos últimos 30 dias, a própria autoria anônima, papers enviados, destaques dados, notificações não lidas (menos `direct_message`, `connection_request` e `opportunity_application`, que o bloco já lista com nome) | 1 linha; áreas 20, apresentação 1, autoria anônima 50 |
| 2   | `mentorship_requests` em que ela participa                 | nome da outra pessoa e mensagens não lidas por conversa (mesma regra de `loadUnreadCounts`, embutida para não custar outra ida)                                                                                                                                                                                   | 100                                                   |
| 3   | `forum_threads` sem resposta, abertos, dos últimos 30 dias | candidatos a "Perguntas esperando por você" (`author_id` nulo **ou** diferente do dela)                                                                                                                                                                                                                           | 40                                                    |
| 4   | `papers` visíveis dos últimos 7 dias                       | Novidades: papers nas áreas dela (ou os mais destacados da semana)                                                                                                                                                                                                                                                | 30 (mostra 3)                                         |
| 5   | `profiles` que terminaram o cadastro nos últimos 14 dias   | Novidades: "Chegaram à rede" (quem divide área com ela primeiro)                                                                                                                                                                                                                                                  | 40 (mostra 3)                                         |
| 6   | `newsletter_editions` publicada/enviada mais recente       | Novidades: último Boletim Delas (filtro de status explícito: admins enxergam rascunhos pelo RLS)                                                                                                                                                                                                                  | 1                                                     |

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

| #   | Passo                    | Feito quando                                        | Destino                                                                            |
| --- | ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Conte como pode ajudar   | `mentoring_offer` preenchido + ≥ 1 tema de mentoria | `/perfil#mentoria`                                                                 |
| 2   | Abra sua disponibilidade | `mentor_available` e capacidade ≥ 1                 | `/mentoria?aba=recebidas` (pedidos fechados) ou `/perfil#mentoria` (só falta vaga) |
| 3   | Responda aos pedidos     | 0 pedidos recebidos pendentes                       | `/mentoria?aba=recebidas`                                                          |
| 4   | Ajude no fórum           | respondeu a um tópico nos últimos 30 dias           | `/forum`                                                                           |
| 5   | Divulgue um paper        | enviou ≥ 1 paper à Vitrine                          | `/papers/novo`                                                                     |

"Respondeu" conta respostas com nome e anônimas (a autoria anônima vem do registro dela mesma,
que o RLS só entrega para ela).

### 2.3 "O que está esperando você"

Só o que pede uma ação dela, cada linha levando direto ao lugar:

- conversas de mentoria com mensagens não lidas → `/mentoria/conversa/<id>` ("N mensagens novas na
  mentoria");
- rede social ([docs/18](18-rede-social.md)), com nome e rosto da pessoa: pedidos de mensagem que ela
  recebeu, lidos ou não ("Renata Carvalho quer conversar") e conversas aceitas com mensagem nova →
  `/mensagens/<id>` (até 3, mais "E mais N conversas…" → `/mensagens`);
- mentora: pedidos recebidos pendentes, com a idade do mais antigo ("chegou há 3 dias") →
  `/mentoria?aba=recebidas`;
- convites de conexão para ela ("Juliana Ribeiro quer se conectar") → `/rede?aba=convites` (até 3 + resumo);
- candidaturas novas (`submitted`) nas vagas que ela publicou ("Yasmin Oliveira se candidatou", "À vaga
  “…”") → `/ics/<id>/candidaturas` (até 3 + resumo → `/ics/minhas?aba=publicadas`);
- mentoranda: cada pedido enviado pendente ("Aguardando a resposta de Fernanda Okabe", "pedido
  enviado há 2 dias") → `/mentoria?aba=enviadas` (até 3, mais um resumo do resto);
- as outras notificações não lidas → `/notificacoes` ("Curtidas, comentários, respostas e outros
  avisos"). Os avisos de mensagem direta, convite e candidatura ficam fora dessa contagem
  (`NAMED_ELSEWHERE_TYPES`): já aparecem acima, com nome — nada é contado duas vezes.

Sem link de ação embutida (aceitar, recusar): cada linha leva à tela que já tem os botões. Se só a
parte da rede falhar, o bloco mostra o que veio da mentoria e um aviso calmo no fim.

Vazio: "Nada pendente agora. Que tal ver as conversas do fórum?".

### 2.4 Perguntas (`rankQuestionsForMember`, puro)

Título "Perguntas esperando por você" (mentora) ou "Sem resposta ainda: talvez você saiba ajudar"
(demais), com "Em 5 minutos você ajuda uma iniciante.".

1. Candidatos: até 40 tópicos sem resposta, não trancados, dos últimos 30 dias e que não são dela,
   fora das categorias de acolhimento (as que aceitam anonimato: apoio, maternidade, saúde mental) —
   um relato pessoal não vira "pergunta rápida" na página inicial de todo mundo.
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

**Da sua rede** (`src/components/painel/network-posts-card.tsx`, leitura própria com `listPosts` do
feed): as 2 publicações mais recentes de quem ela segue (sem as dela), com autora, tipo, quando, o
começo do texto, **Curtir** (o mesmo `LikeButton` do feed), **Comentar** e "Ver publicação"; se
ninguém que ela segue publicou, as mais recentes da rede. Botão "Compartilhar novidade" → `/feed` e
"Ver mais no feed". Substitui o antigo bloco "Na sua rede" (as pendências dele foram para "O que está
esperando você", com nome).

Rodapé: "Ver a página pública da Artemis" → `/?visao=publica`.

### 2.6 Navegação no celular e no projetor

- **Barra de abas** (abaixo de 1024 px, só membras com cadastro completo; `MemberTabBar` no layout
  raiz → `MobileTabBar`): `<nav aria-label="Navegação rápida">` fixa embaixo, 56 px + a área segura do
  iPhone (`env(safe-area-inset-bottom)`), com Início (`/painel`), Feed, Rede, ICs e Mensagens (selo
  de conversas novas); ícone + rótulo de 12 px e `aria-current` no item ativo. Um espaçador no fim da
  página evita que o rodapé fique escondido, e o `<html>` ganha `scroll-padding-bottom` enquanto ela
  existe. Some nas telas de conversa (`/mensagens/<id>`, `/mentoria/conversa/<id>`) e enquanto um
  campo de texto está em foco (teclado aberto). Lê a mesma sessão memoizada do cabeçalho
  (`loadHeaderSession`): nenhuma ida extra ao banco. Os avisos rápidos (`<Toaster />`) ficam ~72 px
  acima do fundo, por cima dela.
- **Gaveta** (`MobileNav`): "Sua conta" primeiro (Meu painel, Meu perfil, Meu portfólio, Mensagens,
  Notificações) e depois "Explorar" com todas as áreas (Feed, Rede, ICs, Mentoria, Fórum,
  Pesquisadoras, Papers, Pergunte, Ranking, Newsletter); tema e Sair no rodapé. Feed usa o ícone de
  jornal (`Newspaper`, o mesmo da página) e a Newsletter o envelope (`Mail`, como o Boletim no
  painel) — a casa (`House`) é do Início/Meu painel.
- **Cabeçalho:** no celular, só o sino e o menu (Mensagens está na barra). No desktop, os ícones de
  Mensagens e Notificações têm dica (`Tooltip`, embaixo; só com o ponteiro em cima ou foco de
  teclado — depois de um clique ela não fica pendurada) e ficam preenchidos de violeta na própria
  página; o tema fica separado deles por um traço; o avatar ganha o anel violeta em Meu painel, Meu
  perfil e Meu portfólio; "Mais" só fica marcado nas páginas dele (não em perfis
  `/pesquisadoras/<id>`).
- **Sino:** não conta `direct_message` (o ícone/aba de Mensagens já conta essas conversas); os
  avisos continuam listados em `/notificacoes`.

## 3. Modo demonstração

### 3.1 Como funciona

| Peça                                                  | O que faz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.demoMode` (`src/lib/env.ts`)                     | `true` **só** com `DEMO_MODE=true` exatamente. `env.demoPassword` lê `DEMO_PASSWORD` (opcional, só servidor). Nenhuma variável `NEXT_PUBLIC_`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/demo/personas.ts`                            | Lista fixa e pura: `larissa`, `marina` e `debora` (ids e e-mails do seed). `getPersona`, `listPersonas`, `isDemoEmail`, `personaByEmail`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/demo` (`src/app/demo/page.tsx`)                     | `notFound()` sem o modo; a escolha da persona primeiro, em cartões compactos (no celular, dois "Entrar como …" já na primeira tela; o que cada uma mostra abre em "O que você vai ver"); com a sessão de uma persona, o cartão dela fica marcado ("Você está aqui · Ir para o painel") e o botão dela vira secundário, sem sumir; aviso honesto em uma frase + "Saiba mais"; "Roteiro de 3 minutos" com 9 links que abrem com a rede social em ação e só pedem ações que a plateia inteira pode repetir com a mesma persona (curtir, comentar, seguir, abrir conversa — nunca aceitar o convite da Juliana, responder um pedido ou se candidatar): Curta e comente uma publicação (`/feed`), Perfil e portfólio da Marina, Sua rede (`/rede`), Mensagens, Explorar ICs, Mentoria (sugestões com "Vocês têm em comum"), Pergunte, declaração verificável e Vitrine, com "Já vi" no navegador; QR code de `<site>/demo` (gerado no servidor, `renderQrSvg`) para o slide e para a plateia abrir no celular. |
| `enterDemoPersona` (`src/app/demo/actions.ts`)        | Confere de novo o modo e a lista (zod + `getPersona`); recusa slug desconhecido; abre a sessão; `revalidatePath("/", "layout")`; vai para o painel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `openDemoSession` (`src/lib/demo/session.ts`)         | Ver 3.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `DemoBanner` (`src/components/demo/`)                 | Faixa acima do cabeçalho: "Modo demonstração · você está como Marina (perfil fictício) · Trocar persona · Sair". No celular, uma linha só ("Demonstração · Marina · Trocar · Sair"); a frase completa e o nome "Trocar persona" continuam para leitores de tela.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Cartão no `/entrar`                                   | "Só quer conhecer? Entre como uma pessoa fictícia" → `/demo` (só com o modo ligado).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Trava de exclusão (`src/lib/profile/account.ts`)      | Com o modo ligado, contas `@demo.cienciadelas.dev` não se excluem.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Trava de senha (`src/app/redefinir-senha/actions.ts`) | Com o modo ligado, contas `@demo.cienciadelas.dev` não trocam de senha por `/redefinir-senha` (`DEMO_PASSWORD_REFUSED`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 3.2 Abrindo a sessão sem senha e sem e-mail

1. Sem chave secreta e sem `DEMO_PASSWORD`: devolve "O modo demonstração precisa da chave secreta do
   Supabase no servidor." **sem** deslogar ninguém.
2. Com `SUPABASE_SECRET_KEY`, **antes** de mexer na sessão atual (uma recusa não desloga ninguém):
   `auth.admin.getUserById(<id do seed>)` confere que a conta existe com o e-mail esperado (o
   `generateLink("magiclink")` **criaria** a conta se ela não existisse) e o perfil dela precisa ter
   o papel `member`. Se alguém tiver promovido a persona a moderadora ou administradora, a entrada é
   recusada ("Por segurança, o modo demonstração só entra em contas comuns da rede, sem poderes de
   moderação ou administração.") — uma segunda trava além da lista fixa.
3. Sai da sessão atual **só neste navegador** (`signOut({ scope: "local" })`). O padrão
   (`"global"`) derrubaria todas as pessoas da banca que estão usando a mesma conta.
4. `auth.admin.generateLink({ type: "magiclink", email })` gera o token **sem enviar e-mail**; e
   `auth.verifyOtp({ token_hash, type: "email" })` no cliente com cookies grava a sessão no navegador
   de quem clicou. Se várias pessoas clicam juntas, o token mais novo invalida o anterior: há até
   3 tentativas, com uma pausa curta e aleatória entre elas (cada uma gasta uma validação do limite
   do Supabase Auth). Se ainda assim falhar, a pessoa vê "Não conseguimos entrar com essa pessoa
   agora. Tente de novo em alguns segundos."
5. Sem a chave, com `DEMO_PASSWORD`: `signInWithPassword` (plano B). A mesma conferência (conta do
   seed + papel `member`) roda logo depois do login; se falhar, a sessão recém-aberta é encerrada.
   O plano B só serve para um banco em que as personas ainda têm a senha do seed (ex.: o local): num
   projeto da nuvem preparado com `setup-supabase-cloud.mjs --with-demo-seed`, as senhas foram trocadas
   (§3.3) e o `/demo` depende da chave secreta, que o script entrega.

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
  os dados."). A troca de senha pela tela `/redefinir-senha` também é recusada
  (`DEMO_PASSWORD_REFUSED`, `src/lib/demo/guard.ts`). Mesmo assim, quem tem a sessão pode trocar a
  senha direto na API do Supabase Auth
  (`secure_password_change = false`). Por isso o caminho principal é o link mágico (chave secreta),
  que não depende da senha; o plano B por `DEMO_PASSWORD` pode ser quebrado por alguém da banca. A
  sessão é real: quem quiser pode alterar o perfil da persona — por isso os dados são reiniciados
  depois do evento.
- **Contas de administração e moderação do seed:** o `seed.sql` cria `admin@` (papel `admin`: vê a
  autoria de relatos anônimos, modera, apaga) e `moderacao@` com a mesma senha **pública** das demais
  (`ciencia-delas-demo`, no README). O `/demo` nunca entra nelas, mas numa instância acessível pela
  internet qualquer pessoa entraria pelo `/entrar` — com ou sem `DEMO_MODE`. Por isso o
  `scripts/deploy/setup-supabase-cloud.mjs --with-demo-seed`, logo depois do seed (e a cada nova
  execução), troca a senha de **todas** as contas `@demo.cienciadelas.dev` por senhas aleatórias
  (`node:crypto`, 32 caracteres) num único `UPDATE` com o bcrypt do `pgcrypto`, e encerra as sessões
  abertas de `admin@` e `moderacao@`:
  - **personas:** ficam com senhas que ninguém recebe — o `/demo` entra por link mágico (§3.2), sem
    senha;
  - **equipe:** as senhas novas de `admin@` e `moderacao@` vão **só** para o arquivo do `--write-env`
    (`DEMO_ADMIN_PASSWORD`, `DEMO_MODERACAO_PASSWORD`; permissão 600, fora do git), que por isso é
    obrigatório com `--with-demo-seed`. Nunca aparecem na saída, na simulação nem na Vercel.

  Detalhes e garantias: [`scripts/deploy/README.md` §5](../scripts/deploy/README.md#5-segurança).
  Banco preparado sem o script (ex.: `seed.sql` colado no SQL Editor) continua com a senha pública:
  troque a de `admin@` e `moderacao@` (Supabase → Authentication → Users) ou rode o script.

- **Limites do Supabase Auth:** todas as entradas saem do IP do servidor; o limite padrão é de 30
  validações de token por 5 minutos por IP (`[auth.rate_limit]` do `config.toml`). Sobra para uma
  apresentação; num evento com muita gente, aumente no painel do Supabase. Como o `/demo` é público
  enquanto o modo está ligado, alguém de fora pode gastar esse limite (ou ficar gerando links da
  mesma persona) e atrapalhar as entradas por alguns minutos: é mais um motivo para ligar o modo só
  durante a apresentação.
- **Desligue depois do evento:** `DEMO_MODE=false` (ou apague a variável). Nunca ligue numa instância
  com membras reais.

### 3.4 Como reiniciar as personas

- **Local:** `npx supabase db reset` (recria o banco, aplica as migrations, o `seed.sql` e os
  `supabase/seeds/*.sql`: `[db.seed] sql_paths = ["./seed.sql", "./seeds/*.sql"]` no `config.toml`).
- **Nuvem:** rode de novo os seeds no banco da apresentação (`supabase/seed.sql` e depois
  `supabase/seeds/*.sql`, pelo SQL Editor ou `psql`). O `--with-demo-seed` do
  `scripts/deploy/setup-supabase-cloud.mjs` aplica o `seed.sql` (se a demonstração ainda não existir)
  e sempre os `supabase/seeds/*.sql`, que são idempotentes, e troca de novo as senhas das contas
  fictícias (pegue as novas de `admin@`/`moderacao@` no arquivo do `--write-env`); para voltar ao estado
  exato do começo (sem o que a banca escreveu), recrie o banco antes. Recriando o banco e colando o
  `seed.sql` no SQL Editor, as contas voltam com a senha pública: rode o script em seguida.
- **Rede social:** rodar de novo só o `supabase/seeds/50_rede_social.sql` já volta feed, rede,
  portfólio, ICs e mensagens das contas de demonstração ao estado inicial (apaga o que a plateia
  criou, refaz convites, pedidos, candidaturas, leituras e avisos e zera os limites anti-spam) — ideal
  entre um ensaio e a apresentação ([18 §6](18-rede-social.md#6-como-demonstrar-com-o-seed-supabaseseeds50_rede_socialsql)).

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
aceita com a Marina); em "O que está esperando você", o pedido de mensagem da Renata e o convite da
Juliana (seed `50_rede_social.sql`); as duas perguntas. **Marina** — 2 de 5, próximo "Responda aos
pedidos"; em "O que está esperando você", o pedido de mensagem da Gabriela, o pedido de mentoria da
Yasmin, o convite da Débora, a candidatura da Yasmin e os outros avisos não lidos; as duas perguntas
com "Fala de: python" e "Fala de: carreira acadêmica".

## 5. Testes

| Arquivo                                    | O que cobre                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/painel/next-steps.test.ts`        | ordem e "feito" da mentoranda; variante sem mentoria; trilha da mentora; tudo feito; mensagem travada até o aceite; nunca cobra campos opcionais                                                                                                                                      |
| `src/lib/painel/questions-for-you.test.ts` | "Estatistica" × "estatística"; título/corpo como palavra inteira; área e tema; exclui o tópico dela (inclusive o anônimo dela); trancados e antigos; mais recentes; máximo 3                                                                                                          |
| `src/lib/painel/queries.test.ts`           | no máximo 6 idas, todas com limite (inclusive listas embutidas); filtros de segurança (inclusive os avisos já listados com nome fora da contagem); montagem; um bloco falhando sozinho                                                                                                |
| `src/lib/painel/network.test.ts`           | quais conversas diretas entram nas pendências (pedidos recebidos, lidos ou não; conversas aceitas com mensagem nova) e a ordem                                                                                                                                                        |
| `src/lib/demo/personas.test.ts`            | slug desconhecido → null; `isDemoEmail`; admin e moderação nunca na lista; lista imutável                                                                                                                                                                                             |
| `src/lib/demo/gate.test.ts`                | modo desligado → `/demo` 404, action recusa sem abrir sessão, faixa sem chamada ao Supabase; ligado → personas, slug forjado recusado, redirecionamento, faixa                                                                                                                        |
| `src/lib/demo/session.test.ts`             | link mágico sem e-mail, `signOut` local, conta inexistente não é criada, conferência antes de deslogar, persona promovida a moderadora/admin recusada, corrida (até 3 tentativas), plano B por senha (com a mesma conferência), sem configuração; exclusão de conta fictícia recusada |
| `src/lib/profile/redirect.test.ts`         | destino padrão `/painel`                                                                                                                                                                                                                                                              |
| `scripts/e2e/painel-demo.mjs`              | jornada com Playwright (abaixo)                                                                                                                                                                                                                                                       |

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
