import { describe, expect, it } from "vitest";
import {
  FORUM_PAGE_SIZE,
  markdownToPlainText,
  pageRange,
  parsePage,
  sanitizeSearchTerm,
  sanitizeTag,
  totalPages,
} from "./text";

describe("sanitizeSearchTerm", () => {
  it("remove curingas e a sintaxe de filtro do PostgREST", () => {
    expect(sanitizeSearchTerm("bolsa%_*")).toBe("bolsa");
    expect(sanitizeSearchTerm('a,b),title.eq.(x)"')).toBe("a b title.eq. x");
    expect(sanitizeSearchTerm("barra\\invertida")).toBe("barra invertida");
  });

  it("colapsa espaços, apara e aceita arrays de searchParams", () => {
    expect(sanitizeSearchTerm("  revisão   sistemática ")).toBe("revisão sistemática");
    expect(sanitizeSearchTerm(["primeiro", "segundo"])).toBe("primeiro");
    expect(sanitizeSearchTerm(undefined)).toBe("");
  });

  it("limita o tamanho", () => {
    expect(sanitizeSearchTerm("a".repeat(200))).toHaveLength(80);
  });
});

describe("sanitizeTag", () => {
  it("normaliza para minúsculas e remove caracteres de filtro", () => {
    expect(sanitizeTag("  Vale do Paraíba ")).toBe("vale do paraíba");
    expect(sanitizeTag("a,b{c}")).toBe("a b c");
    expect(sanitizeTag(undefined)).toBe("");
  });
});

describe("paginação", () => {
  it("parsePage aceita só inteiros positivos", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(["4", "5"])).toBe(4);
    expect(parsePage("999999")).toBe(1000);
  });

  it("pageRange e totalPages", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: FORUM_PAGE_SIZE - 1 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(41, 20)).toBe(3);
    expect(totalPages(40, 20)).toBe(2);
  });
});

describe("markdownToPlainText", () => {
  it("remove a sintaxe comum de Markdown", () => {
    const md = [
      "# Título",
      "Um **texto** com _ênfase_, `código` e [link](https://exemplo.org).",
      "> citação",
      "- item 1",
      "1. item 2",
      "- [x] tarefa",
      "![figura](https://exemplo.org/a.png)",
      "~~riscado~~",
    ].join("\n");
    expect(markdownToPlainText(md)).toBe(
      "Título Um texto com ênfase, código e link. citação item 1 item 2 tarefa figura riscado",
    );
  });

  it("preserva snake_case e conteúdo de blocos de código", () => {
    expect(markdownToPlainText("use a coluna author_id_hint")).toBe("use a coluna author_id_hint");
    expect(markdownToPlainText("```r\nlm(y ~ x)\n```")).toBe("lm(y ~ x)");
  });

  it("lida com vazio", () => {
    expect(markdownToPlainText(null)).toBe("");
    expect(markdownToPlainText("")).toBe("");
  });
});
