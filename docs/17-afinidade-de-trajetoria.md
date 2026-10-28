# 17 · Afinidade de trajetória: "Vocês têm em comum" no matching, no diretório e no perfil

> Marcas **opcionais e autodeclaradas** sobre o caminho de cada uma ("fui a primeira da família
> na universidade", "vim do ensino técnico"…), de um catálogo fechado de 8 opções, viram três
> coisas: um pequeno bônus **explicado** na sugestão por afinidade, um filtro no diretório e uma
> seção no perfil de membras. Tudo funciona **sem nenhuma chave de IA**. Migration
> `20261028190200_trajectory_affinity.sql`, seed `supabase/seeds/40_trajetoria.sql`, testes em
> `supabase/tests/database/trajetoria.test.sql`, `src/lib/trajectory/catalog.test.ts`,
> `src/lib/matching/trajectory*.test.ts` e `scripts/e2e/trajetoria.mjs`.

**Resumo:** o problema nº 1 do [docs/00](00-visao-geral.md) é a falta de referências por perto. Para
quem é a primeira da família na universidade, para mães e para quem veio do técnico, "uma mentora
da minha área" não basta: faz diferença saber que ela **passou pelo mesmo caminho**. Agora o
cartão de sugestão diz isso com todas as letras — _"Vocês têm em comum: as duas foram as primeiras
da família na universidade e estudaram em escola pública."_ — e mostra a linha **Em comum na
trajetória**. Marcar é opcional, só membras veem, nada disso vai para a IA, e não marcar (ou ter um
caminho diferente) **nunca** tira ponto de ninguém.

---

## 1. O catálogo (fechado)

Fonte única: `src/lib/trajectory/catalog.ts`. Os slugs se repetem no CHECK e no trigger da
migration; `catalog.test.ts` lê o arquivo SQL e confere que as três listas são iguais.

| Slug                  | No formulário (1ª pessoa)                 | Chip curto                          | Frase sobre as duas                                   |
| --------------------- | ----------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `primeira-geracao`    | Fui a primeira da família na universidade | Primeira da família na universidade | as duas foram as primeiras da família na universidade |
| `escola-publica`      | Estudei em escola pública                 | Escola pública                      | as duas estudaram em escola pública                   |
| `ensino-tecnico`      | Vim do ensino técnico                     | Ensino técnico                      | as duas vieram do ensino técnico                      |
| `mae-cuidadora`       | Sou mãe ou cuidadora                      | Mãe ou cuidadora                    | as duas conciliam (ou conciliaram) pesquisa e cuidado |
| `trabalha-e-estuda`   | Trabalho ou trabalhei enquanto estudava   | Trabalha e estuda                   | as duas conciliaram trabalho e estudo                 |
| `retorno-aos-estudos` | Voltei a estudar depois de uma pausa      | Voltou a estudar                    | as duas voltaram a estudar depois de uma pausa        |
| `mudanca-de-area`     | Mudei de área ao longo do caminho         | Mudou de área                       | as duas mudaram de área no caminho                    |
| `fora-das-capitais`   | Estudo ou pesquiso fora das capitais      | Fora das capitais                   | as duas estudam ou pesquisam fora das capitais        |

**Fora de propósito (e não entram sem uma nova análise):** raça ou etnia, deficiência ou saúde,
religião, orientação sexual, identidade de gênero — dados sensíveis do art. 11 da LGPD — e renda,
que é estigmatizante. A lista está em `TRAJECTORY_EXCLUDED` e o teste do catálogo garante que
nenhum rótulo toca nesses temas. O texto de ajuda do formulário diz isso para a usuária:
_"Não pedimos dados sensíveis como raça, religião ou saúde."_

Por que um catálogo **fechado** e não texto livre: dá para comparar sem IA, dá para filtrar com
índice, não vira um campo onde alguém escreve um dado sensível sem querer e a moderação não
precisa revisar nada.

---

## 2. Onde aparece — e onde nunca aparece

| Onde                                                | O que mostra                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onboarding, etapa 1 "Sobre você", e `/perfil#sobre` | grupo **Sua trajetória (opcional)** com 8 chips-caixa de seleção (teclado: Tab + Espaço), no fim de "Sobre você"                                                               |
| `/mentoria` → cartão de sugestão                    | motivo "Vocês têm em comum: …" (sugestão por afinidade) quando ele está entre os mais fortes, e a linha **Em comum na trajetória** com os chips (sempre que houver interseção) |
| `/pesquisadoras?trajetoria=<slug>`                  | filtro **Trajetória** (select), chip "Trajetória: …" em **Filtros ativos** (remove só ele); slug desconhecido é ignorado                                                       |
| `/pesquisadoras` (cartões)                          | até 2 marcas, discretas (contorno), a do filtro primeiro                                                                                                                       |
| `/pesquisadoras/<id>`                               | seção **Trajetória** com todas as marcas dela; se você compartilha alguma, um destaque "Vocês têm em comum: …" e um ícone de confirmação nos chips em comum                    |

**Nunca aparece:** para visitantes (o banco não dá SELECT de `profiles` a `anon`; `/pesquisadoras`
exige sessão), na landing, em `/sobre`, nas imagens OG, no Boletim, nos papers, no ranking, no
Pergunte a uma cientista, na verificação de declaração, em notificações e e-mails, e **em nenhum
pedido à IA** (seção 5). O grupo do formulário nunca é obrigatório e nada na plataforma conta
"sem marcas" como perfil incompleto (o onboarding só exige nome, fase e uma área).

---

## 3. Como entra na nota (sugestão por afinidade)

`src/lib/matching/rank.ts`. A nota (0–100) é uma média ponderada dos componentes que se aplicam,
com **pesos relativos**:

| Componente                                          | Peso relativo | Aplica-se quando                                    |
| --------------------------------------------------- | ------------- | --------------------------------------------------- |
| Áreas de pesquisa em comum                          | 0,35          | a mentoranda tem área                               |
| Similaridade semântica (embeddings)                 | 0,30          | as duas têm embedding (com consentimento + chave)   |
| Temas de mentoria + palavras-chave                  | 0,15          | a mentoranda tem temas, objetivos ou palavras-chave |
| Senioridade adequada                                | 0,10          | as duas têm fase da carreira                        |
| Compatibilidade prática (formato, idioma, UF, vaga) | 0,10          | sempre                                              |
| **Afinidade de trajetória**                         | **0,10 × c**  | **as duas declararam marcas e têm alguma em comum** |

Os pesos dos componentes que não se aplicam são redistribuídos entre os outros (os pesos efetivos
somam 1). **Sem marcas em comum, a conta é exatamente a de antes**: os cinco primeiros pesos somam
1 e todos os testes antigos do ranking passam com as mesmas notas e os mesmos motivos.

**A afinidade só soma.** Quando há marca em comum, o componente vale **1** e o peso dele é
`0,10 × c`, com a **cobertura** `c = min(1, em comum ÷ min(marcas da mentoranda, 2))`:

- quem marcou 1 opção e a compartilha → `c = 1`;
- quem marcou 3 e compartilha 1 → `c = 0,5`; compartilha 2 ou 3 → `c = 1` (satura em 2).

Acrescentar a uma média um componente que vale 1 nunca a diminui — então a afinidade **nunca
derruba** a nota de ninguém, e quanto mais em comum, maior o bônus (até o limite). O bônus é
pequeno: a nota anda no máximo `0,10 ÷ (W + 0,10)` do que falta para 100, sendo `W` a soma dos
pesos que se aplicam — até 9 % dessa distância com todos os componentes e até 12,5 % sem
embeddings. Exemplo do seed (sem embeddings): Larissa × Juliana passa de **49 para 55**; Larissa × Luiza, de
**41 para 49**. O teste de propriedade (`trajectory.test.ts`) confere em 300 cenários aleatórios
que a nota com marcas em comum nunca é menor que sem elas.

**O motivo.** `"Vocês têm em comum: <até 2 frases>."`, com o sujeito "as duas" uma vez só ("as duas
foram as primeiras da família na universidade e estudaram em escola pública"). Ele disputa um
lugar entre os motivos principais pela **contribuição** (peso efetivo × nota), como os outros; no
empate com a senioridade, vem antes. O cartão mostra os 2 motivos mais fortes; a linha **Em comum
na trajetória** aparece sempre que houver interseção — inclusive em sugestões explicadas pela IA,
porque os chips são calculados na hora, no servidor, sem a IA.

### Regras de justiça

1. **Não declarar não penaliza:** o componente fica `null` e o peso é redistribuído — a nota é
   idêntica à de antes.
2. **Ter um caminho diferente não penaliza:** sem marca em comum, também `null` (a especificação
   original pedia nota 0 quando as duas declaram; mudamos para não punir quem conta a própria
   história — senão a melhor estratégia de uma mentora seria não marcar nada).
3. **Só soma, e pouco:** o componente vale 1 e só o peso varia; teto de 0,10 de peso relativo.
4. **Explicado:** sempre que pesa, aparece com palavras ("Vocês têm em comum") e com chips.
5. **Nada de inferência:** só o que a pessoa marcou; nada é deduzido de textos, nomes ou cidades.

---

## 4. Banco de dados

| Objeto                                   | O quê                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles.trajectory_tags text[]`        | `not null default '{}'`; comentário na coluna                                                                                                         |
| CHECK `profiles_trajectory_tags_catalog` | subconjunto dos 8 slugs e `cardinality ≤ 8` (segura mesmo com triggers desligados — testado)                                                          |
| trigger `profiles_normalize_trajectory`  | `BEFORE INSERT OR UPDATE OF trajectory_tags`; função `private.profiles_normalize_trajectory()` (search_path vazio, sem EXECUTE para ninguém)          |
|                                          | minúsculas e sem espaços → recusa marca fora do catálogo com **CD050** (antes do CHECK) → sem repetição e em ordem alfabética; `NULL` vira `{}`       |
| GRANT                                    | `insert (trajectory_tags), update (trajectory_tags)` para `authenticated` (as colunas editáveis são explícitas); SELECT vem do GRANT da tabela        |
| RLS                                      | a de sempre: membras leem perfis; só a dona altera o próprio (alterar o de outra afeta 0 linhas)                                                      |
| índice `profiles_trajectory_tags_idx`    | GIN, para `.contains('trajectory_tags', [slug])` (`@>`) do diretório                                                                                  |
| `get_mentor_candidates(integer)`         | DROP + CREATE com o corpo de `20261027120800_rpc.sql` igual linha a linha e `trajectory_tags text[]` como **última** coluna; REVOKE/GRANT reaplicados |

`profiles_before_write` não foi tocado. Código de erro novo:

| Código  | Quando                                   | Mensagem                                                                               |
| ------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `CD050` | marca fora do catálogo (ou vazia / NULL) | "Uma das opções de trajetória não existe mais. Recarregue a página e escolha de novo." |

`CD051` e `CD052` ficaram reservadas e **não foram usadas**. No app, o zod
(`src/lib/profile/schemas.ts`) recusa antes com a mesma mensagem, no próprio grupo; se o banco
devolver CD050 mesmo assim, `save.ts` também aponta o erro no grupo.

**Conferido:** nenhuma função executável por `anon` lê ou devolve a coluna (`trajetoria.test.sql`,
seção 5, varre `pg_proc`: estatísticas da landing, ranking de papers, Pergunte, verificação e
impacto não a tocam). O app nunca faz `select('*')` em perfis de outras pessoas; os únicos
`select` com a coluna são os do diretório, do perfil de membra, do matching e o da própria usuária.

---

## 5. LGPD

- **Opcional e opt-in:** começa vazio; marcar é um ato da própria pessoa (base legal:
  consentimento, art. 7º, I). Não marcar não muda nada para ela.
- **Só membras veem:** visitantes não leem `profiles` (sem GRANT para `anon`); as páginas que
  mostram marcas exigem sessão e perfil concluído.
- **Nunca vai para a IA:** `pseudonymize.ts` não inclui marcas, frases nem a nota com o bônus
  (`nota_heuristica` é calculada sem a trajetória). O teste `trajectory-privacy.test.ts` monta o
  pedido real ao modelo para uma mentoranda e mentoras com as 8 marcas e confere que ele é
  **idêntico, byte a byte,** ao de quem não marcou nada; o texto do embedding também não as leva.
- **Removível a qualquer hora**, com efeito imediato: o diretório, o perfil e os chips do cartão
  leem as marcas de agora; o motivo de uma sugestão **já salva** tem a frase "Vocês têm em comum"
  refeita (ou retirada) na hora de mostrar; e essa frase **nunca** é copiada para um pedido de
  mentoria (`loadSuggestionMatch`), que dura mais que as marcas e entra na exportação das duas.
- **Exportação e exclusão:** "Baixar meus dados" passa a incluir `trajectory_tags` (pedido de
  integração: `PROFILE_FIELDS` em `src/lib/profile/export.ts`); excluir a conta apaga o perfil e,
  com ele, as marcas.
- **Minimização:** catálogo fechado, sem categorias sensíveis, sem texto livre.

### Parágrafo pronto para `/privacidade`

> **Trajetória (opcional).** No seu perfil você pode marcar, se quiser, algumas opções sobre o seu
> caminho — por exemplo, "fui a primeira da família na universidade" ou "vim do ensino técnico".
> Elas servem para sugerir mentoras que passaram por caminhos parecidos e para você encontrar
> pesquisadoras com histórias como a sua. Não pedimos dados sensíveis (como raça ou etnia, saúde,
> religião, orientação sexual ou identidade de gênero) nem renda. As marcas são visíveis só para
> membras da Artemis — nunca para visitantes, em páginas públicas ou no Boletim —, **nunca são
> enviadas a serviços de inteligência artificial** e não diminuem a pontuação de ninguém nas
> sugestões. Você pode tirá-las quando quiser, em "Meu perfil", e elas entram no arquivo de
> "Baixar meus dados"; ao excluir a conta, elas são apagadas.

---

## 6. Demonstração (dados fictícios)

`supabase/seeds/40_trajetoria.sql` (UPDATEs idempotentes por UUID fixo, só personas
`@demo.cienciadelas.dev`):

| Persona                       | Marcas                                              |
| ----------------------------- | --------------------------------------------------- |
| Larissa (mentoranda)          | primeira-geracao, escola-publica, ensino-tecnico    |
| Marina (mentora)              | primeira-geracao, escola-publica                    |
| Juliana (mentora)             | primeira-geracao, escola-publica, fora-das-capitais |
| Luiza (mentora)               | primeira-geracao, ensino-tecnico, fora-das-capitais |
| Tatiane (mentora)             | escola-publica, fora-das-capitais                   |
| Débora (mentoranda)           | mae-cuidadora, retorno-aos-estudos                  |
| Patrícia, Carolina (mentoras) | mae-cuidadora                                       |
| Yasmin (mentoranda)           | primeira-geracao, ensino-tecnico, trabalha-e-estuda |
| Gabriela (mentoranda)         | trabalha-e-estuda                                   |
| Camila (mentora)              | mudanca-de-area                                     |
| Beatriz (mentora)             | mudanca-de-area, fora-das-capitais                  |

A Marina já é mentora da Larissa (por isso não volta nas sugestões dela). Juliana e Luiza — mesma
grande área, com vagas — compartilham duas marcas com a Larissa, então **os dois primeiros
cartões** de "Encontrar mentoras" mostram o motivo e os chips. Yasmin e Carolina receberam marcas
coerentes com a bio do `seed.sql`.

**Roteiro do pitch (30 s):** entrar como `larissa@` → `/mentoria` → **Encontrar mentoras** → o
primeiro cartão diz "Vocês têm em comum: as duas foram as primeiras da família na universidade e
estudaram em escola pública." → **Ver perfil** da Juliana mostra a seção Trajetória com o mesmo
destaque → `/pesquisadoras?trajetoria=primeira-geracao` lista quem compartilha esse caminho.

---

## 7. Código

| Arquivo                                                       | Papel                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/trajectory/catalog.ts`                               | catálogo, normalização, interseção, frase "Vocês têm em comum", exclusões       |
| `src/lib/matching/{types,rank,service,pseudonymize}.ts`       | componente `trajectory`, bônus, motivo, coluna da RPC, nada para a IA           |
| `src/lib/mentorship/{view-models,queries}.ts`                 | chips do cartão (calculados na hora), motivo salvo atualizado, pedido sem frase |
| `src/components/profile/trajectory-fields.tsx`                | grupo do formulário (no fim de `about-fields.tsx`)                              |
| `src/lib/profile/{form-values,schemas,save}.ts`               | ida e volta do formulário (marca oculta `_has_trajectory`), zod, CD050 no grupo |
| `src/lib/profile/{directory,queries}.ts`                      | `?trajetoria=`, chips de filtros ativos, colunas do diretório e do perfil       |
| `src/components/profile/{directory-filters,profile-card}.tsx` | select + filtros ativos; até 2 marcas no cartão                                 |
| `src/app/pesquisadoras/page.tsx`, `[id]/page.tsx`             | estado vazio do filtro; seção Trajetória                                        |
| `src/components/mentorship/match-card.tsx`                    | linha "Em comum na trajetória"                                                  |

A marca oculta `_has_trajectory` existe para que um formulário "Sobre você" que **não** mostre o
grupo nunca apague as marcas salvas; com ela, nenhuma opção marcada significa "tirar todas".

---

## 8. Testes

```bash
npx vitest run src/lib/trajectory src/lib/matching src/lib/profile src/lib/mentorship
SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io npx supabase test db   # inclui trajetoria.test.sql
# app rodando (ex.: next start -p 3804) + Supabase local com o seed:
BASE_URL=http://localhost:3804 node scripts/e2e/trajetoria.mjs
```

- **pgTAP** (`trajetoria.test.sql`, usuárias `f4…`, schema `cdtest_traj`, rollback): estrutura e
  GRANTs; CD050 para marca desconhecida, vazia ou NULL; repetidas e maiúsculas normalizadas e em
  ordem; CHECK com triggers desligados; só a dona altera (0 linhas para a de outra); membras leem,
  visitantes não; `get_mentor_candidates` devolve `trajectory_tags` por último e continua
  excluindo a própria usuária, mentoras pausadas e perfis sem onboarding; nenhuma função de
  visitante toca a coluna.
- **Vitest:** catálogo (8 slugs únicos, paridade com o SQL, nada sensível); ranking (sem marcas
  nada muda, marca de um lado só ou diferente não muda nada, bônus só com interseção, saturação em
  2, pesos somam 1, nota exata, empate com a senioridade, propriedade "só sobe"); privacidade da
  IA (prompt idêntico, pedido real ao modelo, embedding); zod e ida e volta do formulário; filtro
  do diretório; chips do cartão, motivo salvo atualizado e pedido sem a frase.
- **E2E** (`scripts/e2e/trajetoria.mjs`, marca `e2e-traj-<execução>`): os passos 1–5 da
  especificação, um valor forjado recusado no grupo, o onboarding de uma conta nova e capturas
  claro/escuro × 1440/390 (cartão, grupo do perfil e do onboarding, diretório filtrado, perfil da
  Marina) com checagem de rolagem horizontal, contraste AA, console e hidratação. As marcas da
  Larissa voltam ao valor original e a conta nova é apagada.

---

## 9. Limitações e decisões

- **Interseção, não semelhança:** "fora das capitais" não sabe se as duas são da mesma região; o
  catálogo é deliberadamente simples.
- **Autodeclaração:** ninguém confere as marcas (nem deveria). O peso pequeno e o motivo explícito
  limitam o efeito de uma marca inventada.
- **Sugestão salva com IA:** o texto da IA nunca fala de trajetória (ela não recebe as marcas); o
  cartão mostra a linha "Em comum na trajetória" mesmo assim.
- **Sem notificação:** ninguém é avisada de que outra pessoa tem uma marca em comum — a afinidade
  só aparece quando a própria pessoa procura.
