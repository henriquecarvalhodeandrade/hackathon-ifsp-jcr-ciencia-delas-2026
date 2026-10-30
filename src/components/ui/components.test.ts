import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { ConfirmDialog, confirmFailureMessage } from "./confirm-dialog";
import { Dialog } from "./dialog";
import { Textarea } from "./textarea";
import { Tooltip, type TooltipProps } from "./tooltip";

/**
 * Simula o que o React Flight entrega quando um Server Component passa JSX para um Client
 * Component e o pedaço ainda não chegou: um nó "lazy" (não é um elemento válido).
 */
function lazyNode(element: ReactElement): ReactElement {
  return {
    $$typeof: Symbol.for("react.lazy"),
    _payload: element,
    _init: (payload: ReactElement) => payload,
  } as unknown as ReactElement;
}

const openButton = () => createElement(Button, { variant: "outline" }, "Abrir diálogo");

describe("Dialog — gatilho", () => {
  it("renderiza o gatilho dentro do slot", () => {
    const html = renderToString(createElement(Dialog, { title: "Título", trigger: openButton() }));
    expect(html).toContain('<span class="contents"><button');
    expect(html).toContain("Abrir diálogo");
  });

  it("gera o MESMO HTML com um gatilho lazy (vindo do servidor) e com um elemento comum", () => {
    const regular = renderToString(
      createElement(Dialog, { title: "Título", trigger: openButton() }),
    );
    const lazy = renderToString(
      createElement(Dialog, { title: "Título", trigger: lazyNode(openButton()) }),
    );
    expect(lazy).toContain("Abrir diálogo");
    expect(lazy).toBe(regular);
  });

  it("ConfirmDialog também aceita gatilho lazy", () => {
    const html = renderToString(
      createElement(ConfirmDialog, {
        title: "Excluir?",
        trigger: lazyNode(createElement(Button, null, "Excluir comentário")),
        onConfirm: () => undefined,
      }),
    );
    expect(html).toContain("Excluir comentário");
  });

  it("o botão padrão do ConfirmDialog leva ícone, rótulo e classe", () => {
    const html = renderToString(
      createElement(ConfirmDialog, {
        title: "Excluir?",
        triggerLabel: "Excluir",
        triggerIcon: createElement("svg", { "aria-hidden": "true", "data-icone": "" }),
        triggerClassName: "text-fg-muted",
        onConfirm: () => undefined,
      }),
    );
    expect(html).toMatch(
      /<button[^>]*class="[^"]*text-fg-muted[^"]*"[^>]*><svg aria-hidden="true" data-icone=""><\/svg>Excluir<\/button>/,
    );
  });
});

describe("confirmFailureMessage", () => {
  it("devolve o erro de { ok: false, error }", () => {
    expect(confirmFailureMessage({ ok: false, error: "Sem permissão." })).toBe("Sem permissão.");
  });
  it("usa uma mensagem padrão quando o erro vem vazio", () => {
    expect(confirmFailureMessage({ ok: false })).toBe("Não foi possível concluir. Tente de novo.");
    expect(confirmFailureMessage({ ok: false, error: "" })).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
  });
  it("é null para sucesso e retornos sem contrato", () => {
    expect(confirmFailureMessage({ ok: true, message: "Feito." })).toBeNull();
    expect(confirmFailureMessage(undefined)).toBeNull();
    expect(confirmFailureMessage(null)).toBeNull();
  });
});

describe("Tooltip", () => {
  const render = (align?: TooltipProps["align"], side?: TooltipProps["side"]) => {
    const props: TooltipProps = {
      content: "Dica",
      align,
      side,
      children: createElement("button", { type: "button", "aria-describedby": undefined }, "Ação"),
    };
    return renderToString(createElement(Tooltip, props));
  };
  const tooltipClass = (html: string) =>
    html.match(/role="tooltip"[^>]*class="([^"]*)"/)?.[1] ??
    html.match(/class="([^"]*)"[^>]*role="tooltip"/)?.[1] ??
    "";

  it("escondida com display: none (não cria rolagem horizontal)", () => {
    const classes = tooltipClass(render()).split(" ");
    expect(classes).toContain("hidden");
    expect(classes).not.toContain("invisible");
    expect(classes).toContain("max-w-[min(15rem,calc(100vw-2rem))]");
  });

  it("centraliza por padrão e alinha nas bordas com start/end", () => {
    expect(tooltipClass(render())).toContain("left-1/2 -translate-x-1/2");
    const start = tooltipClass(render("start"));
    expect(start).toContain("left-0");
    expect(start).not.toContain("-translate-x-1/2");
    const end = tooltipClass(render("end"));
    expect(end).toContain("right-0");
    expect(end).not.toContain("left-1/2");
  });

  it("abre em cima ou embaixo", () => {
    expect(tooltipClass(render("center", "top"))).toContain("bottom-full");
    expect(tooltipClass(render("center", "bottom"))).toContain("top-full");
  });

  it("liga o aria-describedby do elemento à dica", () => {
    const html = render();
    const id =
      html.match(/role="tooltip" id="([^"]+)"/)?.[1] ??
      html.match(/id="([^"]+)"[^>]*role="tooltip"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-describedby="${id}"`);
  });
});

describe("Textarea — contador", () => {
  it("começa com o tamanho do defaultValue", () => {
    const html = renderToString(
      createElement(Textarea, {
        id: "bio",
        name: "bio",
        maxLength: 1500,
        showCount: true,
        defaultValue: "Olá, mundo",
      }),
    );
    expect(html).toContain('aria-describedby="bio-contador"');
    expect(html).toMatch(/id="bio-contador"[^>]*>10<!-- -->\/<!-- -->1.500/);
  });
});
