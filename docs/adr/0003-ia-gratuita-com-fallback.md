# ADR 0003 — IA gratuita com cadeia de fallback e modo heurístico

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

A proposta pede uma API de IA **gratuita** para sugerir mentoras a partir do perfil das pesquisadoras iniciantes.
Planos gratuitos têm limites baixos (requisições por minuto/dia), mudam de modelo com frequência (os Llama 3.x do
Groq foram desligados do plano free em 16/08/2026) e, no caso do Gemini gratuito, o Google pode usar os dados
enviados para melhorar produtos e exige usuárias com 18 anos ou mais.

## Decisão

1. **Matching híbrido em três camadas**: (a) filtro e similaridade semântica no Postgres com `pgvector`
   (embeddings `gemini-embedding-2`, 768 dimensões); (b) **score determinístico** em TypeScript (áreas em comum,
   similaridade, temas, diferença de senioridade, compatibilidade); (c) a IA generativa só **reordena e explica**
   as melhores candidatas e sugere temas para a primeira conversa.
2. **Cadeia de provedores** via `fetch` (sem SDKs): Gemini `gemini-3.5-flash-lite` → Groq `openai/gpt-oss-120b`
   → OpenRouter `openrouter/free`. Em erro 429/5xx/timeout/JSON inválido, tenta o próximo.
3. **Sem nenhuma chave, o app continua funcionando** com o score heurístico e explicações por template.
4. **Privacidade**: o prompt não leva nome, e-mail nem links; as candidatas viram `c1..cN` e são remapeadas no
   servidor. O recurso exige consentimento explícito (`profiles.ai_consent`), com aviso de 18+ e do uso de dados
   do plano gratuito.

## Consequências

- A demo nunca quebra por falta de cota.
- A IA não "inventa" mentoras: IDs que não vieram do banco são descartados.
- Trocar de modelo de embedding exige recalcular todos os vetores (`scripts/ai/backfill-embeddings.ts`).
- Detalhes, pesos e prompts: `docs/04-mentoria-com-ia.md`.
