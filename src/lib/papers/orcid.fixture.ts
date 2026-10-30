/**
 * Resposta realista de `GET https://pub.orcid.org/v3.0/{orcid}/works` (Accept: application/json),
 * montada a partir do esquema documentado da API v3.0 (record_3.0/work-summary). Pesquisadora e
 * trabalhos fictícios; DOIs no prefixo de teste 10.5555. Usada só nos testes de ./orcid.ts.
 *
 * Casos cobertos:
 *   1. mesmo trabalho vindo de duas fontes (ORCID agrupou): a preferida (maior display-index) não
 *      traz a revista, a outra traz → o item final tem as duas coisas; DOI em maiúsculas;
 *   2. capítulo com DOI só na relação "part-of" (é o DOI do livro) → sem DOI;
 *   3. trabalho sem identificadores, com link e entidades HTML no título;
 *   4. o mesmo DOI do caso 1, em outro grupo e com o prefixo https://doi.org/ → duplicata;
 *   5. fonte sem título → ignorada;
 *   6. sem DOI, mas com o mesmo título e ano do caso 1 → duplicata;
 *   7. ano inválido e link com javascript: → ano e link descartados;
 *   8. grupo malformado (work-summary não é lista) → ignorado sem derrubar o resto.
 */
export const ORCID_WORKS_FIXTURE = {
  "last-modified-date": { value: 1761600000000 },
  group: [
    {
      "last-modified-date": { value: 1761600000000 },
      "external-ids": {
        "external-id": [
          {
            "external-id-type": "doi",
            "external-id-value": "10.5555/ARTEMIS.2024.001",
            "external-id-normalized": { value: "10.5555/artemis.2024.001", transient: true },
            "external-id-normalized-error": null,
            "external-id-url": { value: "https://doi.org/10.5555/ARTEMIS.2024.001" },
            "external-id-relationship": "self",
          },
        ],
      },
      "work-summary": [
        {
          "put-code": 1001,
          "created-date": { value: 1730000000000 },
          "last-modified-date": { value: 1761600000000 },
          source: {
            "source-orcid": { uri: "https://orcid.org/0000-0002-1825-0097" },
            "source-client-id": null,
            "source-name": { value: "Ana Pesquisadora" },
          },
          title: {
            title: { value: "Redes neurais leves para detecção de abelhas nativas" },
            subtitle: null,
            "translated-title": null,
          },
          "external-ids": {
            "external-id": [
              {
                "external-id-type": "doi",
                "external-id-value": "10.5555/ARTEMIS.2024.001",
                "external-id-normalized": { value: "10.5555/artemis.2024.001", transient: true },
                "external-id-url": null,
                "external-id-relationship": "self",
              },
            ],
          },
          url: null,
          type: "journal-article",
          "publication-date": { year: { value: "2024" }, month: { value: "03" }, day: null },
          "journal-title": null,
          visibility: "public",
          path: "/0000-0002-1825-0097/work/1001",
          "display-index": "1",
        },
        {
          "put-code": 1002,
          source: {
            "source-orcid": null,
            "source-client-id": { path: "0000-0002-3054-1567" },
            "source-name": { value: "Crossref" },
          },
          title: {
            title: { value: "Redes neurais leves para detecção de abelhas nativas" },
            subtitle: null,
            "translated-title": null,
          },
          "external-ids": {
            "external-id": [
              {
                "external-id-type": "issn",
                "external-id-value": "1234-5679",
                "external-id-relationship": "part-of",
              },
              {
                "external-id-type": "doi",
                "external-id-value": "10.5555/artemis.2024.001",
                "external-id-relationship": "self",
              },
            ],
          },
          url: { value: "https://revista.exemplo.org/artigo/1" },
          type: "journal-article",
          "publication-date": { year: { value: "2024" }, month: null, day: null },
          "journal-title": { value: "Revista Brasileira de Computação Aplicada" },
          visibility: "public",
          path: "/0000-0002-1825-0097/work/1002",
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": {
        "external-id": [
          {
            "external-id-type": "isbn",
            "external-id-value": "9788500000000",
            "external-id-relationship": "part-of",
          },
        ],
      },
      "work-summary": [
        {
          "put-code": 2001,
          title: { title: { value: "Mulheres na engenharia de materiais" } },
          "external-ids": {
            "external-id": [
              {
                "external-id-type": "doi",
                "external-id-value": "10.5555/livro-materiais",
                "external-id-relationship": "part-of",
              },
            ],
          },
          url: null,
          type: "book-chapter",
          "publication-date": { year: { value: "2021" } },
          "journal-title": { value: "Ciência de Materiais no Brasil" },
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": { "external-id": [] },
      "work-summary": [
        {
          "put-code": 3001,
          title: { title: { value: "Monitoramento de manguezais &amp; <i>sensoriamento</i>" } },
          "external-ids": { "external-id": [] },
          url: { value: "https://repositorio.exemplo.edu.br/handle/123" },
          type: "conference-paper",
          "publication-date": { year: { value: "2022" } },
          "journal-title": { value: "Simpósio Brasileiro de Sensoriamento Remoto" },
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": {
        "external-id": [
          {
            "external-id-type": "doi",
            "external-id-value": "https://doi.org/10.5555/Artemis.2024.001",
            "external-id-relationship": "self",
          },
        ],
      },
      "work-summary": [
        {
          "put-code": 4001,
          title: { title: { value: "Redes neurais leves para detecção de abelhas nativas" } },
          "external-ids": {
            "external-id": [
              {
                "external-id-type": "doi",
                "external-id-value": "https://doi.org/10.5555/Artemis.2024.001",
                "external-id-relationship": "self",
              },
            ],
          },
          url: null,
          type: "preprint",
          "publication-date": { year: { value: "2023" } },
          "journal-title": null,
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": null,
      "work-summary": [
        {
          "put-code": 5001,
          title: null,
          "external-ids": null,
          type: "other",
          "publication-date": null,
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": { "external-id": [] },
      "work-summary": [
        {
          "put-code": 6001,
          title: { title: { value: "Redes Neurais Leves para Detecção de Abelhas Nativas." } },
          "external-ids": { "external-id": [] },
          type: "journal-article",
          "publication-date": { year: { value: "2024" } },
          "journal-title": null,
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": { "external-id": [] },
      "work-summary": [
        {
          "put-code": 7001,
          title: { title: { value: "Ensino de química com materiais acessíveis" } },
          "external-ids": { "external-id": [] },
          url: { value: "javascript:alert(1)" },
          type: "dissertation-thesis",
          "publication-date": { year: { value: "0219" } },
          "journal-title": null,
          "display-index": "0",
        },
      ],
    },
    {
      "external-ids": { "external-id": [] },
      "work-summary": "quebrado",
    },
  ],
  path: "/0000-0002-1825-0097/works",
} as const;
