/**
 * Geometria da marca Artemis — FONTE ÚNICA do símbolo.
 *
 * Usada por `<LogoMark />` (logo.tsx), pelo ícone iOS (app/apple-icon.tsx), pela imagem de
 * compartilhamento (app/opengraph-image.tsx) e pelos SVGs estáticos (app/icon.svg,
 * public/brand/logo-mark.svg, public/brand/logo-icon.svg), que são gerados a partir daqui com
 * `npm run brand:svgs` e conferidos por logo-geometry.test.ts.
 *
 * Grade 48×48, centrada em (24, 24):
 * - **lua crescente** (Ártemis, deusa grega da caça e da Lua): o círculo de centro (23,4; 24,8) e
 *   raio 17 menos um círculo de raio 15,5 deslocado 10 a −42°, aberta para cima e para a direita.
 *   Um contorno do mesmo tom, com junção redonda (`moonStrokeWidth`), arredonda as pontas — a
 *   mesma linguagem de pontas redondas das linhas do resto do sistema;
 * - **estrela âmbar** de quatro pontas na boca da lua: centro (34,9; 13), raio 8.
 *
 * Sem dependências (nem `@/`): o script de geração importa este arquivo direto no Node.
 */
export const LOGO_PATHS = {
  moon: "M39.16 31.18A17 17 0 1 1 18.7 8.46A15.5 15.5 0 0 0 39.16 31.18Z",
  moonStrokeWidth: 2.4,
  star: "M34.9 5Q37.8 10.1 42.9 13Q37.8 15.9 34.9 21Q32 15.9 26.9 13Q32 10.1 34.9 5Z",
} as const;

/** Recorte justo do símbolo (quadrado) dentro da grade 48×48. */
export const LOGO_VIEWBOX = "5 5 38 38";

/** Cores fixas da marca (as mesmas da paleta em globals.css), para arquivos fora do CSS. */
export const BRAND_HEX = {
  violeta700: "#6530ac",
  violeta300: "#cbaeff",
  violeta950: "#251046",
  ambar400: "#ffb24a",
  white: "#ffffff",
} as const;

/** Ícone quadrado (favicon/app): fundo violeta com cantos arredondados e o símbolo a 78%. */
export const LOGO_TILE = { radius: 11, scale: 0.78 } as const;

export interface LogoSvgOptions {
  /** Cor da lua. */
  line: string;
  /** Cor do fundo do ícone quadrado; omita para só o símbolo (fundo transparente). */
  tile?: string;
  /** Título acessível do arquivo. */
  title?: string;
  /** Largura e altura em px (o símbolo é quadrado). */
  size?: number;
}

/** Elementos do símbolo (lua + estrela) em SVG, na grade 48×48. */
function markElements(line: string): string {
  const { moon, moonStrokeWidth, star } = LOGO_PATHS;
  return (
    `<path d="${moon}" fill="${line}" stroke="${line}" stroke-width="${moonStrokeWidth}" stroke-linejoin="round"/>` +
    `<path d="${star}" fill="${BRAND_HEX.ambar400}"/>`
  );
}

/** Arquivo SVG completo do símbolo (ou do ícone quadrado, com `tile`). */
export function logoSvg({ line, tile, title, size }: LogoSvgOptions): string {
  const t = title ? `\n  <title>${title}</title>` : "";
  const dims = size ? ` width="${size}" height="${size}"` : "";
  if (tile) {
    const offset = Math.round(24 * (1 - LOGO_TILE.scale) * 100) / 100;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"${dims} fill="none">${t}\n` +
      `  <rect width="48" height="48" rx="${LOGO_TILE.radius}" fill="${tile}"/>\n` +
      `  <g transform="translate(${offset} ${offset}) scale(${LOGO_TILE.scale})">${markElements(line)}</g>\n` +
      `</svg>\n`
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}"${dims} fill="none">${t}\n` +
    `  ${markElements(line)}\n` +
    `</svg>\n`
  );
}

/** Arquivos estáticos gerados por `npm run brand:svgs` (caminho relativo à raiz do projeto → conteúdo). */
export function brandSvgFiles(): Record<string, string> {
  const title = "Artemis";
  return {
    "src/app/icon.svg": logoSvg({ line: BRAND_HEX.white, tile: BRAND_HEX.violeta700, title }),
    "public/brand/logo-icon.svg": logoSvg({ line: BRAND_HEX.white, tile: BRAND_HEX.violeta700, title, size: 512 }),
    "public/brand/logo-mark.svg": logoSvg({ line: BRAND_HEX.violeta700, title, size: 160 }),
    "public/brand/logo-mark-white.svg": logoSvg({ line: BRAND_HEX.white, title, size: 160 }),
  };
}
