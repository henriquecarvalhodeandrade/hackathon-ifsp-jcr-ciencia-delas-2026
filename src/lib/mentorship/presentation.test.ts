import { describe, expect, it } from "vitest";
import {
  aiProviderLabel,
  appendStarter,
  capacitySummary,
  defaultRequestMessage,
  firstName,
  isOpenStatus,
  NOTICE_KEYS,
  parseNotice,
  parseTab,
  resolveTab,
  sharedItems,
  statusLabel,
  statusTone,
  suggestionSourceLabel,
  tabHref,
  type TabContext,
} from "./presentation";

const base: TabContext = {
  requested: null,
  showReceived: false,
  seeksMentorship: true,
  isMentor: false,
  pendingReceived: 0,
  hasDeepLink: false,
};

describe("parseTab", () => {
  it("aceita só abas conhecidas", () => {
    expect(parseTab("enviadas")).toBe("enviadas");
    expect(parseTab(["ativas", "x"])).toBe("ativas");
    expect(parseTab("admin")).toBeNull();
    expect(parseTab(undefined)).toBeNull();
    expect(parseTab(42)).toBeNull();
  });
});

describe("resolveTab", () => {
  it("mentoranda cai em sugestões", () => {
    expect(resolveTab(base)).toBe("sugestoes");
  });
  it("mentora com pedidos pendentes cai em recebidas", () => {
    expect(
      resolveTab({
        ...base,
        seeksMentorship: false,
        isMentor: true,
        showReceived: true,
        pendingReceived: 2,
      }),
    ).toBe("recebidas");
  });
  it("mentora sem pendências também cai em recebidas", () => {
    expect(
      resolveTab({ ...base, seeksMentorship: false, isMentor: true, showReceived: true }),
    ).toBe("recebidas");
  });
  it("respeita a aba pedida, menos 'recebidas' para quem não é mentora", () => {
    expect(resolveTab({ ...base, requested: "ativas" })).toBe("ativas");
    expect(resolveTab({ ...base, requested: "recebidas" })).toBe("sugestoes");
    expect(resolveTab({ ...base, requested: "recebidas", showReceived: true })).toBe("recebidas");
  });
  it("link direto sempre abre sugestões", () => {
    expect(resolveTab({ ...base, requested: "ativas", hasDeepLink: true })).toBe("sugestoes");
  });
  it("quem não é mentora nem busca mentoria vê sugestões (convite)", () => {
    expect(resolveTab({ ...base, seeksMentorship: false })).toBe("sugestoes");
  });
  it("gera o href da aba", () => {
    expect(tabHref("recebidas")).toBe("/mentoria?aba=recebidas");
  });
});

describe("status", () => {
  it("tem tom e rótulo para cada status", () => {
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("accepted")).toBe("success");
    expect(statusTone("completed")).toBe("primary");
    expect(statusTone("declined")).toBe("neutral");
    expect(statusLabel("accepted")).toBe("Mentoria ativa");
    expect(statusLabel("pending")).toBe("Aguardando resposta");
  });
  it("só pending e accepted estão em aberto", () => {
    expect(isOpenStatus("pending")).toBe(true);
    expect(isOpenStatus("accepted")).toBe(true);
    expect(isOpenStatus("completed")).toBe(false);
    expect(isOpenStatus(null)).toBe(false);
  });
});

describe("origem da sugestão", () => {
  it("identifica o provedor pelo modelo", () => {
    expect(aiProviderLabel("gemini-3.5-flash-lite")).toBe("Gemini");
    expect(aiProviderLabel("openai/gpt-oss-120b")).toBe("Groq");
    expect(aiProviderLabel("openrouter/free")).toBe("OpenRouter");
    expect(aiProviderLabel("meta-llama/llama-4:free")).toBe("OpenRouter");
    expect(aiProviderLabel("desconhecido")).toBeNull();
    expect(aiProviderLabel(null)).toBeNull();
  });
  it("monta o selo", () => {
    expect(suggestionSourceLabel("ai", "gemini-3.5-flash-lite")).toBe("Sugestão por IA (Gemini)");
    expect(suggestionSourceLabel("ai", null)).toBe("Sugestão por IA");
    expect(suggestionSourceLabel("heuristic", "gemini-3.5-flash-lite")).toBe(
      "Sugestão por afinidade",
    );
  });
});

describe("textos", () => {
  it("primeiro nome ignora títulos", () => {
    expect(firstName("Dra. Marina Albuquerque")).toBe("Marina");
    expect(firstName("  Ana  ")).toBe("Ana");
    expect(firstName("")).toBe("");
    expect(firstName(null)).toBe("");
  });
  it("rascunho do pedido saúda a mentora e inclui a pergunta", () => {
    const text = defaultRequestMessage("Marina Albuquerque", "Como você escolheu sua área?");
    expect(text.startsWith("Olá, Marina!")).toBe(true);
    expect(text).toContain("Uma pergunta para começarmos: Como você escolheu sua área?");
    expect(text.length).toBeGreaterThanOrEqual(20);
    expect(defaultRequestMessage(null).startsWith("Olá! ")).toBe(true);
    expect(defaultRequestMessage("Ana", "  ")).not.toContain("pergunta");
  });
  it("acrescenta perguntas sem duplicar", () => {
    expect(appendStarter("Oi", "Pergunta?")).toBe("Oi\n\nPergunta?");
    expect(appendStarter("Oi\n\nPergunta?", "Pergunta?")).toBe("Oi\n\nPergunta?");
    expect(appendStarter("   ", "Pergunta?")).toBe("Pergunta?");
    expect(appendStarter("Oi", " ")).toBe("Oi");
  });
  it("itens em comum mantêm a ordem e não repetem", () => {
    expect(sharedItems([3, 1, 2, 3], [2, 3])).toEqual([3, 2]);
    expect(sharedItems(["a"], [])).toEqual([]);
    expect(sharedItems(null, ["a"])).toEqual([]);
  });
});

describe("capacitySummary", () => {
  it("calcula vagas e percentual", () => {
    expect(capacitySummary(1, 3)).toEqual({
      used: 1,
      capacity: 3,
      openSlots: 2,
      full: false,
      percent: 33,
    });
    expect(capacitySummary(2, 2)).toMatchObject({ openSlots: 0, full: true, percent: 100 });
  });
  it("capacidade zero ou nula é cheia", () => {
    expect(capacitySummary(0, 0)).toMatchObject({ full: true, percent: 100, openSlots: 0 });
    expect(capacitySummary(0, null)).toMatchObject({ full: true });
  });
  it("não passa de 100% nem de vagas negativas", () => {
    expect(capacitySummary(5, 2)).toMatchObject({ openSlots: 0, percent: 100 });
  });
});

describe("parseNotice", () => {
  it("só aceita chaves conhecidas", () => {
    expect(parseNotice("enviado")?.title).toBe("Pedido enviado!");
    expect(parseNotice(["aceito"])?.variant).toBe("success");
    expect(parseNotice("mentoria-cancelada")?.title).toBe("Mentoria cancelada");
    expect(parseNotice("<script>")).toBeNull();
    expect(parseNotice(undefined)).toBeNull();
  });
  it("tem os avisos do reconhecimento (retorno e declaração), sem prometer o que não acontece", () => {
    expect(parseNotice("retorno-enviado")).toMatchObject({ variant: "success" });
    expect(parseNotice("retorno-enviado")?.body).toContain("Só você vê");
    expect(parseNotice("retorno-apagado")?.variant).toBe("info");
    expect(parseNotice("declaracao-pedida")?.body).toContain("outra participante");
    expect(parseNotice("declaracao-emitida")?.title).toBe("Declaração emitida!");
    expect(parseNotice("declaracao-revogada")?.body).toContain("sem nomes");
    expect(parseNotice("declaracao-cancelada")?.body).toContain("Nenhum nome foi publicado");
  });
  it("cada chave conhecida tem um aviso com título e texto", () => {
    for (const key of NOTICE_KEYS) {
      const notice = parseNotice(key);
      expect(notice?.title, key).toBeTruthy();
      expect(notice?.body, key).toBeTruthy();
    }
  });
});
