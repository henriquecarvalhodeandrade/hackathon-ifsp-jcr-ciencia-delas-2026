import { describe, expect, it } from "vitest";
import {
  boundaryTie,
  careerStageLabel,
  commentsLabel,
  feedHref,
  FEED_TAB_LABELS,
  isEdited,
  likesLabel,
  paginate,
  parseCursor,
  parseFeedTab,
  portfolioKindLabel,
  POST_KIND_LABELS,
  POST_KIND_OPTIONS,
  postKindLabel,
  postKindTone,
  preserveLineBreaks,
  toCursor,
} from "./presentation";

describe("tipos de publicação", () => {
  it("tem rótulo e tom para cada tipo, na ordem do banco", () => {
    expect(POST_KIND_OPTIONS.map((o) => o.label)).toEqual([
      "Atualização",
      "Projeto",
      "Conquista",
      "Publicação",
      "Evento",
    ]);
    expect(postKindLabel("event")).toBe(POST_KIND_LABELS.event);
    expect(postKindLabel("desconhecido")).toBe("Atualização");
    expect(postKindTone("achievement")).toBe("accent");
    expect(postKindTone("desconhecido")).toBe("neutral");
  });

  it("rotula itens do portfólio", () => {
    expect(portfolioKindLabel("article")).toBe("Artigo");
    expect(portfolioKindLabel("novo")).toBe("Portfólio");
  });
});

describe("parseFeedTab", () => {
  it("aceita as duas abas e cai em 'todas' no resto", () => {
    expect(parseFeedTab("seguindo")).toBe("seguindo");
    expect(parseFeedTab(["seguindo", "todas"])).toBe("seguindo");
    expect(parseFeedTab("Seguindo")).toBe("todas");
    expect(parseFeedTab(undefined)).toBe("todas");
    expect(FEED_TAB_LABELS.todas).toBe("Todas");
  });
});

describe("cursor", () => {
  it("aceita o created_at do PostgREST com microssegundos e fuso", () => {
    expect(parseCursor("2026-10-28T12:34:56.123456+00:00")).toBe(
      "2026-10-28T12:34:56.123456+00:00",
    );
    expect(parseCursor("2026-10-28T12:34:56Z")).toBe("2026-10-28T12:34:56Z");
    expect(parseCursor(["2026-10-28T12:34:56.1Z"])).toBe("2026-10-28T12:34:56.1Z");
  });

  it("recusa valores inválidos ou sem fuso", () => {
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("ontem")).toBeNull();
    expect(parseCursor("2026-10-28")).toBeNull();
    expect(parseCursor("2026-10-28T12:34:56")).toBeNull();
    expect(parseCursor("2026-13-45T12:34:56Z")).toBeNull();
    expect(parseCursor("2026-10-28T12:34:56Z,id.eq.1")).toBeNull();
  });

  it("toCursor troca +00:00 por Z sem perder precisão", () => {
    expect(toCursor("2026-10-28T12:34:56.123456+00:00")).toBe("2026-10-28T12:34:56.123456Z");
    expect(toCursor("2026-10-28T09:34:56.5-03:00")).toBe("2026-10-28T09:34:56.5-03:00");
  });

  it("feedHref preserva a aba e codifica o cursor", () => {
    expect(feedHref()).toBe("/feed");
    expect(feedHref({ tab: "seguindo" })).toBe("/feed?aba=seguindo");
    expect(feedHref({ tab: "todas", before: "2026-10-28T12:00:00Z" })).toBe(
      "/feed?antes=2026-10-28T12%3A00%3A00Z",
    );
    // "+" precisa ir codificado (sem isso vira espaço na URL)
    expect(feedHref({ tab: "seguindo", before: "2026-10-28T09:00:00-03:00" })).toBe(
      "/feed?aba=seguindo&antes=2026-10-28T09%3A00%3A00-03%3A00",
    );
    expect(feedHref({ before: "2026-10-28T09:00:00+01:00" })).toContain("%2B01");
  });
});

describe("paginate", () => {
  const row = (id: string, created_at: string) => ({ id, created_at });

  it("sem a linha extra, não há próxima página", () => {
    const rows = [row("a", "2026-10-28T12:00:03Z"), row("b", "2026-10-28T12:00:02Z")];
    expect(paginate(rows, 2)).toEqual({ items: rows, nextCursor: null });
  });

  it("com a linha extra, corta e aponta o cursor para a última mostrada", () => {
    const rows = [
      row("a", "2026-10-28T12:00:03+00:00"),
      row("b", "2026-10-28T12:00:02+00:00"),
      row("c", "2026-10-28T12:00:01+00:00"),
    ];
    const page = paginate(rows, 2);
    expect(page.items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("2026-10-28T12:00:02Z");
    expect(boundaryTie(rows, 2)).toBeNull();
  });

  it("empate na borda: o grupo inteiro do mesmo instante entra na página", () => {
    const t = "2026-10-28T12:00:02+00:00";
    const rows = [row("a", "2026-10-28T12:00:03+00:00"), row("c", t), row("b", t)];
    expect(boundaryTie(rows, 2)).toBe(t);
    const tied = [row("c", t), row("b", t), row("d", t)];
    const page = paginate(rows, 2, tied);
    expect(page.items.map((r) => r.id)).toEqual(["a", "c", "b", "d"]);
    expect(page.nextCursor).toBe("2026-10-28T12:00:02Z");
  });
});

describe("isEdited", () => {
  it("só conta como editada depois de mais de 1 s", () => {
    const created = "2026-10-28T12:00:00.000000+00:00";
    expect(isEdited(created, created)).toBe(false);
    expect(isEdited(created, "2026-10-28T12:00:01.000000+00:00")).toBe(false);
    expect(isEdited(created, "2026-10-28T12:00:01.001000+00:00")).toBe(true);
    expect(isEdited(created, null)).toBe(false);
    expect(isEdited("x", "y")).toBe(false);
  });
});

describe("textos", () => {
  it("pluraliza curtidas e comentários", () => {
    expect(likesLabel(0)).toBe("0 curtidas");
    expect(likesLabel(1)).toBe("1 curtida");
    expect(commentsLabel(1)).toBe("1 comentário");
    expect(commentsLabel(1200)).toBe("1.200 comentários");
  });

  it("rotula a etapa da carreira", () => {
    expect(careerStageLabel("phd")).toBe("Doutorado");
    expect(careerStageLabel(null)).toBeNull();
    expect(careerStageLabel("astronauta")).toBeNull();
  });
});

describe("preserveLineBreaks", () => {
  it("transforma Enter simples em quebra de linha", () => {
    expect(preserveLineBreaks("Linha 1\nLinha 2")).toBe("Linha 1  \nLinha 2");
    expect(preserveLineBreaks("Linha 1\r\nLinha 2")).toBe("Linha 1  \nLinha 2");
  });

  it("mantém parágrafos, quebras já marcadas e a última linha", () => {
    expect(preserveLineBreaks("Um\n\nDois")).toBe("Um\n\nDois");
    expect(preserveLineBreaks("Um  \nDois\\\nTrês")).toBe("Um  \nDois\\\nTrês");
    expect(preserveLineBreaks("Só uma linha")).toBe("Só uma linha");
  });

  it("não mexe dentro de blocos de código cercados", () => {
    const md = "Veja:\n```py\nx = 1\ny = 2\n```\nFim\ndepois";
    expect(preserveLineBreaks(md)).toBe("Veja:  \n```py\nx = 1\ny = 2\n```\nFim  \ndepois");
    const tilde = "~~~\na\n```\nb\n~~~\nc\nd";
    expect(preserveLineBreaks(tilde)).toBe("~~~\na\n```\nb\n~~~\nc  \nd");
  });
});
