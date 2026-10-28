import { describe, expect, it } from "vitest";
import {
  declarationConsentSchema,
  declarationRequestSchema,
  declarationRevokeSchema,
  feedbackSchema,
  returnToSchema,
} from "./schemas";

const REQ = "c1000000-0000-4000-8000-000000000005";
const DECL = "c1d00000-0000-4000-8000-000000000001";

describe("feedbackSchema", () => {
  it("aceita o retorno completo e converte os tipos", () => {
    const parsed = feedbackSchema.parse({
      request_id: REQ,
      helpfulness: "4",
      outcomes: ["menos-sozinha", "plano-definido", "menos-sozinha"],
      would_recommend: "sim",
      note: "  Foi ótimo.\r\nObrigada!  ",
    });
    expect(parsed).toEqual({
      request_id: REQ,
      helpfulness: 4,
      outcomes: ["menos-sozinha", "plano-definido"],
      would_recommend: true,
      note: "Foi ótimo.\nObrigada!",
    });
  });

  it("só a nota de ajuda é obrigatória", () => {
    const parsed = feedbackSchema.parse({ request_id: REQ, helpfulness: "1", outcomes: [] });
    expect(parsed).toMatchObject({ outcomes: [], would_recommend: null, note: null });
    const missing = feedbackSchema.safeParse({ request_id: REQ, outcomes: [] });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toBe(
      "Escolha de 1 a 5 quanto a mentoria ajudou você.",
    );
  });

  it("'Não' e 'Prefiro não dizer' viram false e null", () => {
    const base = { request_id: REQ, helpfulness: "3", outcomes: [] };
    expect(feedbackSchema.parse({ ...base, would_recommend: "nao" }).would_recommend).toBe(false);
    expect(
      feedbackSchema.parse({ ...base, would_recommend: "prefiro-nao-dizer" }).would_recommend,
    ).toBeNull();
    expect(feedbackSchema.parse({ ...base, would_recommend: "" }).would_recommend).toBeNull();
    expect(feedbackSchema.safeParse({ ...base, would_recommend: "talvez" }).success).toBe(false);
  });

  it("recusa nota fora de 1–5, opção inventada, opções demais e comentário longo", () => {
    const base = { request_id: REQ, helpfulness: "3", outcomes: [] };
    expect(feedbackSchema.safeParse({ ...base, helpfulness: "6" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, helpfulness: "0" }).success).toBe(false);
    const invented = feedbackSchema.safeParse({ ...base, outcomes: ["<script>"] });
    expect(invented.error?.issues[0]?.message).toBe(
      "Uma das opções escolhidas não existe mais. Recarregue a página.",
    );
    expect(
      feedbackSchema.safeParse({ ...base, outcomes: Array(7).fill("menos-sozinha") }).success,
    ).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, note: "a".repeat(501) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, note: "a".repeat(500) }).success).toBe(true);
    // CRLF conta como uma quebra (o contador do campo também).
    expect(feedbackSchema.safeParse({ ...base, note: "a\r\n".repeat(250) }).success).toBe(true);
  });

  it("id do pedido precisa ser um UUID", () => {
    expect(
      feedbackSchema.safeParse({ request_id: "1 or 1=1", helpfulness: "5", outcomes: [] }).success,
    ).toBe(false);
  });
});

describe("declaração", () => {
  it("pedir exige a autorização marcada", () => {
    expect(declarationRequestSchema.safeParse({ request_id: REQ, consent: "on" }).success).toBe(
      true,
    );
    const missing = declarationRequestSchema.safeParse({ request_id: REQ });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toContain("autorize que seu nome apareça");
  });

  it("autorizar também exige a caixa marcada", () => {
    expect(
      declarationConsentSchema.safeParse({ request_id: REQ, declaration_id: DECL, consent: "on" })
        .success,
    ).toBe(true);
    expect(
      declarationConsentSchema.safeParse({ request_id: REQ, declaration_id: DECL }).success,
    ).toBe(false);
  });

  it("revogar: motivo opcional, até 300 caracteres", () => {
    expect(
      declarationRevokeSchema.parse({ request_id: REQ, declaration_id: DECL, reason: "  " }).reason,
    ).toBeNull();
    expect(
      declarationRevokeSchema.parse({ request_id: REQ, declaration_id: DECL, reason: " Mudei. " })
        .reason,
    ).toBe("Mudei.");
    expect(
      declarationRevokeSchema.safeParse({
        request_id: REQ,
        declaration_id: DECL,
        reason: "a".repeat(301),
      }).success,
    ).toBe(false);
  });

  it("destino só entre valores conhecidos (nunca uma URL do formulário)", () => {
    expect(returnToSchema.parse("concluida")).toBe("concluida");
    expect(returnToSchema.parse("https://evil.example")).toBe("ativas");
    expect(returnToSchema.parse(undefined)).toBe("ativas");
  });
});
