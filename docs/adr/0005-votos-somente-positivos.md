# ADR 0005 — Votos somente positivos ("destaques") nos papers

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

A vitrine existe para dar visibilidade a trabalhos de mulheres. Votos negativos abririam espaço para campanhas de
desvalorização ("downvote brigading") contra pesquisadoras específicas.

## Decisão

- Cada membra pode **destacar** (voto positivo, ícone de estrela) cada paper uma vez; não existe voto negativo.
- Não é possível destacar o próprio paper.
- Rankings: votos recebidos na **semana** (7 dias), no **mês** (30 dias), no **ano** e **todos os tempos**, além de
  **"Em alta"** com decaimento no tempo no estilo Hacker News: `votos / (horas_desde_publicação + 2)^1.5`.
- Um ranking da comunidade soma pontos por contribuição (papers, destaques recebidos, soluções no fórum,
  mentorias aceitas como mentora e participação).

## Consequências

- Rankings simples de explicar na interface e na apresentação.
- Conteúdo problemático é tratado por **denúncia + moderação**, não por votos negativos.
- Fórmulas implementadas em SQL (`get_paper_ranking`) e espelhadas em `src/lib/ranking` para testes.
