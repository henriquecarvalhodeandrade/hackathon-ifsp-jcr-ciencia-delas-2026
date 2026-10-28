# 15 · Reconhecimento da mentoria: retorno privado, declaração verificável e impacto (k ≥ 5)

> O que acontece **depois de "Concluir mentoria"**: cada participante pode deixar um retorno
> privado de 30 segundos; juntas, as duas podem emitir uma **Declaração de participação em
> mentoria** com código público e QR code; e a plataforma publica só números agregados, a partir
> de 5 retornos. Migration `20261028190000_mentorship_recognition.sql`, seed
> `supabase/seeds/20_reconhecimento.sql`, testes em `supabase/tests/database/reconhecimento.test.sql`,
> `src/lib/recognition/*.test.ts` e `scripts/e2e/reconhecimento.mjs`.

**Resumo:** antes, concluir uma mentoria era um beco sem saída e o único número de impacto era
"mentorias iniciadas". Agora, quem conclui cai em `/mentoria/concluida/<pedido>`; a outra
participante recebe um aviso com o mesmo link. O retorno é opcional e **só a autora o lê** — nem
a outra participante, nem a moderação, nem a administração. A declaração reconhece quem é mais
escasso na rede, as mentoras: dá para citar no currículo ou num relatório, e qualquer pessoa
confere a autenticidade em `/verificar/<código>` (o QR leva direto para lá). Ela só fica pública
com as **duas** autorizações, mostra o mínimo (nomes, papéis, período e temas) e pode ser
revogada por qualquer uma das duas. O impacto agregado responde à pergunta "como vocês sabem que
funciona?" sem expor ninguém: nada aparece antes de 5 retornos e opções marcadas por menos de 3
pessoas viram "menos de 3".

---

## 1. Rotas

| Rota                           | Acesso                                           | O que mostra                                                                               |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/mentoria/concluida/<pedido>` | as duas participantes (404 para o resto)         | "Mentoria concluída. Obrigada por fazer parte.", retorno, declaração e impacto             |
|                                | mentoria ainda não concluída                     | `307 → /mentoria?aba=ativas`                                                               |
| `/mentoria/declaracao/<id>`    | as duas participantes, só emitida e não revogada | folha A4 para imprimir/salvar em PDF, QR code e linha sugerida para o currículo            |
| `/mentoria?aba=ativas`         | membros                                          | cada mentoria concluída ganha o painel de reconhecimento (retorno + declaração)            |
| `/verificar`                   | público                                          | explicação e formulário "Código da declaração" (GET `?codigo=` → `/verificar/<código>`)    |
| `/verificar/<código>`          | público, `noindex`, `referrer: no-referrer`      | válida (nomes, papéis, período, temas, emitida em), revogada (sem nomes) ou não encontrada |

- `/mentoria/*` é protegido pelo proxy (precisa de sessão); `/verificar` **não** é (é para quem
  recebe a declaração).
- `/verificar/<código>` normaliza o que foi digitado (minúsculas, espaços, sem prefixo, O → 0,
  I/L → 1) e redireciona para o endereço canônico. Formato inválido nem chega ao banco.
- Componentes montados pela integração: `<ImpactSummary />` (landing) e
  `<RecognitionTodos userId={…} />` (`/painel`, "Para fechar suas mentorias").

## 2. Fluxos

```
Concluir mentoria (qualquer das duas)
  └─ redirect /mentoria/concluida/<pedido>          ← a outra recebe aviso com este link
       ├─ Retorno (opcional, só a autora vê) ──── "Agora não" volta para /mentoria?aba=ativas
       └─ Declaração
            sem declaração ── [x] Autorizo… + "Pedir declaração" ─┐   (autorização de quem pede)
                                                                  ▼
            a outra vê: "<Nome> pediu a declaração desta mentoria. Autorize seu nome para emiti-la."
                 ├─ [x] Autorizo… + "Autorizar e emitir" ──► EMITIDA (pública em /verificar/<código>)
                 └─ "Recusar" ──► pedido cancelado (nenhum nome publicado)
            quem pediu vê: "Aguardando a autorização de <Nome>" (+ "Cancelar pedido")
            emitida: código, "Ver declaração", "Revogar" (motivo opcional) ──► REVOGADA
            revogada/cancelada: "Revogada em <data>" + "Pedir uma nova"
```

- **Retorno** (`mentorship_feedback`): nota de ajuda de 1 a 5 (a única obrigatória), opções do
  que mudou (por papel), "Você indicaria a Artemis para outra pesquisadora?" (Sim / Não / Prefiro
  não dizer) e uma nota de até 500 caracteres ("Só você vê esta nota."). Uma vez por participante
  e mentoria; não há edição — ela pode **apagar** e responder de novo.
- **Pendências** (`RecognitionTodos`): declarações esperando a autorização dela (sempre) e
  mentorias concluídas nos últimos **30 dias** sem o retorno dela. Depois de 30 dias o lembrete
  some: o retorno é opcional, não uma cobrança.
- Cada ação redireciona com um aviso conhecido (`?aviso=retorno-enviado`, `declaracao-pedida`,
  `declaracao-emitida`, `declaracao-revogada`, `declaracao-cancelada`, `retorno-apagado` —
  `src/lib/mentorship/presentation.ts`), anunciado por leitor de tela (`role="status"`).

## 3. Banco de dados

### 3.1 `mentorship_requests.completed_at`

| Regra                                                                                     | Onde                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Coluna nova; mentorias já concluídas recebem `updated_at` (backfill)                      | migration                                             |
| Na transição para `completed`, `completed_at := now()`                                    | trigger `mentorship_requests_set_completed_at` (novo) |
| Contexto confiável (seed/service role) pode informar a data; nos demais casos ela fica    | mesmo trigger                                         |
| Membras não escrevem a coluna (o UPDATE delas continua só de `status`/`response_message`) | GRANTs (42501)                                        |

O trigger de máquina de estados (`mentorship_requests_before_update`) não mudou; o novo roda
depois dele (ordem alfabética). O aviso de conclusão (`private.notify_mentorship_change`, mesmo
corpo da migration `20261028130000`) passou a apontar para `/mentoria/concluida/<pedido>`; se o
pedido for apagado (exclusão de conta), esse aviso some junto
(`mentorship_requests_after_delete_recognition`).

### 3.2 `mentorship_feedback` (retorno privado)

| Coluna            | Regra                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `request_id`      | FK → `mentorship_requests` (`on delete cascade`)                  |
| `author_id`       | `default auth.uid()`; FK → `profiles` (`on delete cascade`)       |
| `role`            | `mentee`/`mentor`, **definido pelo trigger** a partir do pedido   |
| `helpfulness`     | 1–5                                                               |
| `outcomes`        | até 6, subconjunto do catálogo **do papel** (repetidas viram uma) |
| `would_recommend` | `true` / `false` / `null` (prefiro não dizer)                     |
| `note`            | até 500 caracteres, aparada                                       |
| único             | `(request_id, author_id)`                                         |

- **RLS:** `select` e `delete` só da autora; `insert` só da própria autora em mentoria
  concluída da qual participa. **GRANTs:** `select, delete`; `insert (request_id, helpfulness,
outcomes, would_recommend, note)`; nada de `update`. `author_id`, `role` e `created_at` vêm do
  banco.
- Catálogo (`private.mentorship_outcomes(role)`, idêntico a `src/lib/recognition/outcomes.ts` —
  um teste do Vitest lê a migration e compara):

| Papel      | Slug                   | Texto                                                  |
| ---------- | ---------------------- | ------------------------------------------------------ |
| mentoranda | `menos-sozinha`        | Me senti menos sozinha na pesquisa                     |
| mentoranda | `plano-definido`       | Saí com um plano para os próximos meses                |
| mentoranda | `iniciacao-cientifica` | Entrei ou avancei na iniciação científica              |
| mentoranda | `candidatura`          | Me candidatei a uma bolsa, edital ou processo seletivo |
| mentoranda | `trabalho-apresentado` | Submeti ou apresentei um trabalho                      |
| mentoranda | `rede-ampliada`        | Conheci pessoas e grupos da minha área                 |
| mentora    | `aprendi-tambem`       | Também aprendi com a mentoranda                        |
| mentora    | `quero-mentorar-mais`  | Quero acompanhar outras pesquisadoras                  |

### 3.3 `mentorship_declarations` (declaração de participação)

| Coluna                                       | Regra                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`                                       | `ART-XXXX-XXXX-XXXX`, Crockford base32 (sem I, L, O, U), **60 bits** de `extensions.gen_random_bytes`; gerado pelo trigger (o valor da cliente é ignorado; nova tentativa se colidir); único |
| `requested_by`                               | quem pediu (`auth.uid()`), `on delete set null`                                                                                                                                              |
| `mentee_consented_at`, `mentor_consented_at` | autorização de cada uma (a de quem pede é carimbada no pedido)                                                                                                                               |
| `issued_at`                                  | quando a segunda autorizou; antes disso o código não aparece em `/verificar`                                                                                                                 |
| `revoked_at`, `revoked_by`, `revoke_reason`  | revogação (motivo opcional, até 300 caracteres)                                                                                                                                              |
| índice                                       | **uma ativa** (não revogada) por mentoria: único parcial `(request_id) where revoked_at is null`                                                                                             |

- Só participante de mentoria **concluída** pede (CD031/CD030); a segunda ativa dá CD034; no
  máximo **5 pedidos por mentoria** (CD036, contra pedir-e-revogar em laço).
- **Sem UPDATE/DELETE para membras.** Mudanças só pelas RPCs abaixo; um trigger
  (`mentorship_declarations_before_update`) impede, até para a service role, reescrever código,
  mentoria ou datas já gravadas e desfazer uma revogação (CD037).
- **RLS:** `select` só das participantes. **GRANTs:** `select`; `insert (request_id)`.

### 3.4 RPCs

| Função                                                      | Quem               | O que faz                                                                                                                       |
| ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `consent_mentorship_declaration(p_declaration_id)`          | membras            | a participante que ainda não autorizou carimba a autorização; com as duas, emite. Devolve `issued_at`. Já autorizou → nada muda |
| `revoke_mentorship_declaration(p_declaration_id, p_reason)` | membras            | qualquer das duas revoga, uma vez (segunda vez → CD035)                                                                         |
| `verify_mentorship_declaration(p_code)`                     | **anon** e membras | `status` (`valida`/`revogada`), `mentee_name`, `mentor_name`, `period_start`, `period_end`, `themes`, `issued_at`               |
| `get_mentorship_impact()`                                   | **anon** e membras | `{completed, mentee_feedback, published_feedback, outcomes, helpfulness_avg, declarations_issued, k_min, is_demo}`              |

`verify_mentorship_declaration`:

- normaliza a entrada (maiúsculas, sem espaços/hífens, O → 0, I/L → 1, com ou sem `ART`);
- código desconhecido **e** declaração ainda não emitida → **nenhuma linha** (indistinguíveis);
- revogada → `revogada` com nomes, temas e período **nulos**;
- período em meses (aceite → conclusão), no fuso de São Paulo; temas = slugs dos temas da
  mentora (a interface traduz com `MENTORSHIP_TOPICS`);
- **nunca** devolve ids, e-mails, instituição, mensagens ou retornos;
- os nomes são lidos na hora: se uma das participantes excluir a conta, o pedido e a declaração
  somem em cascata e o código passa a "não encontrada". Os temas também: se a mentora mudar os
  temas em que orienta, a página de verificação (e a folha impressa de novo) acompanha.

`get_mentorship_impact` (`K_MIN = 5`, células com menos de 3 → `null`): `outcomes` e
`helpfulness_avg` só existem com pelo menos 5 retornos **de mentorandas** (retornos de mentoras
não entram nessa conta); `is_demo` é verdadeiro enquanto existir alguma conta
`@demo.cienciadelas.dev`. A interface aplica a mesma supressão de novo (`src/lib/recognition/impact.ts`).

**Blocos de 5 (contra dedução por diferença).** Os resultados usam só os `floor(n / 5) × 5`
retornos mais antigos (`published_feedback`); o total (`mentee_feedback`) continua público. Sem
isso, quem comparasse os números antes e depois de **um** retorno novo — por exemplo, a mentora
logo depois de concluir — deduziria a resposta da mentoranda dela: com 5 → 6 retornos, a média
passar de 4,6 para 4,0 só é possível com nota 1, e uma opção sair de "menos de 3" para 3 mostra
que ela marcou aquela opção. Com blocos, cada mudança nos resultados mistura pelo menos 5
retornos novos (pgTAP, seção 7b). As porcentagens são sobre o bloco publicado ("Entre as 5
mentorandas que responderam"); os retornos que esperam o próximo bloco aparecem só no total.
Limite conhecido: ninguém se protege, com agregados, de quem cria várias contas falsas para
isolar uma resposta (ataque n−1); a moderação e o limite de pedidos de mentoria tornam isso caro.

### 3.5 Códigos de erro

| Código | Quando                                                               | Mensagem                                                                                                                                 |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CD030  | retorno/declaração de mentoria ainda não concluída                   | Você poderá contar como foi quando a mentoria for concluída. (declaração: A declaração pode ser pedida quando a mentoria for concluída.) |
| CD031  | quem não participa — ou pedido/declaração inexistente (mesmo erro)   | Não encontramos esta mentoria.                                                                                                           |
| CD032  | segundo retorno da mesma pessoa na mesma mentoria                    | Você já contou como foi esta mentoria. Obrigada!                                                                                         |
| CD033  | opção fora do catálogo do papel dela                                 | Uma das opções escolhidas não existe mais. Recarregue a página.                                                                          |
| CD034  | segunda declaração ativa na mesma mentoria                           | Já existe uma declaração para esta mentoria.                                                                                             |
| CD035  | autorizar declaração revogada / revogar de novo                      | Esta declaração foi revogada. Peça uma nova, se quiserem. / Esta declaração já foi revogada.                                             |
| CD036  | sexto pedido de declaração para a mesma mentoria                     | Esta mentoria já teve 5 pedidos de declaração. Se precisarem de outra, fale com a equipe da Artemis.                                     |
| CD037  | tentativa de reescrever uma declaração (inclusive pela service role) | A declaração não pode ser editada: só é possível autorizar ou revogar.                                                                   |
| CD013  | retorno em nome de outra pessoa (reaproveitado)                      | Autoria inválida: envie o retorno sempre com a sua própria conta.                                                                        |
| 42501  | coluna sem GRANT (ex.: `completed_at`, `author_id`, `code`)          | (permissão do Postgres)                                                                                                                  |

## 4. Privacidade

- **Retorno:** visível só para a autora (RLS), provado no pgTAP para a outra participante, a
  moderação e a administração. A nota livre nunca entra em nenhum número.
- **Agregados:** só a partir de 5 retornos de mentorandas e atualizados em blocos de 5 (ninguém
  deduz uma resposta comparando o antes e o depois); opções com menos de 3 marcações aparecem
  como "menos de 3"; "Como calculamos" explica a regra na própria página.
- **Nomes públicos só com as duas autorizações**, dadas por uma caixa explícita ("Autorizo que
  meu nome apareça na declaração e na página pública de verificação") — tanto para pedir quanto
  para autorizar. Pendente = "não encontrada".
- **Revogação** a qualquer momento, por qualquer das duas: a página pública passa a "revogada",
  sem nomes.
- **Excluir a conta apaga tudo:** pedido, retornos (das duas), declarações e o aviso de
  conclusão; o código deixa de existir.
- **Baixar meus dados** (`/perfil/exportar`) traz `retornos_de_mentoria` (só os dela, nunca o da
  outra participante) e `declaracoes_de_mentoria` (com o status derivado: `emitida`,
  `aguardando_autorizacao`, `revogada` ou `cancelada`; sem quem pediu/revogou).
- `/verificar/<código>`: fora dos buscadores (`noindex`) e sem enviar o código como `Referer`
  para outros sites. O código tem 60 bits: adivinhar um código válido não é viável.

## 5. O que a declaração diz (e o que não diz)

Texto (`src/lib/recognition/declaration-text.ts`):

> A plataforma Artemis declara que **\<Mentora\>** participou como mentora e **\<Mentoranda\>**
> como mentoranda de uma mentoria entre pesquisadoras realizada pela plataforma entre \<mês de
> ano\> e \<mês de ano\>, com os temas: \<temas\>.

Regras de honestidade:

- declara **participação** — não é certificado, não fala em **horas** (a plataforma não as
  registra) e não avalia ninguém;
- período em meses (aceite → conclusão) e temas = os temas em que a mentora orienta;
- só a marca da Artemis: **nenhum** logo ou selo do IFSP, do governo ou de outra instituição;
- aviso fixo no rodapé: "Declaração de participação registrada na plataforma Artemis, projeto
  criado no Hackathon IFSP Câmpus Jacareí 2026. Não substitui certificado institucional: o
  aproveitamento como atividade complementar ou de extensão depende das regras de cada
  instituição. A Artemis não tem vínculo com o CNPq nem com a Plataforma Lattes.";
- o conteúdo impresso vem da **mesma** RPC da verificação pública: o papel e a página dizem a
  mesma coisa;
- linha sugerida para o currículo: "Mentoria entre pesquisadoras (como mentora|mentoranda),
  plataforma Artemis, \<período\>. Verificação: \<site\>/verificar/\<código\>".

**Impressão:** a folha é uma "ilha" de tema claro (papel branco também no tema escuro), cabe em
uma página A4 e, em `@media print`, uma regra da própria página esconde cabeçalho, rodapé, link
de pular e avisos do site (sem mexer no layout compartilhado). O QR é um SVG gerado no servidor
(pacote `qrcode`, MIT) só a partir de URLs montadas com um código já validado.

## 6. Demonstração (dados fictícios)

- **Código para o slide do pitch: `ART-7K2M-Q9XD-4HNP`** → `<site>/verificar/ART-7K2M-Q9XD-4HNP`
  mostra "Declaração válida" (Débora Alves, mentoranda; Patrícia Santos, mentora; agosto a outubro
  de 2026). Imprima o QR da própria declaração (entre como `debora@` ou `patricia@` →
  `/mentoria?aba=ativas` → "Ver declaração"). Por honestidade, a página desse código traz o selo
  "Dados de demonstração" e avisa que as duas participantes são perfis fictícios.
- Enquanto `supabase/config.toml` listar só `./seed.sql` em `[db.seed] sql_paths`, o
  `supabase db reset` não aplica este seed: rode-o depois com
  `psql "$DB" -v ON_ERROR_STOP=1 --single-transaction -f supabase/seeds/20_reconhecimento.sql`
  (pedido de integração: `sql_paths = ["./seed.sql", "./seeds/*.sql"]`).
- Seed `20_reconhecimento.sql` (idempotente): a mentoria Débora → Patrícia concluída há ~10 dias
  com os dois retornos e a declaração emitida; mais 4 mentorias concluídas fictícias (Gabriela →
  Luiza, Manuela → Carolina, Yasmin → Tatiane, Débora → Isabela), criadas pelo fluxo normal há
  60–150 dias, cada uma com o retorno da mentoranda — 5 retornos, o mínimo para o impacto
  aparecer. A seção de impacto mostra o selo "Dados de demonstração" enquanto existirem contas
  `@demo.cienciadelas.dev`.
- Roteiro de 1 minuto: `gabriela@` conclui uma mentoria → cai na página de conclusão → conta
  como foi → pede a declaração; `aline@` autoriza em `/mentoria?aba=ativas`; a banca escaneia o
  QR e vê "Declaração válida" no celular. É exatamente o que `scripts/e2e/reconhecimento.mjs` faz.

## 7. Código

| Arquivo                                       | O que tem                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/recognition/outcomes.ts`             | catálogo do retorno (mesmo do banco)                                       |
| `src/lib/recognition/code.ts`                 | `normalizeDeclarationCode`, `isDeclarationCode`, URLs                      |
| `src/lib/recognition/declaration-text.ts`     | meses em pt-BR, período, temas, texto da declaração, linha do CV           |
| `src/lib/recognition/impact.ts`               | leitura e supressão do impacto (k = 5, célula < 3)                         |
| `src/lib/recognition/state.ts`                | estado da declaração por participante, pendências do painel                |
| `src/lib/recognition/schemas.ts`, `errors.ts` | zod das actions, mensagens                                                 |
| `src/lib/recognition/queries.ts`              | leituras em lote (server-only)                                             |
| `src/lib/recognition/actions.ts`              | Server Actions (retorno, apagar, pedir, autorizar, revogar)                |
| `src/lib/recognition/qr.ts`                   | `renderQrSvg(url)` (server-only)                                           |
| `src/components/recognition/*`                | formulário do retorno, painel da declaração, folha A4, impacto, pendências |

## 8. Testes

```bash
npx vitest run src/lib/recognition src/lib/profile src/lib/mentorship/presentation.test.ts
SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io npx supabase test db   # inclui reconhecimento.test.sql
# app rodando (ex.: next start -p 3802) + Supabase local com o seed:
BASE_URL=http://localhost:3802 node scripts/e2e/reconhecimento.mjs
```

O E2E usa `gabriela@` ↔ `aline@` (contas reservadas para ele), marca o pedido com
`e2e-rec-<execução>` e apaga tudo no fim com a service role (também as sobras de execuções
anteriores); a disponibilidade da `aline@` volta ao valor original.

## 9. Parágrafo para a página de Privacidade (LGPD)

> **Retornos e declarações de mentoria.** Ao concluir uma mentoria, você pode deixar um retorno
> opcional (uma nota de 1 a 5, o que mudou para você e um comentário). O retorno é visível
> **somente para você**: nem a outra participante, nem as contas de moderação e de administração
> da plataforma têm acesso a ele. A plataforma publica apenas números agregados, só a partir de 5 retornos e
> atualizados em blocos de 5, para que nenhuma resposta individual possa ser deduzida; opções
> marcadas por menos de 3 pessoas aparecem como "menos de 3", e comentários nunca são
> publicados. Mentora e mentoranda também podem emitir uma declaração de participação: seus
> nomes, papéis, o período e os temas da mentoria aparecem na página pública de verificação
> **somente depois que as duas autorizarem**, e qualquer uma pode revogar a declaração a qualquer
> momento — depois disso, a página mostra apenas que ela foi revogada, sem nomes. Você pode
> apagar o seu retorno quando quiser, e tudo isso entra em "Baixar meus dados". Se você excluir a
> sua conta, a mentoria, os retornos e as declarações são apagados, e o código de verificação
> deixa de existir.

## 10. Limitações e decisões

- O retorno não é editável (apaga e responde de novo): menos estados, menos superfície.
- Nomes e temas são lidos na hora: quem muda o nome (por exemplo, para o nome social) vê a
  declaração acompanhar, sem pedir outra. O outro lado da moeda: a declaração atesta as **contas**
  que participaram, não uma identidade civil — a página de verificação diz que a Artemis não
  confere documentos.
- O lembrete de retorno no painel dura 30 dias; o de autorização da declaração fica até ela
  autorizar ou recusar.
- A verificação pública não tem limite de consultas: com 60 bits por código, enumerar não é
  viável, e a resposta não diz se um código existe mas ainda não foi emitido.
- O impacto conta só retornos de mentorandas; os das mentoras ficam privados e não entram em
  número nenhum por enquanto.
- O seed cria mentorias concluídas antigas para contas fictícias cadastradas há menos tempo
  (ex.: Yasmin): é só para o impacto ter 5 retornos na demonstração.
