# 08 · Newsletter — Boletim Delas

O **Boletim Delas** é a newsletter semanal da Artemis: toda segunda-feira, os papers de
pesquisadoras mais destacados pela comunidade, as conversas que movimentaram o fórum, quantas novas
mentoras chegaram (e de quais áreas) e os números da semana. Qualquer pessoa pode assinar (não precisa de conta) e o arquivo de
edições é público.

> Contrato: CONTRACT §4 (tabelas `newsletter_*`), §9 (formato do `content`, revisto na integração:
> mentoras só em agregado — ver [seção 3](#3-como-a-edição-é-montada)) e §11 (envio, cron, descadastro
> e API do serviço). Banco: `supabase/migrations/20261027120500_newsletter.sql`,
> `20261028090000_integration.sql` (limites de confirmação) e `20261028091000_newsletter_mentor_summary.sql`.

Sumário

1. [Rotas](#1-rotas)
2. [Fluxos de quem assina](#2-fluxos-de-quem-assina)
3. [Como a edição é montada](#3-como-a-edição-é-montada)
4. [Envio](#4-envio)
5. [Cron semanal](#5-cron-semanal)
6. [API do serviço (cron e painel /admin)](#6-api-do-serviço-cron-e-painel-admin)
7. [Server Actions e acesso a dados](#7-server-actions-e-acesso-a-dados)
8. [E-mail: Resend, Mailpit e configuração](#8-e-mail-resend-mailpit-e-configuração)
9. [Privacidade e LGPD](#9-privacidade-e-lgpd)
10. [Como testar](#10-como-testar)
11. [Arquivos](#11-arquivos)
12. [Limitações conhecidas](#12-limitações-conhecidas)

---

## 1. Rotas

| Rota                                      | Acesso                              | O que faz                                                                                           |
| ----------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/newsletter`                             | pública                             | Apresentação, formulário de inscrição, última edição em destaque e arquivo paginado (`?pagina=`).   |
| `/newsletter/[slug]`                      | pública (rascunho: só admin)        | Versão web de uma edição (ex.: `/newsletter/2026-s44`), renderizada em React a partir do `content`. |
| `/newsletter/confirmar?token=`            | pública (posse do token)            | Mostra o estado da inscrição e um **botão** que confirma (POST). O GET não muda nada.               |
| `/newsletter/cancelar?token=`             | pública (posse do token)            | Botão "Cancelar inscrição" (POST) e "Excluir meus dados" (com confirmação). O GET não muda nada.    |
| `POST /api/newsletter/unsubscribe?token=` | provedores de e-mail (RFC 8058)     | Descadastro "one-click": responde **200 vazio**, sem cookies e sem redirect.                        |
| `GET /api/newsletter/unsubscribe?token=`  | navegador                           | Nunca descadastra: redireciona (303) para `/newsletter/cancelar?token=`.                            |
| `GET` e `POST /api/cron/newsletter`       | `Authorization: Bearer CRON_SECRET` | Gera + publica + envia a edição da semana. JSON. 401 sem o segredo.                                 |

`src/proxy.ts` não intercepta `/api/cron` nem `/api/newsletter` (a Vercel Cron não segue redirects e o
one-click chega sem cookies). As páginas com token têm `robots: noindex` e `referrer: no-referrer`
(o token não vaza para outros sites pelo cabeçalho Referer).

## 2. Fluxos de quem assina

### Inscrição (double opt-in)

1. Em `/newsletter`, a pessoa informa o e-mail, escolhe (opcionalmente) **grandes áreas do CNPq**
   de interesse e marca duas caixas **desmarcadas por padrão**: o consentimento (texto exato abaixo)
   e "Tenho 18 anos ou mais.".
2. A Server Action `subscribeToNewsletter` valida tudo com zod no servidor e grava com o cliente
   admin (a tabela não tem nenhuma política para a API):
   - e-mail novo → `status = 'pending'`, `consent_text`, `consented_at`, `area_ids`;
   - já pendente → atualiza áreas/consentimento e **reenvia** o mesmo link (no máximo 1 a cada 2
     minutos e 3 por dia — ver "Limites de e-mails de confirmação" abaixo);
   - já descadastrado → volta a `pending` com **tokens novos** (os links antigos deixam de valer);
   - já ativo → não faz nada.
3. A resposta é **sempre a mesma** ("Se este endereço ainda não estiver confirmado, você vai receber…"),
   para não revelar quem já está inscrita.
4. O e-mail de confirmação leva a `/newsletter/confirmar?token=<confirm_token>` (vale **7 dias**) e
   traz também um link para remover o endereço da lista.
5. Na página, a pessoa clica em **Confirmar inscrição** → `status = 'active'`, `confirmed_at = now()`.
   O clique é obrigatório: antivírus e pré-visualizações de e-mail abrem links sozinhos.

Membra logada: o campo já vem com o e-mail da conta e o botão vira **"Assinar com meu e-mail"**. Se
o e-mail enviado for o da conta, a inscrição guarda `profile_id` (decidido no servidor, nunca pelo
cliente). Depois, `/newsletter` mostra "Falta confirmar" (pendente) ou "Você já assina" com o link
**Gerenciar inscrição** (ativa).

Proteções extras: campo-armadilha invisível (`website`) — se vier preenchido, respondemos sucesso e
não gravamos nada; limite de 2 minutos entre e-mails de confirmação; corrida de duas inscrições
simultâneas tratada pelo `unique` do e-mail.

### Limites de e-mails de confirmação

Cada e-mail de confirmação gasta a cota do provedor (Resend gratuito: 100/dia) e poderia ser usado para
encher a caixa de outra pessoa. Por isso, além dos 2 minutos entre envios:

| Limite                 | Valor                                                                       | Onde                                                 |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Por endereço           | **3 e-mails a cada 24 h**                                                   | `CONFIRMATIONS_PER_ADDRESS_PER_DAY` (`constants.ts`) |
| Global (todos somados) | **80 por dia** (ajustável em `NEWSLETTER_CONFIRMATIONS_PER_DAY`; `0` pausa) | `getConfirmationsPerDay()` (`config.ts`)             |

As colunas `newsletter_subscribers.confirmation_sent_count` (e-mails na janela atual) e
`confirmation_sent_at` (último envio) guardam a contagem; a janela recomeça quando o último envio tem
mais de 24 h. A reserva é **atômica** na RPC `newsletter_reserve_confirmation(p_subscriber_id,
p_max_per_address, p_max_per_day)` (só `service_role`; trava consultiva para o teto global), chamada
por `subscribe()` antes de enviar. Ela devolve `ok` (e conta o envio), `address_limit`, `daily_limit`
ou `not_found`. O teto global soma as janelas ativas — pode contar a mais, nunca a menos.

Mensagens (neutras, sem revelar se o e-mail existe):

- **Limite do endereço:** "Se este endereço ainda não estiver confirmado, procure o e-mail de
  confirmação que já enviamos… mandamos no máximo 3 e-mails de confirmação por dia para o mesmo
  endereço."
- **Teto diário:** "Recebemos muitos pedidos de inscrição hoje e pausamos os e-mails de confirmação até
  amanhã…" (o formulário mantém os dados preenchidos).

### Descadastro e exclusão

- **Pelo e-mail (one-click):** todo boletim leva os cabeçalhos
  `List-Unsubscribe: <https://SITE/api/newsletter/unsubscribe?token=…>` e
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. O Gmail/Apple Mail mostram "Cancelar inscrição"
  e fazem o POST — `status = 'unsubscribed'`, `unsubscribed_at = now()`.
- **Pela página:** o rodapé de cada e-mail tem o link visível `/newsletter/cancelar?token=…` com o botão
  **Cancelar inscrição**.
- **Excluir meus dados (LGPD):** na mesma página, com diálogo de confirmação. Apaga a linha da
  inscrita e, em cascata, o histórico de envios (`newsletter_deliveries`). Redireciona para
  `/newsletter/cancelar?excluido=1`.

## 3. Como a edição é montada

`generateWeeklyEdition()` (em `src/lib/newsletter/service.ts`) usa o cliente admin e
`src/lib/newsletter/build-edition.ts`.

**Calendário** (`week.ts`): a edição gerada no instante `now` cobre a **janela móvel dos 7 dias
anteriores** e leva o rótulo da **semana ISO da véspera**, no fuso de São Paulo. O cron de segunda
09:00 (BRT) gera, portanto, a edição da semana que acabou (período segunda→domingo, igual ao seed).

| Campo                       | Exemplo (cron de 26/10/2026, 09:00 BRT)        |
| --------------------------- | ---------------------------------------------- |
| `slug`                      | `2026-s43` (mesmo formato do seed: `IYYY-sIW`) |
| `title`                     | `Boletim Delas — semana 43 de 2026`            |
| `period_start`/`period_end` | `2026-10-19` / `2026-10-25`                    |

Rodar de novo na mesma semana reaproveita o slug (idempotente). Com `force: true` o conteúdo é
recalculado — nunca de uma edição já `sent`.

**Conteúdo** (`content`, CONTRACT §9 revisto + campos extras opcionais `papers[].area_id` e
`papers[].area`). Edições publicadas são **públicas** (visitantes leem o `content` pela API), então só
entram dados que já são públicos:

```json
{
  "papers": [
    {
      "id": "…",
      "title": "…",
      "authors": ["…"],
      "votes": 12,
      "plain_summary": "…",
      "url": "/papers/<id>",
      "area_id": 3,
      "area": "Ecologia"
    }
  ],
  "threads": [
    {
      "id": "…",
      "title": "…",
      "category": "Carreira acadêmica",
      "replies": 4,
      "url": "/forum/t/<id>"
    }
  ],
  "mentors": [],
  "mentor_summary": { "total": 2, "areas": ["Ecologia", "Biotecnologia"] },
  "stats": { "new_members": 10, "new_papers": 3, "mentorships": 2 }
}
```

| Seção            | Regra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `papers`         | Até 5 papers não ocultos com mais destaques **dados na janela** (desempate igual ao `get_paper_ranking`: total de votos, mais novo). Semana sem votos → até 3 papers indicados na janela.                                                                                                                                                                                                                                                                                                           |
| `threads`        | Até 4 tópicos com mais atividade na janela (respostas + reações + 1 se o tópico é novo). **Ficam de fora todos os tópicos anônimos, TODAS as categorias que aceitam anonimato** (apoio, maternidade, saúde mental) **e "Apresente-se"** (apresentações são pessoais; lista em `NEWSLETTER_EXCLUDED_CATEGORY_SLUGS`): a newsletter é pública e esses espaços são de acolhimento — nem o título sai do fórum. Tópico sem categoria conhecida também fica de fora. Nunca leva o nome de quem escreveu. |
| `mentors`        | **Sempre `[]`** (mantido por compatibilidade com o formato antigo, que trazia nomes).                                                                                                                                                                                                                                                                                                                                                                                                               |
| `mentor_summary` | Agregado das mentoras disponíveis (`is_mentor`, `mentor_available`) que concluíram o cadastro na janela: `total` e os nomes das **áreas** delas (até 8, das mais frequentes). Nada de nomes, headlines ou links de perfil — o diretório é só para membras. Semana sem mentoras novas → `{ "total": 0, "areas": [] }` (a seção some).                                                                                                                                                                |
| `stats`          | `new_members` (onboarding na janela), `new_papers` (papers visíveis criados na janela), `mentorships` (pedidos aceitos na janela, `responded_at`).                                                                                                                                                                                                                                                                                                                                                  |

Nada de nomes de mentoras, e-mails, bios ou conteúdo de posts. **Edições antigas** que ainda tragam
`mentors` com nomes são lidas sem os nomes (`parseEditionContent` devolve `mentors: []` e um
`mentor_summary` só com a contagem) e a migration `20261028091000_newsletter_mentor_summary.sql`
converte o jsonb guardado no banco (inclusive o da edição de demonstração do seed).

A web (`/newsletter/[slug]`, também a prévia de rascunhos para admins), o e-mail e o cartão do arquivo
mostram "N novas mentoras" + as áreas em chips, com o convite "entre na sua conta e acesse a página
Mentoria".

**Abertura editorial** (`summary`): `generateEditionIntro(...)` (IA, ≤ 600 caracteres, sem nomes
de pessoas, só com os números fornecidos — das mentoras, a IA recebe só a quantidade). Sem chave de IA ou em caso de falha, usamos
`fallbackIntro(content)`, um texto determinístico com os números reais da edição.

A versão web (`/newsletter/[slug]`) e o e-mail usam o **mesmo** `content`; o e-mail é HTML próprio
(`render.ts`), a página é React (`components/newsletter/edition-view.tsx`) — nunca injetamos o HTML do
e-mail na página. O `content` é lido de forma tolerante (`parseEditionContent`): itens inválidos são
descartados e links que não sejam caminhos internos (`/papers/...`) são trocados pelo padrão.

## 4. Envio

`sendEdition(editionId, { dryRun })`:

1. Só envia edições `published`/`sent` (rascunho → motivo "Publique a edição antes de enviar.").
2. Carrega as inscritas **ativas** e os envios já registrados da edição.
3. **Áreas:** quem não escolheu áreas recebe tudo; quem escolheu recebe a edição quando pelo menos
   um paper em destaque é de uma dessas áreas. Tudo é comparado pela **grande área** (subárea conta
   como a grande área dela). Edição sem papers → só para quem não escolheu áreas.
4. **Nunca duas vezes:** cada envio é "reivindicado" antes com uma linha em `newsletter_deliveries`
   (chave primária `edition_id + subscriber_id`, `error = 'em_andamento:<data>'`); outra execução ao
   mesmo tempo não pega as mesmas pessoas. Reivindicações com mais de 15 minutos e falhas anteriores
   são retomadas com uma atualização **condicional** (só pega a linha se ninguém a reivindicou nesse
   meio-tempo), então duas execuções simultâneas também não repetem um reenvio. Cada lote vai ao
   Resend com `Idempotency-Key` (24 h).
5. **Teto por execução:** `NEWSLETTER_MAX_PER_RUN` (padrão **90**; o Resend gratuito permite 100/dia
   e sobra espaço para confirmações). O restante fica para a próxima chamada.
6. Lotes de até 100 (`POST /emails/batch`), cada e-mail personalizado com o link de descadastro.
7. Ao terminar, atualiza `recipients_count` e marca a edição como **`sent`** quando ninguém elegível
   ficou pendente (e pelo menos uma pessoa recebeu).

Retorno: `{ sent, skipped, failed, reason?, eligible, remaining, dryRun }`. No `dryRun`, `sent` é
**quantos seriam enviados agora** e nada é gravado.

## 5. Cron semanal

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/newsletter", "schedule": "0 12 * * 1" }] }
```

Segunda 12:00 UTC = 09:00 em Brasília. No plano Hobby a Vercel roda no máximo 1×/dia, com folga de
até ±59 min, só em produção, sem novas tentativas e às vezes em dobro — por isso o job é idempotente
pelo slug da semana e pelos registros de envio. A Vercel envia `Authorization: Bearer $CRON_SECRET`
automaticamente quando a variável `CRON_SECRET` existe no projeto.

`/api/cron/newsletter` aceita **GET e POST** (POST para `pg_cron` + `pg_net`, ver
[docs/03 §16](03-banco-de-dados.md#16-newsletter-semanal-com-pg_cron--pg_net-opcional)),
`maxDuration = 60`, compara o segredo em tempo constante e responde:

```json
{
  "ok": true,
  "durationMs": 171,
  "slug": "2026-s44",
  "editionId": "…",
  "created": true,
  "published": true,
  "status": "sent",
  "send": {
    "sent": 2,
    "skipped": 1,
    "failed": 0,
    "eligible": 2,
    "remaining": 0,
    "dryRun": false,
    "reason": "Envio concluído."
  },
  "reason": "Envio concluído."
}
```

Erros: `401 {"ok":false,"error":"Não autorizado."}` · `503` sem `SUPABASE_SECRET_KEY` · `500` com a
mensagem. Semana totalmente vazia → a edição fica como rascunho e nada é enviado.

## 6. API do serviço (cron e painel /admin)

`src/lib/newsletter/service.ts` (`server-only`, usa o service role — **verifique a autorização antes**:
CRON_SECRET no cron, moderação/admin no painel):

```ts
generateWeeklyEdition({ now?: Date, publish?: boolean, force?: boolean })
  → Promise<{ edition: NewsletterEdition; created: boolean; regenerated: boolean }>

sendEdition(editionId: string, { dryRun?: boolean })
  → Promise<{ sent; skipped; failed; reason?; eligible; remaining; dryRun }>

runWeeklyNewsletterJob({ now?: Date })
  → Promise<{ slug; editionId; created; published; status; send; reason? }>

publishEdition(editionId: string) → Promise<NewsletterEdition>

getNewsletterOverview()
  → Promise<{ email: { transport: "resend" | "mailpit" | "none"; from; devInboxUrl; usingResendTestSender; production };
              maxPerRun: number;
              subscribers: { active; pending; unsubscribed } }>
```

O painel `/admin` (aba Newsletter) usa `generateWeeklyEdition({ publish: true })`, `sendEdition` com
prévia (`dryRun`) e `getNewsletterOverview()`. As funções chamam `revalidatePath` em `/newsletter`,
`/newsletter/<slug>` e `/admin` quando publicam ou terminam um envio.

## 7. Server Actions e acesso a dados

`src/app/newsletter/actions.ts` (públicas, sem login — a autorização das ações com token é a posse do
uuid aleatório enviado por e-mail):

| Action                          | Entrada (FormData)                              | Efeito                                                                        |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `subscribeToNewsletter`         | `email`, `areas[]`, `consent`, `age`, `website` | Inscrição/reenvio (ver §2). Devolve `values` para o formulário não se perder. |
| `confirmNewsletterSubscription` | `token`                                         | `pending → active` (se o link tiver ≤ 7 dias).                                |
| `unsubscribeFromNewsletter`     | `token`                                         | `→ unsubscribed`.                                                             |
| `deleteNewsletterData`          | `token`                                         | Apaga a inscrita (+ envios) e redireciona para `?excluido=1`.                 |

| Dado                     | Quem lê/escreve                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `newsletter_subscribers` | Só o servidor com `createAdminClient()` (`subscriptions.ts`). Sem políticas RLS para a API.                                                                                                                                                    |
| `newsletter_deliveries`  | Só o servidor (`service.ts`).                                                                                                                                                                                                                  |
| `newsletter_editions`    | Escrita pelo servidor (admin client). Leitura nas páginas com o cliente da **sessão** (`queries.ts`): RLS libera `published`/`sent` para todas e rascunhos para admins (pré-visualização com selo "Rascunho"). O arquivo filtra só publicadas. |
| `research_areas`         | Cliente da sessão (leitura pública) para as opções de interesse.                                                                                                                                                                               |

## 8. E-mail: Resend, Mailpit e configuração

`src/lib/email/` escolhe o transporte:

1. **Resend** quando `RESEND_API_KEY` existe — REST via `fetch` (`resend.ts`): `POST /emails` e
   `POST /emails/batch` (≤ 100), `Idempotency-Key`, 429 → espera o `Retry-After` uma vez, 5xx só repete
   com chave de idempotência, timeout de 15 s. Nunca lança: sem chave devolve `{ skipped: true }`.
2. **Mailpit** (somente fora de produção): a caixa falsa do Supabase local
   (<http://127.0.0.1:54324>, `POST /api/v1/send`). É detectada a partir de
   `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`; ajuste com `MAILPIT_URL` ou desligue com
   `MAILPIT_URL=off`. Num **build de produção rodando localmente** (`next build && next start`, ex.:
   testes E2E), o Mailpit só é usado se `MAILPIT_URL` for informada **e** apontar para
   `127.0.0.1`/`localhost` — um deploy de verdade nunca manda e-mails de usuárias para ela.
3. **Nenhum:** em desenvolvimento o link de confirmação é registrado no console do servidor
   (`[newsletter] Link de confirmação para …`) — isso acontece também quando o Mailpit é usado. Em
   produção sem Resend, as inscrições ficam **fechadas** (aviso na página) e o arquivo continua público.

Em desenvolvimento a página e o formulário mostram um aviso "Modo de desenvolvimento".

| Variável                           | Uso                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `SUPABASE_SECRET_KEY`              | Obrigatória: inscrição e envio usam o service role.                               |
| `RESEND_API_KEY`                   | Envio real.                                                                       |
| `NEWSLETTER_FROM`                  | Remetente, ex.: `Artemis <boletim@seu-dominio.org>`.                              |
| `CRON_SECRET`                      | Protege `/api/cron/newsletter` (gere com `openssl rand -hex 32`).                 |
| `NEXT_PUBLIC_SITE_URL`             | Base dos links dos e-mails (confirmação, descadastro, papers).                    |
| `NEWSLETTER_MAX_PER_RUN`           | Teto de e-mails por execução (padrão 90).                                         |
| `NEWSLETTER_CONFIRMATIONS_PER_DAY` | Teto diário de e-mails de confirmação, todos os endereços (padrão 80; `0` pausa). |
| `MAILPIT_URL`                      | Só dev: URL do Mailpit (`off` desliga).                                           |

**Resend em produção:** o remetente de testes `onboarding@resend.dev` só entrega para o e-mail da dona
da conta Resend. Para enviar a qualquer pessoa, verifique um domínio em **Resend → Domains** (registros
SPF/DKIM no DNS) e use um remetente desse domínio em `NEWSLETTER_FROM`. Plano gratuito: 100 e-mails/dia,
3.000/mês, 10 requisições/s. Com mais de 90 inscritas, o envio se completa ao longo de execuções
seguintes (rode "Enviar" de novo no painel ou agende o cron diariamente via `pg_cron` — o slug da semana
garante que nada se repete).

## 9. Privacidade e LGPD

- **Consentimento específico e destacado**, caixa desmarcada, texto exato gravado em `consent_text`
  com versão:

  > Quero receber o Boletim Delas, a newsletter semanal da Artemis, no e-mail informado. Sei que
  > posso cancelar quando quiser pelo link presente em todos os e-mails e que meus dados são tratados
  > conforme a Política de Privacidade. Tenho 18 anos ou mais. (versão 2026-10b)

  (O texto mora em `src/lib/newsletter/constants.ts`; ao mudá-lo, troque `NEWSLETTER_CONSENT_VERSION`.)

- **Confirmação de idade (18+)**: os destaques podem citar temas sensíveis (assédio, saúde mental).
- **Dados mínimos:** e-mail, áreas, consentimento e datas. `profile_id` só quando o e-mail é o da conta.
- **Base legal:** consentimento (art. 7º, I). Revogação a qualquer momento pelo link de cada e-mail;
  **eliminação** (art. 18, VI) pelo botão "Excluir meus dados".
- **Sem enumeração:** a resposta da inscrição é sempre a mesma; páginas com token mostram o e-mail
  mascarado (`la••••a@…`).
- **Tokens** uuid aleatórios; troca de tokens ao se reinscrever; páginas com token fora dos buscadores e
  sem Referer.
- **Conteúdo público:** nenhum tópico anônimo, de categoria com anonimato ou de "Apresente-se"; nada de
  autoras de tópicos; mentoras só como contagem + áreas (nunca nomes ou perfis).
- **Limites de confirmação:** 3 e-mails por endereço a cada 24 h e teto diário global (evita usar o
  formulário para encher a caixa de alguém).
- Detalhes na página `/privacidade` (seção Newsletter).

## 10. Como testar

Pré-requisitos: Supabase local rodando (com Mailpit em <http://127.0.0.1:54324>) e `.env.local` com
`SUPABASE_SECRET_KEY` e `CRON_SECRET`.

**Inscrição completa (manual):**

1. Abra `/newsletter`, envie vazio → erros em e-mail, consentimento e idade.
2. Preencha um e-mail qualquer (ex.: `teste@example.com`), marque as caixas e assine.
3. Abra o Mailpit, clique no link "Confirmar inscrição" → botão → "Inscrição confirmada".
4. Gere e envie a edição da semana:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/newsletter | jq
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/newsletter   # 401
   ```

   O boletim chega no Mailpit (veja os cabeçalhos `List-Unsubscribe*` na aba "Headers").

5. Rode o cron de novo → `created: false`, `send.sent: 0` (idempotente).
6. Descadastro one-click como um provedor faria:

   ```bash
   curl -i -X POST -d "List-Unsubscribe=One-Click" \
     "http://localhost:3000/api/newsletter/unsubscribe?token=<unsubscribe_token>"   # 200 vazio
   ```

7. Pelo link "Cancelar inscrição" do e-mail: botão → cancelada; "Excluir meus dados" → apagada.

Consultas úteis:

```sql
select email, status, area_ids, confirmed_at, unsubscribed_at from newsletter_subscribers;
select slug, status, recipients_count, published_at, sent_at from newsletter_editions;
select * from newsletter_deliveries order by sent_at desc nulls first limit 20;
```

**Testes automatizados:** `npx vitest run src/lib/newsletter src/lib/email` (semana ISO conferida com o
`to_char` do Postgres, leitura tolerante do `content`, seleção de papers/tópicos — incluindo a exclusão
de categorias com anonimato —, público por área e idempotência, HTML/texto dos e-mails com escape,
cliente do Resend com 429/5xx/lote).

**E2E (Playwright):** o roteiro usado no desenvolvimento cobre visitante (validação, honeypot, inscrição,
confirmação por e-mail no Mailpit, links inválidos, 404), cron (401, criação, envio por área, idempotência,
cabeçalhos), one-click (GET não descadastra, POST 200 vazio, token inválido 400), reinscrição com tokens
novos, descadastro + exclusão pela página, membra logada (pré-preenchimento, `profile_id`, "Você já
assina"), rascunho visível só para admin, temas claro/escuro em 1440px e 390px sem rolagem horizontal e
console sem erros de hidratação.

## 11. Arquivos

```
src/app/newsletter/page.tsx                 inscrição + última edição + arquivo
src/app/newsletter/actions.ts               Server Actions (inscrever, confirmar, cancelar, excluir)
src/app/newsletter/[slug]/page.tsx          edição na web (+ loading.tsx)
src/app/newsletter/confirmar/page.tsx       confirmação com botão
src/app/newsletter/cancelar/page.tsx        descadastro e exclusão
src/app/api/newsletter/unsubscribe/route.ts one-click RFC 8058
src/app/api/cron/newsletter/route.ts        job semanal (GET/POST)
src/components/newsletter/*                 formulário, cartões, bloco da última edição, edição, formulários com token
src/lib/newsletter/service.ts               API do serviço (CONTRACT §11)
src/lib/newsletter/build-edition.ts         consultas da janela (admin client)
src/lib/newsletter/select.ts                ranking de papers/tópicos (puro)
src/lib/newsletter/audience.ts              quem recebe, idempotência, teto (puro)
src/lib/newsletter/content.ts               leitura tolerante do content + abertura padrão (puro)
src/lib/newsletter/render.ts                HTML/texto dos e-mails (puro)
src/lib/newsletter/week.ts                  semana ISO, slug, período (puro)
src/lib/newsletter/subscriptions.ts         inscrição, confirmação, descadastro, exclusão (admin client)
src/lib/newsletter/queries.ts               leituras públicas com o cliente da sessão
src/lib/newsletter/constants.ts, config.ts, format.ts
src/lib/email/{index,resend,mailpit,config,address,types}.ts
vercel.json                                 cron "0 12 * * 1"
```

## 12. Limitações conhecidas

- **Soft 404:** como o layout raiz tem `src/app/loading.tsx`, páginas que chamam `notFound()` (edição
  inexistente, rascunho para visitantes) respondem HTTP 200 com a página 404 e `noindex` — os buscadores
  não indexam, mas o status não é 404. Rotas que não existem respondem 404 normalmente.
- `NEWSLETTER_MAX_PER_RUN`, `NEWSLETTER_CONFIRMATIONS_PER_DAY` e `MAILPIT_URL` são lidas em `src/lib/newsletter/config.ts` e
  `src/lib/email/config.ts` (ainda não estão em `src/lib/env.ts`).
- Não há página de preferências: para trocar as áreas, a pessoa se inscreve de novo com o mesmo e-mail
  enquanto ainda não confirmou, ou cancela e se inscreve outra vez.
- O cron semanal manda o restante (quando passa do teto) só na próxima execução; com muitas inscritas,
  agende execuções diárias ou use "Enviar" no painel.
- **Abuso do formulário:** há campo-armadilha, 2 minutos entre e-mails de confirmação, no máximo 3 por
  endereço a cada 24 h e um teto diário global (80 por padrão), mas não há limite por IP nem captcha:
  alguém insistente pode esgotar o teto diário e atrasar inscrições legítimas até o dia seguinte (o
  arquivo segue público). Para produção com tráfego real: limite por IP ou captcha.
- **Conteúdo público:** a edição é pública e mostra títulos de conversas de categorias **sem**
  anonimato e fora de "Apresente-se". As categorias que aceitam anonimato (apoio, maternidade, saúde
  mental) nunca entram, e mentoras aparecem só em agregado (contagem + áreas).
