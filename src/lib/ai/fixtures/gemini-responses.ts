/**
 * Respostas REAIS da Gemini API (gemini-3.5-flash-lite, generateContent com responseJsonSchema),
 * gravadas em 28/10/2026 na validação com a chave da equipe, só com os dados fictícios do seed.
 * Redação: sem cabeçalhos (nunca gravados), sem `responseId`; os pedidos não são guardados
 * (só as respostas). Nenhum nome, e-mail ou instituição: a IA recebe e devolve só pseudônimos.
 * Usadas nos testes para reproduzir o formato real (usageMetadata, modelVersion, JSON
 * indentado no `text`) e os defeitos encontrados (texto sem acentos).
 */

/** Explicação das sugestões com o prompt atual (acentuação correta). Ranking cortado em 3 itens. */
export const GEMINI_EXPLAIN_OK = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{\n  "ranking": [\n    {\n      "id": "c1",\n      "score": 90,\n      "reason": "Vocês compartilham a paixão pela ecologia e o interesse comum em polinização, e ela tem ampla experiência em desenho amostral para ajudar você na preparação para a qualificação.",\n      "starters": [\n        "Como você costuma estruturar o desenho amostral em seus estudos de polinização?",\n        "Quais dicas você daria para lidar com a ansiedade antes da qualificação no doutorado?",\n        "De que forma você integra a divulgação científica em sua rotina de pesquisa?"\n      ]\n    },\n    {\n      "id": "c3",\n      "score": 65,\n      "reason": "Embora a formação dela seja em educação, ela orienta sobre saúde mental e equilíbrio, podendo acolher suas angústias e ajudar você a encontrar estratégias para a ansiedade pré-qualificação.",\n      "starters": [\n        "Como você gerencia o equilíbrio entre a vida acadêmica e a saúde mental?",\n        "Quais estratégias você recomenda para manter a calma antes de bancas importantes?"\n      ]\n    },\n    {\n      "id": "c4",\n      "score": 55,\n      "reason": "Ela foca em saúde mental e equilíbrio, temas essenciais para apoiar você a lidar com a ansiedade durante esta etapa desafiadora do doutorado.",\n      "starters": [\n        "Quais práticas você sugere para cuidar da saúde mental durante a pós-graduação?",\n        "Como você lida com a pressão e o estresse na rotina acadêmica?"\n      ]\n    }\n  ]\n}',
            thoughtSignature: "<assinatura opaca do modelo, redigida>",
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 1996,
    candidatesTokenCount: 889,
    totalTokenCount: 2885,
    promptTokensDetails: [
      {
        modality: "TEXT",
        tokenCount: 1996,
      },
    ],
    serviceTier: "standard",
  },
  modelVersion: "gemini-3.5-flash-lite",
};

/** Explicação das sugestões com o prompt antigo: texto inteiro sem acentos. Ranking cortado em 3 itens. */
export const GEMINI_EXPLAIN_UNACCENTED = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{\n  "ranking": [\n    {\n      "id": "c1",\n      "score": 90,\n      "reason": "Ela compartilha da sua paixao pela ecologia e tem forte experiencia com polinizacao, podendo ajudar bastante no seu desenho amostral. Alem disso, ela orienta sobre metodologia de pesquisa e divulgacao cientifica, alinhando-se perfeitamente aos seus objetivos.",\n      "starters": [\n        "Como voce costuma estruturar o desenho amostral para estudos de polinizacao?",\n        "Quais dicas voce daria para conciliar o trabalho de campo com a escrita da tese?",\n        "Como comecar a fazer divulgacao cientifica da nossa pesquisa de forma leve?"\n      ]\n    },\n    {\n      "id": "c4",\n      "score": 60,\n      "reason": "Ela possui experiencia em orientar sobre saude mental e equilibrio, o que pode ser um grande apoio para lidar com a ansiedade antes da sua qualificacao. Ela tambem compreende os desafios da trajetoria academica na pos-graduacao.",\n      "starters": [\n        "Como voce gerencia a ansiedade nos periodos proximos a exames importantes?",\n        "Quais estrategias voce recomenda para manter o equilibrio emocional durante o doutorado?"\n      ]\n    },\n    {\n      "id": "c3",\n      "score": 55,\n      "reason": "Ela aborda temas fundamentais como saude mental e equilibrio, alem de apoiar quem deseja levar a ciencia para as redes e para o publico. Ela podera acolher suas duvidas sobre o momento atual da sua carreira.",\n      "starters": [\n        "Como voce lida com a pressao da pos-graduacao sem descuidar da saude mental?",\n        "Quais caminhos voce sugere para comunicar melhor nossa ciencia para a sociedade?"\n      ]\n    }\n  ]\n}',
            thoughtSignature: "<assinatura opaca do modelo, redigida>",
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 1826,
    candidatesTokenCount: 1055,
    totalTokenCount: 2881,
    promptTokensDetails: [
      {
        modality: "TEXT",
        tokenCount: 1826,
      },
    ],
    serviceTier: "standard",
  },
  modelVersion: "gemini-3.5-flash-lite",
};

/** Resumo acessível com o prompt atual (terceira pessoa, com acentos). */
export const GEMINI_SUMMARY_OK = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"summary": "O estudo avaliou painéis feitos com resina vegetal e reforçados com fibra de bananeira para melhorar o isolamento acústico. As pesquisadoras testaram esses materiais para verificar a capacidade de absorção sonora. Os resultados mostraram que os painéis atingiram um desempenho comparável ao da lã de rocha, mas com menor custo e menor impacto ambiental."}',
            thoughtSignature: "<assinatura opaca do modelo, redigida>",
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 489,
    candidatesTokenCount: 79,
    totalTokenCount: 568,
    promptTokensDetails: [
      {
        modality: "TEXT",
        tokenCount: 489,
      },
    ],
    serviceTier: "standard",
  },
  modelVersion: "gemini-3.5-flash-lite",
};

/** Resumo acessível com o prompt antigo: sem acentos e na voz das autoras. */
export const GEMINI_SUMMARY_UNACCENTED = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"summary": "Voce ja se perguntou como podemos deixar os ambientes mais silenciosos usando materiais ecologicos? Nossa equipe avaliou painéis feitos com resina vegetal e fibras do tronco da bananeira para abafar sons indesejados. Descobrimos que esses painéis funcionam tao bem quanto a la de rocha, um material isolante comum. Alem disso, a nossa opcao apresenta um custo menor e reduz a pegada de carbono."}',
            thoughtSignature: "<assinatura opaca do modelo, redigida>",
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 417,
    candidatesTokenCount: 94,
    totalTokenCount: 511,
    promptTokensDetails: [
      {
        modality: "TEXT",
        tokenCount: 417,
      },
    ],
    serviceTier: "standard",
  },
  modelVersion: "gemini-3.5-flash-lite",
};

/** Campo opcional do esquema ("type": ["string", "null"]) devolvido como null. */
export const GEMINI_OPTIONAL_NULL = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{\n  "titulo": "Abelhas Nativas",\n  "subtitulo": null\n}',
            thoughtSignature: "<assinatura opaca do modelo, redigida>",
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 30,
    candidatesTokenCount: 22,
    totalTokenCount: 52,
    promptTokensDetails: [
      {
        modality: "TEXT",
        tokenCount: 30,
      },
    ],
    serviceTier: "standard",
  },
  modelVersion: "gemini-3.5-flash-lite",
};

/** Chave inválida: a Gemini API responde HTTP 400 (INVALID_ARGUMENT / API_KEY_INVALID), não 401. */
export const GEMINI_ERROR_INVALID_KEY = {
  error: {
    code: 400,
    message: "API key not valid. Please pass a valid API key.",
    status: "INVALID_ARGUMENT",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "API_KEY_INVALID",
        domain: "googleapis.com",
        metadata: {
          service: "generativelanguage.googleapis.com",
        },
      },
      {
        "@type": "type.googleapis.com/google.rpc.LocalizedMessage",
        locale: "en-US",
        message: "API key not valid. Please pass a valid API key.",
      },
    ],
  },
};
