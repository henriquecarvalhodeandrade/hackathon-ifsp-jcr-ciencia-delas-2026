# ADR 0004 — Fórum só para membras e anonimato com autoria privada

- **Status:** aceita
- **Data:** 2026-10-27

## Contexto

O fórum é um espaço de apoio: relatos de assédio, maternidade e saúde mental exigem segurança. Ao mesmo tempo,
a moderação precisa conseguir agir em caso de abuso.

## Decisão

- O fórum e o diretório de pesquisadoras são **somente para membras logadas** (RLS `to authenticated`).
  Papers, ranking e o arquivo da newsletter são públicos, porque o objetivo deles é divulgação.
- Em categorias marcadas com `allow_anonymous`, a autora pode publicar **anonimamente**. O tópico/resposta é
  gravado com `author_id = NULL` e a autoria real vai para a tabela privada `forum_anonymous_authorship`,
  preenchida por trigger. Só a própria autora e a moderação conseguem lê-la; revelar a autoria é uma ação de
  administradora (`reveal_anonymous_author`).
- Conteúdo anônimo de categorias sensíveis não entra na newsletter pública.

## Consequências

- Uma consulta comum (`select('*')`) nunca vaza a autora de um post anônimo, porque o dado nem está na linha.
- Se a conta da autora for excluída, o conteúdo anônimo dela também é removido (LGPD).
- O código de conduta (`/conduta`) explica claramente que o anonimato é perante a comunidade, não perante a moderação.
