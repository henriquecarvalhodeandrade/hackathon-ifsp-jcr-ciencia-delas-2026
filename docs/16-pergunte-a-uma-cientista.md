# 16 · Pergunte a uma cientista

> Uma porta de entrada **sem conta** para quem ainda não pesquisa: estudantes do ensino médio,
> do técnico integrado e do começo da graduação mandam uma pergunta **anônima**, a moderação
> **aprova antes** de qualquer coisa ficar pública, cientistas da rede **respondem em público** e a
> estudante acompanha tudo por um **link privado** que recebe ao enviar. Sem contas, sem dados de
> contato e sem canal privado entre uma pessoa adulta e uma estudante que pode ter menos de 18 anos.

**Resumo:** até aqui a Artemis era um clube de quem já pesquisa: para perguntar qualquer coisa era
preciso criar conta e fazer o cadastro de pesquisadora. No IFSP Jacareí há estudantes do técnico
integrado que ainda não sabem se a ciência "é para elas", e é com elas que o funil começa. O
Pergunte a uma cientista é seguro por desenho: nada que identifique quem pergunta é guardado, nada
aparece antes da moderação, a identidade de quem responde aparece só se ela quiser (resposta por
resposta) e os filtros de dados pessoais rodam no navegador, no servidor e no banco.

---

## 1. Rotas

| Rota                           | Quem              | O quê                                                                                                                                                                                                                                                              |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/pergunte`                    | todo mundo        | Formulário da pergunta, "Como funciona", "Perguntas respondidas" (filtros por etapa e área, 10 por página) e, para membras com cadastro completo, "Perguntas esperando resposta".                                                                                  |
| `/pergunte/[id]`               | todo mundo        | Pergunta publicada e respostas visíveis. Membras com cadastro completo respondem (e veem as próprias respostas ocultadas, para apagar); visitantes veem "É pesquisadora? Entre para responder"; a moderação vê "Remover pergunta". Não publicada ou apagada → 404. |
| `/pergunte/acompanhar/[token]` | quem tem o link   | Andamento ("Em análise", "Publicada", "Respondida", "Não publicada" com o motivo) e "Apagar minha pergunta". `noindex` e `referrer: no-referrer`.                                                                                                                  |
| `/admin?aba=perguntas`         | moderação e admin | Fila de revisão (mais antigas primeiro) e respostas dos últimos 14 dias, com Publicar, Não publicar (motivo obrigatório) e Ocultar/Reexibir. A aba mostra quantas estão pendentes.                                                                                 |
| `/pergunte?pergunta=apagada`   | quem apagou       | Confirmação depois de apagar pelo link (o token sai da barra de endereço).                                                                                                                                                                                         |
| `/pergunte?pergunta=removida`  | moderação         | Confirmação depois de remover uma pergunta de vez em `/pergunte/[id]`.                                                                                                                                                                                             |

A lista mora no grupo de rotas `src/app/pergunte/(lista)/` junto com o `loading.tsx`: um
`loading.tsx` em `src/app/pergunte/` envolveria também `/pergunte/[id]` num Suspense, e uma pergunta
inexistente responderia 200 em vez de 404.

## 2. Fluxo

1. **A estudante pergunta** (`/pergunte`): texto de 30 a 800 caracteres, etapa e área opcionais. Um
   aviso pede para não escrever nome, escola, e-mail, telefone ou @. Enquanto ela digita, o
   navegador avisa se encontrou um dado pessoal, mostrando o tipo e o trecho (ex.: "link
   (“anos.Me”)", com a dica de pôr um espaço depois do ponto quando não é um link); no envio, a
   mesma validação roda no navegador, no servidor (zod) e no banco, sempre com a mesma mensagem.
2. **Ela recebe o link** de acompanhamento na própria tela (estado do `useActionState`, nunca numa
   URL de redirect), com botão de copiar e o aviso "Só quem tiver este link vê o andamento. Não
   conseguimos recuperá-lo depois." O link não é guardado no navegador: o computador pode ser
   compartilhado (laboratório da escola).
3. **A moderação revisa** em `/admin?aba=perguntas`: **Publicar** ou **Não publicar** com um motivo da
   lista. Nada aparece no site antes disso.
4. **Cientistas respondem** em `/pergunte/[id]` (cadastro completo). A caixa "Mostrar meu nome e minha
   etapa da carreira nesta resposta" vem desmarcada; desmarcada, a resposta aparece como "Uma
   cientista da rede". Um aviso lembra que quem pergunta pode ter menos de 18 anos, e o mesmo aviso
   ao vivo da pergunta aponta contatos no texto antes do envio.
5. **A estudante acompanha** pelo link: em análise → publicada → respondida (ou não publicada, com
   um texto acolhedor sobre o motivo). Pelo mesmo link ela **apaga** a pergunta quando quiser; as
   respostas vão junto.
6. **A moderação acompanha as respostas** recentes (com o nome de quem respondeu, só para ela) e
   pode **ocultar** ou **reexibir** qualquer uma. A autora vê, na página da pergunta, que a resposta
   dela foi ocultada (sem saber por quem) e pode apagá-la.
7. **A moderação remove de vez** (em `/pergunte/[id]`, "Remover pergunta", motivo obrigatório) uma
   pergunta publicada que identifica a estudante, ou quando ela pede a exclusão e não tem mais o
   link. As respostas vão junto e a remoção fica no Registro.

## 3. Modelo de proteção

| Medida                                   | Como                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem conta                                | `submit_public_question` é liberada para `anon`. O app chama a RPC com um **cliente sem sessão** (`createAnonymousClient`): nem a conta de quem está logada vai junto.                                                                                           |
| Nenhum identificador guardado            | `public_questions` não tem autora, `auth.uid()`, IP nem navegador. Como a chamada sai do servidor do app, o banco também nunca vê o IP da estudante (só se alguém chamar a API direto, e aí só os logs da infraestrutura do Supabase, nunca o banco da Artemis). |
| Hora do envio só para a moderação        | `created_at` não está no GRANT de leitura: a hora exata do envio, cruzada com um registro de rede (escola, roteador de casa), poderia apontar a estudante. O público vê `published_at` (hora da moderação); a fila usa `list_pending_public_questions`.          |
| Link de acompanhamento com hash          | Token aleatório de 24 bytes (192 bits, base64url, 32 caracteres) gerado no banco. Só o SHA-256 fica em `tracking_token_hash`, que nem `anon`, nem membras, nem a moderação leem (GRANT por coluna). O token aparece uma única vez, na tela de sucesso.           |
| Pré-moderação                            | RLS: `anon` e membras só leem `status = 'published'`. Não há INSERT/UPDATE/DELETE na tabela pela API: toda escrita passa pelas RPCs.                                                                                                                             |
| Sem canal privado                        | Não existe mensagem direta, perfil de quem pergunta nem notificação para ela. Respostas são públicas e **também** não podem ter contatos (CD047).                                                                                                                |
| Identidade de quem responde por consenso | `show_identity` por resposta (padrão: falso). `list_public_answers` devolve nome, etapa e "mentora" só quando ela marcou, e **nunca** devolve `author_id` (só `is_mine`). `anon` nem lê a tabela `public_answers`.                                               |
| Filtros de dados pessoais em 3 camadas   | `src/lib/pergunte/pii.ts` (navegador e servidor) e `private.detect_personal_data` (banco, nas RPCs e no trigger das respostas) usam **as mesmas expressões**; `pii.test.ts` lê a migration e compara as duas listas.                                             |
| Exclusão por quem perguntou              | `delete_public_question_by_token`: em qualquer status; as respostas vão em cascata.                                                                                                                                                                              |
| Remoção pela moderação                   | `remove_public_question`: apaga de vez (respostas em cascata) uma pergunta que passou na revisão identificando a estudante, ou a pedido dela sem o link (LGPD, art. 18). Motivo obrigatório, registrado como `delete_content`.                                   |
| Quem ocultou não aparece                 | `hidden_by` fica fora do GRANT de leitura: a autora vê que a resposta foi ocultada (`is_hidden`, `hidden_at`), não por quem; quem agiu fica só no registro da moderação.                                                                                         |
| Recusadas somem                          | A cada envio, as perguntas recusadas há mais de 30 dias são apagadas.                                                                                                                                                                                            |
| Anti-robô e anti-enxurrada               | Campo-armadilha `site` (invisível, fora da tabulação), envio mais rápido que 3 s recusado com erro genérico, no máximo **50 pendentes** na fila (CD040, contagem serializada) e 20 respostas por hora por pessoa (CD045).                                        |

### 3.1 O que o filtro de dados pessoais pega

Antes de comparar, o texto passa por NFKC (＠ e dígitos largos viram ASCII), perde caracteres
invisíveis (zero-width, hífen suave) e barras invertidas (no Markdown das respostas, `99876\-5432`
aparece como `99876-5432`) e troca o ponto ideográfico `。` (que o navegador lê como `.` num
endereço) por `.`, nos dois lados.

| Tipo          | Exemplos recusados                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `email`       | `ana.souza@gmail.com`, `ana arroba gmail ponto com`, `ana @ gmail.com`, `ana (at) gmail.com`                                        |
| `telefone`    | `(12) 99876-5432`, `12 998765432`, `+55 12 9 9876-5432`, `99876-5432`, `(12) 3951-1234`, `12.99876.5432`                            |
| `documento`   | CPF `123.456.789-09` ou `12345678909`, RG `12.345.678-9`                                                                            |
| `rede_social` | `@ana_sci`, `instagram.com/ana`, `wa.me/55…`, `t.me/…`, TikTok, Facebook, X, LinkedIn, Discord, linktree e encurtadores (`bit.ly`…) |
|               | e contatos disfarçados: `%XX` no nome do site (`https://%69nstagram.com`) e entidades HTML (`&commat;`, `&#64;`)                    |
| `link`        | `https://…`, `www.…`, `site.com.br` — **só na pergunta**; na resposta, links para sites oficiais podem                              |

Passam (não são dado pessoal): `em 2026`, `10.000 células`, `CO2`, `pH 7,4`, `Lei 9.394`,
`capítulo 12`, `2019-2022`, `R$ 1.234.567,89`, `%XX` no caminho de um site oficial
(`https://www.gov.br/…/informa%C3%A7%C3%A3o`). Sem `\b` (que no Postgres é `\y`): as fronteiras usam `(?<![0-9])` e
`(?![0-9])`, iguais em JavaScript e no Postgres. Navegadores sem lookbehind (Safari < 16.4) pulam a
checagem só no navegador; servidor e banco continuam conferindo.

## 4. Banco de dados

Migration `supabase/migrations/20261028190100_public_questions.sql`.

### 4.1 Tabelas

**`public.public_questions`** — `id`, `body` (30–800 caracteres sem espaços nas pontas), `stage`
(`ensino_medio_tecnico` | `graduacao` | `outro` | nulo), `area_id` (grande área de
`research_areas`, nulo), `status` (`pending` | `published` | `rejected`), `reject_reason`
(`fora_do_tema` | `dados_pessoais` | `conteudo_improprio` | `duplicada`), `tracking_token_hash`
(único), `created_at`, `reviewed_at`, `published_at`, `reviewed_by`. CHECKs de coerência: motivo
só quando recusada, `published_at` só quando publicada, `reviewed_at` só depois da revisão.

- RLS: `anon`/`authenticated` leem publicadas; moderação lê todas.
- GRANT: `select (id, body, stage, area_id, status, published_at)` para `anon` e `authenticated`.
  Nada de escrita. **`created_at` fica fora**: a hora exata do envio, cruzada com um registro de
  rede (da escola, do roteador de casa), poderia apontar quem perguntou. O público vê só
  `published_at` (a hora da moderação); a fila lê `created_at` por `list_pending_public_questions`.

**`public.public_answers`** — `id`, `question_id` (cascata), `author_id` (padrão `auth.uid()`,
cascata quando a conta é excluída), `body` (20–3.000), `show_identity` (falso), `is_hidden`,
`hidden_at`, `hidden_by`, `created_at`.

- RLS: a autora e a moderação leem; a autora insere em nome próprio e apaga as suas.
- GRANT: `select (id, question_id, author_id, body, show_identity, is_hidden, hidden_at,
created_at)` (sem `hidden_by`), `delete` e `insert (question_id, author_id, body, show_identity)`
  para `authenticated`; nada para `anon`. `author_id` entra no GRANT (como `sender_id` em
  `mentorship_messages`) só para que uma autoria forjada receba a mensagem CD013 do trigger.
- Trigger `BEFORE INSERT` (SECURITY DEFINER), nesta ordem: autoria (CD013), cadastro completo
  (CD044), pergunta publicada com `FOR SHARE` (CD043), contatos (CD047) e, por último, o limite de
  20 por hora (`private.enforce_rate_limit('public_answer', …)`, CD045 — um envio recusado não gasta
  a cota). Visibilidade e data vêm do servidor.

**CHECKs compartilhados** (esta lane é a dona; as listas são repetidas inteiras):
`private.rate_limit_events_action_check` ganha `public_answer`; `moderation_audit_log` ganha as
ações `publish_question`, `reject_question`, `hide_answer`, `unhide_answer` e os alvos
`public_question`, `public_answer`. Nenhum valor novo em enums.

### 4.2 RPCs (SECURITY DEFINER, `search_path = ''`, EXECUTE explícito)

| RPC                                                                        | Quem                    | Faz                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_public_question(p_body, p_stage?, p_area_id?) → text`              | anon, authenticated     | Valida (CD042, CD041), trava a fila (CD040), apaga recusadas antigas, grava o hash e devolve o token.                                                                              |
| `get_public_question_status(p_token)`                                      | anon, authenticated     | `status`, `question_id` (só publicada), `answer_count` (visíveis), `reject_reason` (só recusada), `created_at`, `body`. Token inválido → nenhuma linha.                            |
| `delete_public_question_by_token(p_token) → boolean`                       | anon, authenticated     | Apaga em qualquer status (respostas em cascata).                                                                                                                                   |
| `list_public_questions(p_filter, p_stage?, p_area_id?, p_limit, p_offset)` | anon, authenticated     | Publicadas, mais recentes primeiro; `respondidas` / `sem_resposta` / `todas`; limite máximo 50; conta só respostas visíveis; `total_count` para paginar.                           |
| `list_public_answers(p_question_id)`                                       | anon, authenticated     | Respostas visíveis de pergunta publicada, mais antigas primeiro; identidade só com `show_identity`; `is_mine`; nunca `author_id`.                                                  |
| `review_public_question(p_question_id, p_decision, p_reason?)`             | moderação (senão 42501) | `publish` ou `reject` (motivo obrigatório, 22023), só de pendente (CD046); grava status, datas e quem revisou; registra `publish_question`/`reject_question` com o motivo legível. |
| `set_public_answer_hidden(p_answer_id, p_hidden, p_reason?) → boolean`     | moderação (senão 42501) | Oculta/reexibe; `false` quando já estava assim (nada registrado); registra `hide_answer`/`unhide_answer`.                                                                          |
| `list_pending_public_questions(p_limit?)`                                  | moderação (senão 42501) | Fila de pendentes, mais antigas primeiro, com `created_at` (que a API não expõe a mais ninguém); limite máximo 100.                                                                |
| `remove_public_question(p_question_id, p_reason)`                          | moderação (senão 42501) | Apaga de vez em qualquer status (respostas em cascata); motivo de 10 a 500 caracteres (22023); inexistente → CD015; registra `delete_content` com alvo `public_question`.          |

### 4.3 Códigos de erro

| Código | Quando                            | Mensagem                                                                                                                               |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| CD040  | 50 perguntas pendentes            | Recebemos muitas perguntas agora e a moderação está dando conta delas. Tente de novo mais tarde.                                       |
| CD041  | dado pessoal na pergunta          | Para proteger você, tire da pergunta e-mails, telefones, documentos, links e @ de redes sociais.                                       |
| CD042  | tamanho, etapa ou área inválidos  | Sua pergunta precisa ter entre 30 e 800 caracteres. (variantes para etapa e área)                                                      |
| CD043  | resposta a pergunta não publicada | Esta pergunta não está aberta para respostas.                                                                                          |
| CD044  | resposta sem cadastro completo    | Complete seu cadastro na Artemis para responder.                                                                                       |
| CD045  | 21ª resposta em uma hora          | Você respondeu muitas perguntas na última hora. Obrigada! Tente de novo em alguns minutos.                                             |
| CD046  | segunda revisão                   | Esta pergunta já foi revisada por outra moderadora.                                                                                    |
| CD047  | contato na resposta               | Para a segurança de quem perguntou, não compartilhe e-mail, telefone ou redes sociais. Indique caminhos públicos, como sites oficiais. |

Reaproveitados: CD013 (autoria forjada), CD015 (pergunta/resposta não encontrada na moderação),
42501 (não é moderação) e 22023 (decisão, motivo, motivo da remoção ou filtro inválidos).

## 5. Moderação e registro

A aba **Perguntas** do `/admin` (moderadoras e admins) mostra a contagem de pendentes mesmo fora
dela. Cada decisão vai para o `moderation_audit_log` e aparece no **Registro**:

| Ação               | Rótulo no Registro      | Alvo             | Link no Registro       |
| ------------------ | ----------------------- | ---------------- | ---------------------- |
| `publish_question` | publicou a pergunta     | Pergunta pública | `/pergunte/<id>`       |
| `reject_question`  | não publicou a pergunta | Pergunta pública | `/pergunte/<id>` (404) |
| `hide_answer`      | ocultou a resposta      | Resposta pública | `/admin?aba=perguntas` |
| `unhide_answer`    | reexibiu a resposta     | Resposta pública | `/admin?aba=perguntas` |
| `delete_content`   | excluiu o conteúdo      | Pergunta pública | `/pergunte/<id>` (404) |

Critério sugerido para publicar: é sobre ciência, pesquisa ou carreira científica e não identifica
quem perguntou (nome, escola, cidade pequena, contatos). Na dúvida, não publique com o motivo
"Dados pessoais": a estudante vê "Ela tinha informações que poderiam identificar você. Envie de novo
sem elas." Se algo que identifica a estudante passar, use **Remover pergunta** na página dela (a
remoção também atende quem pede a exclusão sem ter o link). A autora de uma resposta ocultada não
recebe notificação; ela vê o aviso "Uma resposta sua foi ocultada pela moderação" na página da
pergunta, sem saber quem ocultou, e pode apagá-la.

## 6. Código

| Caminho                                                       | O quê                                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib/pergunte/pii.ts`                                     | `detectPersonalData` / `findPersonalData` (tipo e trecho), `PII_PATTERNS` (iguais ao banco), CD041/CD047. |
| `src/lib/pergunte/schemas.ts`                                 | zod com mensagens pt-BR; tamanhos contados como o Postgres (`charLength`).                                |
| `src/lib/pergunte/token.ts` · `labels.ts` · `params.ts`       | formato do token, rótulos (etapas, motivos, identidade) e filtros da URL.                                 |
| `src/lib/pergunte/queries.ts` · `actions.ts`                  | só servidor: leituras (cliente anônimo para o link) e Server Actions.                                     |
| `src/app/pergunte/(lista)/` · `[id]/` · `acompanhar/[token]/` | as três páginas.                                                                                          |
| `src/components/pergunte/`                                    | formulários, listas, fila da moderação e as peças da integração (abaixo).                                 |

Peças montadas fora do `/pergunte`: `landing-cta.tsx` (`<PergunteLandingCta />`, seção da landing
depois de `<MentorshipSteps />`) e `awaiting-questions-card.tsx` (`<AwaitingQuestionsCard />`, cartão
do `/painel` com até 3 perguntas sem resposta; não renderiza nada sem perguntas). "Pergunte" está na
navegação principal (de visitantes e de membras, logo depois de "Fórum") e no rodapé (Comunidade → "Pergunte a uma cientista"); `/pergunte` está no
sitemap e `/pergunte/acompanhar/` fora do `robots.txt`. "Baixar meus dados" traz as respostas da
membra (`respostas_pergunte_a_uma_cientista`); nenhuma pergunta é exportada como de alguém.

## 7. Demonstração (dados fictícios)

`supabase/seeds/30_pergunte.sql` (idempotente; toda pergunta termina com "(pergunta fictícia de
demonstração)"): 4 perguntas respondidas por mentoras fictícias (duas respostas com nome, três sem),
1 publicada sem resposta e 1 pendente. As respostas dão só conselhos gerais.

**Token de demonstração** (pergunta pendente "Tenho medo de não ser inteligente o suficiente…"):

```
DemoPergunte-Artemis2026-IFSPjcr
```

Página: `<site>/pergunte/acompanhar/DemoPergunte-Artemis2026-IFSPjcr` (mostra "Em análise pela
moderação"). Ele está neste documento público de propósito: é só para o pitch. Quem o tiver pode
apagar a pergunta de demonstração; rode o seed de novo para recriá-la.

Roteiro sugerido (2 minutos): um jurado manda uma pergunta pelo celular em `/pergunte` e guarda o
link → a moderadora (`moderacao@`) publica na aba Perguntas → a mentora (`marina@`) responde sem
mostrar o nome → o jurado abre o link e vê "Respondida: 1 resposta".

## 8. Testes

```bash
npx vitest run src/lib/pergunte src/lib/admin
psql "$DB" -f supabase/tests/database/pergunte.test.sql      # ou: npx supabase test db
# app rodando (ex.: next start -p 3803) + Supabase local com o seed:
BASE_URL=http://localhost:3803 node scripts/e2e/pergunte.mjs
```

- **pgTAP** (`pergunte.test.sql`, usuárias `f3…`, schema `cdtest_perg`, tudo em `rollback`):
  estrutura e GRANTs; envio anônimo com token de 32 caracteres e só o hash no banco; pendente
  invisível; `tracking_token_hash` → 42501 para anon, membras e moderação; `created_at` → 42501 para
  anon e membras, e a fila `list_pending_public_questions` só para a moderação; CD041/CD042/CD040;
  limpeza das recusadas antigas; revisão (42501, 22023, CD015, CD046) e auditoria (inclusive uma
  ação antiga, `lock_thread`, continua aceita); respostas (anon sem leitura, CD044, CD043, CD047,
  CD013, CD045, link https permitido); identidade só com consentimento e sem `author_id`;
  ocultar/reexibir (`hidden_by` fora da leitura da API); remoção pela moderação (42501, 22023,
  CD015, cascata e registro `delete_content`); contatos disfarçados (`ana @ gmail.com`, `(at)`,
  `。`, `%XX`, entidades HTML, barra invertida); acompanhamento e exclusão em cascata; higiene das
  funções.
- **Vitest**: detector (positivos, negativos, NFKC/invisíveis, links em respostas) e **paridade com a
  migration**; schemas; token; rótulos; filtros; parâmetros e rótulos do `/admin`.
- **E2E** (`scripts/e2e/pergunte.mjs`): visitante a 390 px **só com o teclado** envia e recebe o
  link (o token não aparece na URL); pendente invisível pela API; pergunta com e-mail recusada na
  tela e no banco (e telefone pela API); `moderacao@` publica e o Registro mostra "publicou a
  pergunta"; `marina@` responde sem o nome; o visitante vê "Uma cientista da rede" e "Respondida";
  `moderacao@` oculta, a resposta some e a `marina@` vê o aviso de resposta ocultada; o visitante
  apaga pelo link e `/pergunte/<id>` responde 404; `moderacao@` remove de vez uma segunda pergunta
  (motivo obrigatório, 404 e "excluiu o conteúdo" no Registro); 28 capturas (claro/escuro ×
  1440/390) com rolagem horizontal, contraste AA, console e hidratação. Marca `e2e-perg-<execução>`; limpa as perguntas e as linhas do registro com a service
  role (no começo e no fim).

## 9. Parágrafo para a página de Privacidade (LGPD)

> **Pergunte a uma cientista.** Para perguntar, você não precisa criar conta nem dizer quem é. Não
> guardamos seu nome, e-mail, endereço IP, navegador nem qualquer identificador junto com a
> pergunta — nem quando você está logada. Toda pergunta passa pela moderação antes de ficar
> pública, e pedimos que você não escreva dados pessoais (o sistema recusa e-mails, telefones,
> documentos, links e perfis de redes sociais). Ao enviar, você recebe um link de acompanhamento:
> guardamos apenas uma versão cifrada dele (hash), que ninguém consegue ler nem transformar de
> volta no link, por isso não conseguimos recuperá-lo. Por esse link você vê o andamento e pode
> apagar sua pergunta a qualquer momento, junto com as respostas. Se perder o link, você pode pedir
> a exclusão pelo contato desta página, indicando a pergunta: a moderação a remove sem precisar
> saber quem você é, e também remove por conta própria uma pergunta publicada que permita
> identificar quem perguntou. Perguntas não publicadas são
> apagadas 30 dias depois da revisão. As respostas são públicas e mostram o nome e a etapa da
> carreira de quem respondeu somente quando ela escolhe, resposta por resposta; a moderação sempre
> sabe quem respondeu. Quem exclui a conta na Artemis apaga também as próprias respostas.

## 10. Limitações e próximos passos

- **Sem denúncia de respostas por membras ainda**: não há valor `public_answer` no enum
  `report_target` (mudar enums quebraria os `Record` exaustivos do TypeScript de outras partes).
  Enquanto isso, a moderação revê todas as respostas dos últimos 14 dias na fila.
- **Sem CAPTCHA**: o Turnstile em `/pergunte` está no roadmap. Hoje há campo-armadilha, tempo
  mínimo de 3 s e o teto de 50 pendentes — um robô insistente consegue encher a fila (e aí todo
  mundo recebe CD040 até a moderação revisar ou recusar em lote).
- Não há aviso para a estudante (ela não tem conta nem contato): ela volta ao link.
- A autora de uma resposta ocultada não recebe notificação (só vê o aviso na página da pergunta).
- Moderação não edita o texto da pergunta (para tirar um nome, por exemplo): recusa com "Dados
  pessoais" e a estudante envia de novo; se já estiver publicada, **Remover pergunta**.
- O filtro de dados pessoais é uma proteção contra descuidos, não contra quem quer burlar:
  contatos escritos por extenso ("meu insta é ana_sci", "doze nove nove…") ou dígitos separados um
  a um passam. Perguntas são pré-moderadas; respostas aparecem na hora e a moderação revê as dos
  últimos 14 dias.
- Uma pergunta só com espaços "invisíveis" (por exemplo, `&nbsp;` colado como caractere) chamada
  direto pela API passa o tamanho mínimo no banco; o app recusa (zod corta todo espaço Unicode) e a
  moderação recusa na fila.
- Encurtadores e "linktree" contam como rede social nas respostas; links comuns (`https://…`)
  passam, e a moderação confere o destino na fila.
