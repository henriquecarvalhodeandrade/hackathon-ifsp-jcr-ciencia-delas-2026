# ADR 0008 — Modo demonstração com personas fictícias e seeds por funcionalidade

- **Status:** aceita
- **Data:** 2026-10-28

## Contexto

Na apresentação, a banca e a plateia precisam ver a Artemis por dentro em poucos minutos. Digitar senha ao
vivo é lento, e o SMTP padrão do Supabase quase não entrega e-mails (link mágico e confirmação não chegam).
Ao mesmo tempo, quatro funcionalidades novas (painel, reconhecimento da mentoria, Pergunte a uma cientista e
afinidade de trajetória) foram construídas em paralelo e cada uma precisava de dados fictícios próprios para
o pitch, sem mexer no `supabase/seed.sql` das outras.

## Decisão

- **Modo demonstração atrás de uma variável só do servidor:** `/demo` existe apenas com `DEMO_MODE=true`
  (exatamente); desligado, responde 404 como qualquer rota inexistente. Uma lista **fixa** de personas
  (Larissa, Marina, Débora) — nunca `admin@` nem `moderacao@` — abre a sessão com um clique: o servidor gera o
  link mágico com a chave secreta, **sem enviar e-mail**, e grava a sessão só naquele navegador
  (`signOut({ scope: "local" })` antes). A persona precisa ter o papel `member`. Detalhes e modelo de
  segurança: [`14-painel-e-modo-demo.md`](../14-painel-e-modo-demo.md).
- **Seeds por funcionalidade:** cada funcionalidade traz `supabase/seeds/NN_<nome>.sql`, fictício, idempotente
  e com prefixos de UUID próprios. O `config.toml` aplica `["./seed.sql", "./seeds/*.sql"]` (ordem
  alfabética) no `supabase db reset` e no CI; `npm run db:validate` e o
  `setup-supabase-cloud.mjs --with-demo-seed` seguem a mesma ordem.

## Consequências

- As personas são contas **compartilhadas**: a exclusão e a troca de senha pela tela são recusadas com o modo
  ligado, mas a sessão é real. Por isso o modo fica ligado só durante o evento e os dados são reiniciados
  depois. Nunca ligar numa instância com membras reais.
- Todas as entradas do `/demo` saem do IP do servidor e dividem o limite de validações do Supabase Auth.
- O `seed.sql` continua sendo a base (contas, fórum, papers); um seed novo nunca edita o de outra
  funcionalidade. Dados relativos a `now()` envelhecem: rodar os seeds perto da apresentação.
