import { describe, expect, it } from "vitest";
import { parseEditionContent } from "./content";
import { formatAuthorsList } from "./format";
import { absoluteUrl, escapeHtml, renderConfirmationEmail, renderEditionEmail } from "./render";

const SITE = "https://ciencia-delas.example";

const edition = {
  slug: "2026-s43",
  title: "Boletim Delas — semana 43 de 2026",
  summary: 'Semana de "estrelas" & <descobertas>.',
  period_start: "2026-10-19",
  period_end: "2026-10-25",
  content: parseEditionContent({
    papers: [
      {
        id: "p1",
        title: "Queimadas <script>alert(1)</script>",
        authors: ["Ana Souza", "Bia Lima"],
        votes: 12,
        plain_summary: "Um resumo acessível.",
        url: "/papers/p1",
        area: "Ecologia",
      },
    ],
    threads: [
      {
        id: "t1",
        title: "Revisão sistemática",
        category: "Dúvidas de pesquisa",
        replies: 1,
        url: "/forum/t/t1",
      },
    ],
    mentors: [{ id: "m1", full_name: "Marina", headline: "Docente", url: "/pesquisadoras/m1" }],
    stats: { new_members: 1, new_papers: 2, mentorships: 0 },
  }),
};

describe("escapeHtml / absoluteUrl", () => {
  it("escapa HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
  it("monta URL absoluta sem barras duplicadas", () => {
    expect(absoluteUrl(`${SITE}/`, "/papers/1")).toBe(`${SITE}/papers/1`);
    expect(absoluteUrl(SITE, "papers/1")).toBe(`${SITE}/papers/1`);
  });
});

describe("renderEditionEmail", () => {
  const unsubscribeUrl = `${SITE}/newsletter/cancelar?token=abc`;
  const email = renderEditionEmail(edition, {
    siteUrl: SITE,
    unsubscribeUrl,
    recipientEmail: "ana@exemplo.org",
  });

  it("usa o título como assunto e um preheader curto", () => {
    expect(email.subject).toBe(edition.title);
    expect(email.preheader.length).toBeLessThanOrEqual(140);
  });

  it("escapa conteúdo vindo do banco", () => {
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("Queimadas &lt;script&gt;");
    expect(email.html).toContain("&quot;estrelas&quot; &amp; &lt;descobertas&gt;");
  });

  it("traz links absolutos, descadastro visível e versão web", () => {
    expect(email.html).toContain(`href="${SITE}/papers/p1"`);
    expect(email.html).toContain(`href="${SITE}/newsletter/cancelar?token=abc"`);
    expect(email.html).toContain(`href="${SITE}/newsletter/2026-s43"`);
    expect(email.html).toContain("Cancelar inscrição");
    expect(email.html).toContain('lang="pt-BR"');
  });

  it("gera versão em texto com os mesmos destaques", () => {
    expect(email.text).toContain("BOLETIM DELAS · 19 A 25 DE OUT. DE 2026");
    expect(email.text).toContain("1. Queimadas <script>alert(1)</script>");
    expect(email.text).toContain("Ana Souza e Bia Lima");
    expect(email.text).toContain("12 destaques · Ecologia");
    expect(email.text).toContain("1 nova integrante · 2 novos papers · 0 mentorias iniciadas");
    expect(email.text).toContain(`Cancelar inscrição: ${unsubscribeUrl}`);
  });
});

describe("renderConfirmationEmail", () => {
  it("tem o link de confirmação e o de remoção", () => {
    const email = renderConfirmationEmail({
      siteUrl: SITE,
      confirmUrl: `${SITE}/newsletter/confirmar?token=t`,
      removeUrl: `${SITE}/newsletter/cancelar?token=u`,
    });
    expect(email.subject).toBe("Confirme sua inscrição no Boletim Delas");
    expect(email.html).toContain(`href="${SITE}/newsletter/confirmar?token=t"`);
    expect(email.html).toContain(`href="${SITE}/newsletter/cancelar?token=u"`);
    expect(email.text).toContain("O link vale por 7 dias.");
  });
});

describe("formatAuthorsList", () => {
  it("formata em pt-BR", () => {
    expect(formatAuthorsList([])).toBe("");
    expect(formatAuthorsList(["Ana"])).toBe("Ana");
    expect(formatAuthorsList(["Ana", "Bia", "Carla"])).toBe("Ana, Bia e Carla");
    expect(formatAuthorsList(["A", "B", "C", "D", "E", "F"])).toBe("A, B, C, D e mais 2");
  });
});
