import { SITE } from "@/lib/constants";
import { formatNumber, pluralize, truncate } from "@/lib/utils";
import { CONFIRM_TOKEN_TTL_DAYS, NEWSLETTER_NAME } from "./constants";
import type { NewsletterContent } from "./content";
import { formatAuthorsList } from "./format";
import { formatEditionPeriod } from "./week";

/**
 * Renderização dos e-mails (puro, testável): HTML "à prova de cliente de e-mail" (tabelas,
 * estilos inline, largura 600px) + versão em texto. A página web da edição NÃO usa este HTML:
 * ela é renderizada em React a partir do mesmo `content` (src/components/newsletter).
 */

/** Cores da marca (fixas: e-mail não tem tokens nem tema escuro confiável). */
const C = {
  page: "#f6f5fa", // tinta-50
  surface: "#ffffff",
  border: "#dfdce6", // tinta-200
  header: "#251046", // violeta-950
  headerSoft: "#e0d0ff", // violeta-200
  text: "#1a1820", // tinta-950
  muted: "#4c4855", // tinta-700
  subtle: "#625e6b", // tinta-600
  primary: "#6530ac", // violeta-700
  primarySoft: "#efe6ff", // violeta-100
  star: "#a46100", // ambar-700 (estrela sobre branco, contraste ≥ 3:1)
  accent: "#ffb24a", // ambar-400
};

const SANS = "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Arial,Helvetica,sans-serif";
const SERIF = "Newsreader,Georgia,'Times New Roman',serif";

/** Assinatura do rodapé dos e-mails: nome da plataforma + tema do hackathon (nome secundário). */
const BRAND_FOOTER = `${SITE.name} — rede de apoio, mentoria e visibilidade para mulheres na ciência. Feito no Hackathon IFSP Jacareí 2026, tema ${SITE.theme}.`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Junta a URL do site com um caminho interno. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface EditionForRender {
  slug: string;
  title: string;
  summary: string | null;
  period_start: string | null;
  period_end: string | null;
  content: NewsletterContent;
}

export interface EditionEmailContext {
  siteUrl: string;
  /** Página de descadastro com botão (GET não descadastra). */
  unsubscribeUrl: string;
  /** E-mail da destinatária, para o rodapé "você recebe porque...". */
  recipientEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

function preheaderBlock(text: string): string {
  // Espaçadores invisíveis evitam que o cliente puxe o resto do corpo para a prévia.
  const filler = "&#8199;&#65279;&#847; ".repeat(40);
  return `<div style="display:none;font-size:1px;color:${C.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(text)}${filler}</div>`;
}

function layout({
  title,
  preheader,
  body,
}: {
  title: string;
  preheader: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { color:${C.primary}; }
  @media (max-width: 620px) {
    .cd-container { width:100% !important; }
    .cd-px { padding-left:20px !important; padding-right:20px !important; }
    .cd-stat { display:block !important; width:100% !important; padding:8px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="cd-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
${body}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function headerRow(eyebrow: string, title: string, subtitle?: string): string {
  return `<tr><td class="cd-px" style="background-color:${C.header};padding:32px 40px;">
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.headerSoft};">${escapeHtml(eyebrow)}</p>
<h1 style="margin:10px 0 0;font-family:${SERIF};font-size:28px;line-height:34px;font-weight:600;color:#ffffff;">${escapeHtml(title)}</h1>
${subtitle ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:15px;line-height:24px;color:${C.headerSoft};">${escapeHtml(subtitle)}</p>` : ""}
</td></tr>`;
}

function sectionTitle(title: string): string {
  return `<tr><td class="cd-px" style="padding:28px 40px 4px;">
<h2 style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.primary};">${escapeHtml(title)}</h2>
</td></tr>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:10px;background-color:${C.primary};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function footerRow(lines: string[]): string {
  return `<tr><td class="cd-px" style="padding:24px 40px 32px;border-top:1px solid ${C.border};background-color:${C.page};">
${lines.map((l) => `<p style="margin:0 0 8px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.subtle};">${l}</p>`).join("\n")}
</td></tr>`;
}

function statsLine(content: NewsletterContent): string {
  const { stats } = content;
  return [
    pluralize(stats.new_members, "nova integrante", "novas integrantes"),
    pluralize(stats.new_papers, "novo paper", "novos papers"),
    pluralize(stats.mentorships, "mentoria iniciada", "mentorias iniciadas"),
  ].join(" · ");
}

/** "3 novas mentoras chegaram à rede nesta semana." */
export function mentorSummaryHeadline(total: number): string {
  return total === 1
    ? "1 nova mentora chegou à rede nesta semana."
    : `${formatNumber(total)} novas mentoras chegaram à rede nesta semana.`;
}

export function editionPreheader(edition: EditionForRender): string {
  const base = edition.summary?.trim() || "Os destaques da semana na ciência feita por mulheres.";
  return truncate(base.replace(/\s+/g, " "), 140);
}

/** E-mail semanal da edição, personalizado com o link de descadastro da destinatária. */
export function renderEditionEmail(
  edition: EditionForRender,
  ctx: EditionEmailContext,
): RenderedEmail {
  const { content } = edition;
  const period = formatEditionPeriod(edition.period_start, edition.period_end);
  const eyebrow = period ? `${NEWSLETTER_NAME} · ${period}` : NEWSLETTER_NAME;
  const webUrl = absoluteUrl(ctx.siteUrl, `/newsletter/${encodeURIComponent(edition.slug)}`);
  const privacyUrl = absoluteUrl(ctx.siteUrl, "/privacidade");
  const preheader = editionPreheader(edition);
  const summary = edition.summary?.trim();

  const rows: string[] = [
    headerRow(eyebrow, edition.title, "A newsletter semanal da Artemis"),
  ];

  if (summary) {
    rows.push(`<tr><td class="cd-px" style="padding:32px 40px 0;">
<p style="margin:0;font-family:${SERIF};font-size:18px;line-height:29px;color:${C.text};">${escapeHtml(summary)}</p>
</td></tr>`);
  }

  const { stats } = content;
  rows.push(`<tr><td class="cd-px" style="padding:24px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.primarySoft};border-radius:12px;">
<tr>
${[
  [stats.new_members, stats.new_members === 1 ? "nova integrante" : "novas integrantes"],
  [stats.new_papers, stats.new_papers === 1 ? "novo paper" : "novos papers"],
  [stats.mentorships, stats.mentorships === 1 ? "mentoria iniciada" : "mentorias iniciadas"],
]
  .map(
    ([
      value,
      label,
    ]) => `<td class="cd-stat" width="33%" align="center" style="padding:16px 8px;font-family:${SANS};">
<p style="margin:0;font-size:26px;line-height:30px;font-weight:700;color:${C.header};">${formatNumber(Number(value))}</p>
<p style="margin:2px 0 0;font-size:13px;line-height:18px;color:${C.muted};">${escapeHtml(String(label))}</p>
</td>`,
  )
  .join("\n")}
</tr></table>
</td></tr>`);

  if (content.papers.length) {
    rows.push(sectionTitle("Papers em destaque na Vitrine"));
    for (const paper of content.papers) {
      const url = absoluteUrl(ctx.siteUrl, paper.url);
      const meta = [
        `<span style="color:${C.star};">&#9733;</span> ${escapeHtml(pluralize(paper.votes, "destaque"))}`,
        paper.area ? escapeHtml(paper.area) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      rows.push(`<tr><td class="cd-px" style="padding:14px 40px 6px;">
<p style="margin:0;font-family:${SERIF};font-size:19px;line-height:26px;font-weight:600;"><a href="${escapeHtml(url)}" style="color:${C.text};text-decoration:none;">${escapeHtml(paper.title)}</a></p>
${paper.authors.length ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.muted};">${escapeHtml(formatAuthorsList(paper.authors))}</p>` : ""}
<p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.subtle};">${meta}</p>
${paper.plain_summary ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:24px;color:${C.text};"><strong style="color:${C.primary};">Resumo acessível:</strong> ${escapeHtml(truncate(paper.plain_summary, 280))}</p>` : ""}
<p style="margin:8px 0 0;font-family:${SANS};font-size:14px;line-height:20px;font-weight:700;"><a href="${escapeHtml(url)}" style="color:${C.primary};">Ler na Vitrine &rarr;</a></p>
</td></tr>`);
    }
  }

  if (content.threads.length) {
    rows.push(sectionTitle("Conversas no fórum"));
    for (const thread of content.threads) {
      const url = absoluteUrl(ctx.siteUrl, thread.url);
      const meta = [thread.category || null, pluralize(thread.replies, "resposta")]
        .filter(Boolean)
        .join(" · ");
      rows.push(`<tr><td class="cd-px" style="padding:10px 40px 4px;">
<p style="margin:0;font-family:${SANS};font-size:16px;line-height:24px;font-weight:700;"><a href="${escapeHtml(url)}" style="color:${C.text};">${escapeHtml(thread.title)}</a></p>
<p style="margin:2px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.subtle};">${escapeHtml(meta)}</p>
</td></tr>`);
    }
    rows.push(`<tr><td class="cd-px" style="padding:6px 40px 0;">
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.subtle};">O fórum é aberto só para membras: entre com a sua conta para ler e participar.</p>
</td></tr>`);
  }

  const mentors = content.mentor_summary;
  if (mentors.total > 0) {
    // Só o agregado: nomes e perfis de mentoras são exclusivos para membras.
    const mentoriaUrl = absoluteUrl(ctx.siteUrl, "/mentoria");
    rows.push(sectionTitle("Novas mentoras na rede"));
    rows.push(`<tr><td class="cd-px" style="padding:10px 40px 4px;">
<p style="margin:0;font-family:${SANS};font-size:16px;line-height:24px;color:${C.text};"><strong>${escapeHtml(mentorSummaryHeadline(mentors.total))}</strong></p>
${mentors.areas.length ? `<p style="margin:6px 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.muted};">Áreas: ${escapeHtml(mentors.areas.join(" · "))}</p>` : ""}
<p style="margin:8px 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.muted};">Para conhecer as mentoras e pedir mentoria, <a href="${escapeHtml(mentoriaUrl)}" style="color:${C.primary};font-weight:700;">entre na sua conta e acesse a página Mentoria</a>.</p>
</td></tr>`);
  }

  rows.push(`<tr><td class="cd-px" style="padding:32px 40px 36px;">
${button(webUrl, "Ver a edição no site")}
</td></tr>`);

  const recipientLine = ctx.recipientEmail
    ? `Você recebe este e-mail porque inscreveu <strong>${escapeHtml(ctx.recipientEmail)}</strong> no ${NEWSLETTER_NAME} e confirmou a inscrição.`
    : `Você recebe este e-mail porque se inscreveu no ${NEWSLETTER_NAME} e confirmou a inscrição.`;
  rows.push(
    footerRow([
      recipientLine,
      `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${C.primary};font-weight:700;">Cancelar inscrição</a> &nbsp;·&nbsp; <a href="${escapeHtml(privacyUrl)}" style="color:${C.primary};">Política de privacidade</a> &nbsp;·&nbsp; <a href="${escapeHtml(webUrl)}" style="color:${C.primary};">Ver no navegador</a>`,
      BRAND_FOOTER,
    ]),
  );

  const html = layout({ title: edition.title, preheader, body: rows.join("\n") });

  // ---------------------------------------------------------------- texto
  const lines: string[] = [eyebrow.toUpperCase(), edition.title, ""];
  if (summary) lines.push(summary, "");
  lines.push(`Números da semana: ${statsLine(content)}`, "");
  if (content.papers.length) {
    lines.push("PAPERS EM DESTAQUE NA VITRINE", "");
    content.papers.forEach((paper, i) => {
      lines.push(`${i + 1}. ${paper.title}`);
      if (paper.authors.length) lines.push(`   ${formatAuthorsList(paper.authors)}`);
      lines.push(`   ${pluralize(paper.votes, "destaque")}${paper.area ? ` · ${paper.area}` : ""}`);
      if (paper.plain_summary)
        lines.push(`   Resumo acessível: ${truncate(paper.plain_summary, 280)}`);
      lines.push(`   ${absoluteUrl(ctx.siteUrl, paper.url)}`, "");
    });
  }
  if (content.threads.length) {
    lines.push("CONVERSAS NO FÓRUM (para membras)", "");
    for (const thread of content.threads) {
      lines.push(
        `- ${thread.title} (${[thread.category, pluralize(thread.replies, "resposta")].filter(Boolean).join(" · ")})`,
      );
      lines.push(`  ${absoluteUrl(ctx.siteUrl, thread.url)}`);
    }
    lines.push("");
  }
  if (mentors.total > 0) {
    lines.push("NOVAS MENTORAS NA REDE", "", mentorSummaryHeadline(mentors.total));
    if (mentors.areas.length) lines.push(`Áreas: ${mentors.areas.join(" · ")}`);
    lines.push(
      `Para conhecer as mentoras e pedir mentoria, entre na sua conta: ${absoluteUrl(ctx.siteUrl, "/mentoria")}`,
      "",
    );
  }
  lines.push(
    `Ver no site: ${webUrl}`,
    "",
    "—",
    ctx.recipientEmail
      ? `Você recebe este e-mail porque inscreveu ${ctx.recipientEmail} no ${NEWSLETTER_NAME}.`
      : `Você recebe este e-mail porque se inscreveu no ${NEWSLETTER_NAME}.`,
    `Cancelar inscrição: ${ctx.unsubscribeUrl}`,
    `Política de privacidade: ${privacyUrl}`,
  );

  return { subject: edition.title, preheader, html, text: lines.join("\n") };
}

export interface ConfirmationEmailContext {
  siteUrl: string;
  confirmUrl: string;
  /** Página para remover o endereço da lista (quem não pediu a inscrição). */
  removeUrl?: string;
}

/** E-mail do double opt-in. */
export function renderConfirmationEmail(ctx: ConfirmationEmailContext): RenderedEmail {
  const subject = `Confirme sua inscrição no ${NEWSLETTER_NAME}`;
  const preheader = "Falta só um clique para receber os destaques da semana da Artemis.";
  const privacyUrl = absoluteUrl(ctx.siteUrl, "/privacidade");
  const days = pluralize(CONFIRM_TOKEN_TTL_DAYS, "dia");

  const body = [
    headerRow(NEWSLETTER_NAME, "Falta só um passo", "Confirme que este e-mail é seu."),
    `<tr><td class="cd-px" style="padding:32px 40px 8px;">
<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.text};">Olá! Recebemos um pedido para enviar o <strong>${NEWSLETTER_NAME}</strong> — a newsletter semanal da Artemis, com papers de pesquisadoras, conversas da comunidade e novas mentoras — para este endereço.</p>
<p style="margin:0 0 24px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.text};">Para confirmar, é só clicar no botão:</p>
${button(ctx.confirmUrl, "Confirmar inscrição")}
<p style="margin:24px 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted};">O link vale por ${escapeHtml(days)}. Se você não pediu a inscrição, ignore este e-mail: sem a confirmação, não enviamos nada.${ctx.removeUrl ? ` Se preferir, <a href="${escapeHtml(ctx.removeUrl)}" style="color:${C.primary};">remova este endereço da nossa lista</a>.` : ""}</p>
<p style="margin:16px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.subtle};word-break:break-all;">Se o botão não funcionar, copie e cole no navegador:<br><a href="${escapeHtml(ctx.confirmUrl)}" style="color:${C.primary};">${escapeHtml(ctx.confirmUrl)}</a></p>
</td></tr>`,
    footerRow([
      `<a href="${escapeHtml(privacyUrl)}" style="color:${C.primary};">Como tratamos seus dados</a>`,
      BRAND_FOOTER,
    ]),
  ].join("\n");

  const text = [
    `${NEWSLETTER_NAME.toUpperCase()} — CONFIRME SUA INSCRIÇÃO`,
    "",
    `Olá! Recebemos um pedido para enviar o ${NEWSLETTER_NAME}, a newsletter semanal da Artemis, para este endereço.`,
    "",
    "Para confirmar, abra o link:",
    ctx.confirmUrl,
    "",
    `O link vale por ${days}. Se você não pediu a inscrição, ignore este e-mail: sem a confirmação, não enviamos nada.`,
    ...(ctx.removeUrl ? [`Para remover este endereço da nossa lista: ${ctx.removeUrl}`] : []),
    "",
    `Como tratamos seus dados: ${privacyUrl}`,
  ].join("\n");

  return { subject, preheader, html: layout({ title: subject, preheader, body }), text };
}
