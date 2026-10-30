# ADR 0007 — Newsletter com dupla confirmação, Resend e Vercel Cron

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

Queremos um boletim semanal com os papers mais destacados, discussões do fórum e novas mentoras, sem custo e
respeitando a LGPD.

## Decisão

- **Inscrição com dupla confirmação** (double opt-in): o e-mail fica `pending` até a pessoa clicar no link e
  confirmar. O texto do consentimento é gravado junto com a data.
- **Edições geradas automaticamente** toda segunda-feira às 12:00 UTC (09:00 em Brasília) por um **Vercel Cron**
  que chama `GET /api/cron/newsletter` com `Authorization: Bearer $CRON_SECRET`. A geração é idempotente por semana.
  Alternativa sem Vercel: `pg_cron` + `pg_net` no Supabase (snippet em `docs/03-banco-de-dados.md`).
- **Envio via Resend** (REST, plano gratuito: 100 e-mails/dia, 3.000/mês), com descadastro **one-click**
  (RFC 8058: cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post`) e link visível em todo e-mail.
- **Sem chave do Resend**, as edições continuam sendo publicadas no site (`/newsletter/[slug]`).

## Consequências

- O remetente de testes `onboarding@resend.dev` só entrega para o e-mail da própria conta Resend; para enviar à
  comunidade é preciso verificar um domínio.
- O plano gratuito limita o volume diário; o serviço envia em lotes e retoma na execução seguinte.
- Detalhes: `docs/08-newsletter.md`.
