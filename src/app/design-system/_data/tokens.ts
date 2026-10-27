/**
 * Espelho dos tokens de src/app/globals.css usado pelo guia vivo (/design-system).
 * O componente <TokenDriftCheck> compara estes valores com o CSS real no navegador
 * e acusa qualquer divergência — então mantenha os dois em sincronia.
 */

export const SCALE_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

export const PALETTE = {
  violeta: {
    "50": "#f8f3ff",
    "100": "#efe6ff",
    "200": "#e0d0ff",
    "300": "#cbaeff",
    "400": "#ae83f5",
    "500": "#935be4",
    "600": "#7b40cc",
    "700": "#6530ac",
    "800": "#4f278a",
    "900": "#3a1c68",
    "950": "#251046",
  },
  verde: {
    "50": "#edfbef",
    "100": "#d9f6dd",
    "200": "#b8eebf",
    "300": "#8ce098",
    "400": "#5bc96c",
    "500": "#32a041",
    "600": "#258632",
    "700": "#1e6b25",
    "800": "#1b541c",
    "900": "#164014",
    "950": "#0c270a",
  },
  ambar: {
    "50": "#fff9f0",
    "100": "#fff0db",
    "200": "#ffe1b8",
    "300": "#ffcc88",
    "400": "#ffb24a",
    "500": "#f39a04",
    "600": "#cf7f00",
    "700": "#a46100",
    "800": "#844a00",
    "900": "#6a3a06",
    "950": "#432204",
  },
  carmim: {
    "50": "#fff1f2",
    "100": "#ffe3e5",
    "200": "#ffc9cc",
    "300": "#ffa4aa",
    "400": "#f6707f",
    "500": "#e5405c",
    "600": "#ca2145",
    "700": "#aa1336",
    "800": "#87112a",
    "900": "#681020",
    "950": "#440711",
  },
  azul: {
    "50": "#eff7ff",
    "100": "#deedff",
    "200": "#bfdcff",
    "300": "#95c5ff",
    "400": "#62a6f8",
    "500": "#3586e6",
    "600": "#206dc9",
    "700": "#1858a5",
    "800": "#164582",
    "900": "#133563",
    "950": "#0c2140",
  },
  tinta: {
    "25": "#fcfbfe",
    "50": "#f6f5fa",
    "100": "#eeebf3",
    "200": "#dfdce6",
    "300": "#c9c5d2",
    "400": "#8e8998",
    "500": "#75707e",
    "600": "#625e6b",
    "700": "#4c4855",
    "800": "#37333e",
    "900": "#26232d",
    "950": "#1a1820",
    "975": "#110f16",
  },
} as const;

export type PaletteFamily = keyof typeof PALETTE;

export const FAMILY_INFO: Record<PaletteFamily, { name: string; role: string; story: string }> = {
  violeta: {
    name: "Violeta",
    role: "Primária — ações principais, links, foco",
    story: "Cor da dignidade no movimento sufragista (WSPU, Reino Unido, 1908).",
  },
  verde: {
    name: "Verde",
    role: "Secundária — sucesso, crescimento, mentoria aceita",
    story: "Esperança das sufragistas e verde institucional dos Institutos Federais (500 = #32A041).",
  },
  ambar: {
    name: "Âmbar",
    role: "Destaque — estrelas, votos (destaques), conquistas",
    story: "A luz das estrelas. Usado com parcimônia para chamar o olhar.",
  },
  carmim: {
    name: "Carmim",
    role: "Perigo — erros, exclusões, denúncias",
    story: "Vermelho com um toque de rosa, firme sem ser agressivo.",
  },
  azul: {
    name: "Azul",
    role: "Informação — avisos neutros e dicas",
    story: "Azul limpo, distante o bastante do violeta para não confundir.",
  },
  tinta: {
    name: "Tinta",
    role: "Neutros — texto, superfícies, bordas",
    story: "Cinzas levemente violeta: papel claro (25) e céu noturno (975).",
  },
};

type Ref = `${PaletteFamily}-${string}` | "white";

/** Token semântico → [claro, escuro] (referências à paleta). */
export const SEMANTIC: Record<string, { light: Ref; dark: Ref; usage: string }> = {
  bg: { light: "tinta-25", dark: "tinta-975", usage: "Fundo da página" },
  surface: { light: "white", dark: "tinta-950", usage: "Cartões, menus, diálogos" },
  "surface-2": { light: "tinta-50", dark: "tinta-900", usage: "Áreas sutis, hover, código" },
  fg: { light: "tinta-950", dark: "tinta-50", usage: "Texto principal" },
  "fg-muted": { light: "tinta-700", dark: "tinta-300", usage: "Texto secundário" },
  "fg-subtle": { light: "tinta-600", dark: "tinta-400", usage: "Metadados, placeholders" },
  border: { light: "tinta-200", dark: "tinta-800", usage: "Divisórias e contornos decorativos" },
  "border-strong": { light: "tinta-400", dark: "tinta-500", usage: "Bordas de campos (≥ 3:1)" },
  primary: { light: "violeta-700", dark: "violeta-300", usage: "Botão primário, links, ativo" },
  "primary-hover": { light: "violeta-800", dark: "violeta-200", usage: "Hover do primário" },
  "primary-fg": { light: "white", dark: "violeta-950", usage: "Texto sobre primário" },
  "primary-soft": { light: "violeta-100", dark: "violeta-900", usage: "Fundo suave violeta" },
  "primary-soft-fg": { light: "violeta-800", dark: "violeta-100", usage: "Texto sobre fundo suave" },
  secondary: { light: "verde-700", dark: "verde-400", usage: "Botão secundário" },
  "secondary-hover": { light: "verde-800", dark: "verde-300", usage: "Hover do secundário" },
  "secondary-fg": { light: "white", dark: "verde-950", usage: "Texto sobre secundário" },
  "secondary-soft": { light: "verde-100", dark: "verde-900", usage: "Fundo suave verde" },
  "secondary-soft-fg": { light: "verde-800", dark: "verde-100", usage: "Texto sobre verde suave" },
  accent: { light: "ambar-400", dark: "ambar-400", usage: "Estrelas, botão de destaque" },
  "accent-hover": { light: "ambar-300", dark: "ambar-300", usage: "Hover do destaque" },
  "accent-fg": { light: "ambar-950", dark: "ambar-950", usage: "Texto sobre âmbar" },
  "accent-soft": { light: "ambar-100", dark: "ambar-900", usage: "Fundo suave âmbar" },
  "accent-soft-fg": { light: "ambar-900", dark: "ambar-100", usage: "Texto sobre âmbar suave" },
  "accent-strong": { light: "ambar-700", dark: "ambar-400", usage: "Ícone de estrela sobre superfícies" },
  success: { light: "verde-700", dark: "verde-400", usage: "Texto/ícone de sucesso" },
  "success-fg": { light: "white", dark: "verde-950", usage: "Texto sobre sucesso sólido" },
  "success-soft": { light: "verde-50", dark: "verde-950", usage: "Fundo de alerta de sucesso" },
  "success-soft-fg": { light: "verde-800", dark: "verde-200", usage: "Texto do alerta de sucesso" },
  warning: { light: "ambar-800", dark: "ambar-400", usage: "Texto/ícone de atenção" },
  "warning-fg": { light: "white", dark: "ambar-950", usage: "Texto sobre atenção sólida" },
  "warning-soft": { light: "ambar-50", dark: "ambar-950", usage: "Fundo de alerta de atenção" },
  "warning-soft-fg": { light: "ambar-900", dark: "ambar-200", usage: "Texto do alerta de atenção" },
  danger: { light: "carmim-700", dark: "carmim-400", usage: "Erros, ações destrutivas" },
  "danger-hover": { light: "carmim-800", dark: "carmim-300", usage: "Hover do perigo" },
  "danger-fg": { light: "white", dark: "carmim-950", usage: "Texto sobre perigo" },
  "danger-soft": { light: "carmim-50", dark: "carmim-950", usage: "Fundo de alerta de erro" },
  "danger-soft-fg": { light: "carmim-800", dark: "carmim-200", usage: "Texto do alerta de erro" },
  info: { light: "azul-700", dark: "azul-300", usage: "Texto/ícone informativo" },
  "info-fg": { light: "white", dark: "azul-950", usage: "Texto sobre informação sólida" },
  "info-soft": { light: "azul-50", dark: "azul-950", usage: "Fundo de alerta informativo" },
  "info-soft-fg": { light: "azul-800", dark: "azul-200", usage: "Texto do alerta informativo" },
  focus: { light: "violeta-600", dark: "violeta-300", usage: "Anel de foco (outline)" },
};

export function resolveRef(ref: Ref): string {
  if (ref === "white") return "#ffffff";
  const [family, step] = ref.split("-") as [PaletteFamily, string];
  const value = (PALETTE[family] as Record<string, string>)[step];
  if (!value) throw new Error(`Token inválido: ${ref}`);
  return value;
}

export function semanticValue(token: string, theme: "light" | "dark"): string {
  const entry = SEMANTIC[token];
  if (!entry) throw new Error(`Token semântico inexistente: ${token}`);
  return resolveRef(theme === "light" ? entry.light : entry.dark);
}

/** Pares texto/fundo realmente usados pelos componentes, com o mínimo WCAG exigido. */
export const CONTRAST_PAIRS: ReadonlyArray<{ fg: string; bg: string; min: 3 | 4.5; use: string }> = [
  { fg: "fg", bg: "bg", min: 4.5, use: "Texto principal no fundo" },
  { fg: "fg", bg: "surface", min: 4.5, use: "Texto principal em cartões" },
  { fg: "fg", bg: "surface-2", min: 4.5, use: "Texto em áreas sutis" },
  { fg: "fg-muted", bg: "bg", min: 4.5, use: "Texto secundário no fundo" },
  { fg: "fg-muted", bg: "surface", min: 4.5, use: "Texto secundário em cartões" },
  { fg: "fg-muted", bg: "surface-2", min: 4.5, use: "Texto secundário em áreas sutis" },
  { fg: "fg-subtle", bg: "bg", min: 4.5, use: "Metadados no fundo" },
  { fg: "fg-subtle", bg: "surface", min: 4.5, use: "Metadados e placeholders" },
  { fg: "fg-subtle", bg: "surface-2", min: 4.5, use: "Metadados em áreas sutis" },
  { fg: "border-strong", bg: "surface", min: 3, use: "Borda de campos (componente de UI)" },
  { fg: "border-strong", bg: "bg", min: 3, use: "Borda de campos no fundo" },
  { fg: "primary", bg: "bg", min: 4.5, use: "Links no fundo" },
  { fg: "primary", bg: "surface", min: 4.5, use: "Links em cartões" },
  { fg: "primary", bg: "surface-2", min: 4.5, use: "Links em áreas sutis" },
  { fg: "primary-fg", bg: "primary", min: 4.5, use: "Botão primário" },
  { fg: "primary-fg", bg: "primary-hover", min: 4.5, use: "Botão primário (hover)" },
  { fg: "primary-soft-fg", bg: "primary-soft", min: 4.5, use: "Badge e chip violeta" },
  { fg: "secondary", bg: "surface", min: 4.5, use: "Texto verde em cartões" },
  { fg: "secondary-fg", bg: "secondary", min: 4.5, use: "Botão secundário" },
  { fg: "secondary-fg", bg: "secondary-hover", min: 4.5, use: "Botão secundário (hover)" },
  { fg: "secondary-soft-fg", bg: "secondary-soft", min: 4.5, use: "Badge verde" },
  { fg: "accent-fg", bg: "accent", min: 4.5, use: "Botão de destaque (âmbar)" },
  { fg: "accent-fg", bg: "accent-hover", min: 4.5, use: "Botão de destaque (hover)" },
  { fg: "accent-soft-fg", bg: "accent-soft", min: 4.5, use: "Badge âmbar" },
  { fg: "accent-strong", bg: "surface", min: 3, use: "Ícone de estrela em cartões" },
  { fg: "accent-strong", bg: "bg", min: 3, use: "Ícone de estrela no fundo" },
  { fg: "success", bg: "surface", min: 4.5, use: "Texto de sucesso" },
  { fg: "success-fg", bg: "success", min: 4.5, use: "Sucesso sólido" },
  { fg: "success-soft-fg", bg: "success-soft", min: 4.5, use: "Alerta de sucesso" },
  { fg: "warning", bg: "surface", min: 4.5, use: "Texto de atenção" },
  { fg: "warning-fg", bg: "warning", min: 4.5, use: "Atenção sólida" },
  { fg: "warning-soft-fg", bg: "warning-soft", min: 4.5, use: "Alerta de atenção" },
  { fg: "danger", bg: "surface", min: 4.5, use: "Mensagem de erro em cartões" },
  { fg: "danger", bg: "bg", min: 4.5, use: "Mensagem de erro no fundo" },
  { fg: "danger-fg", bg: "danger", min: 4.5, use: "Botão de perigo" },
  { fg: "danger-fg", bg: "danger-hover", min: 4.5, use: "Botão de perigo (hover)" },
  { fg: "danger-soft-fg", bg: "danger-soft", min: 4.5, use: "Alerta de erro" },
  { fg: "info", bg: "surface", min: 4.5, use: "Texto informativo" },
  { fg: "info-fg", bg: "info", min: 4.5, use: "Informação sólida" },
  { fg: "info-soft-fg", bg: "info-soft", min: 4.5, use: "Alerta informativo" },
  { fg: "focus", bg: "bg", min: 3, use: "Anel de foco no fundo" },
  { fg: "focus", bg: "surface", min: 3, use: "Anel de foco em cartões" },
];

/* ------------------------------------------------------------------ */
/* Contraste WCAG 2.x                                                  */
/* ------------------------------------------------------------------ */

function channel(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastResult {
  fg: string;
  bg: string;
  min: number;
  use: string;
  light: number;
  dark: number;
}

export function computeContrastTable(): ContrastResult[] {
  return CONTRAST_PAIRS.map((pair) => ({
    ...pair,
    light: contrastRatio(semanticValue(pair.fg, "light"), semanticValue(pair.bg, "light")),
    dark: contrastRatio(semanticValue(pair.fg, "dark"), semanticValue(pair.bg, "dark")),
  }));
}
