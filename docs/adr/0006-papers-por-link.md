# ADR 0006 — Papers divulgados por link/DOI, sem upload de PDF

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

Hospedar PDFs de artigos publicados pode violar direitos autorais das editoras e consome armazenamento do plano
gratuito.

## Decisão

- A vitrine guarda **metadados** (título, autoras/es, resumo, revista/evento, ano, área, palavras-chave) e aponta
  para o DOI (`https://doi.org/...`) ou para uma URL (repositório institucional, arXiv, SciELO, etc.).
- O formulário busca os metadados automaticamente pela **API pública do Crossref** a partir do DOI.
- Quem divulga confirma que o trabalho tem autoria ou coautoria feminina e informa sua relação com ele.
- Um **resumo acessível** (linguagem simples) pode ser escrito pela autora ou gerado por IA e revisado antes de salvar.

## Consequências

- Sem risco de hospedar conteúdo protegido; o armazenamento fica livre para avatares.
- Depende de links externos estarem disponíveis — o DOI é preferível por ser persistente.
