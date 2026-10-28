import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_HEX, LOGO_PATHS, brandSvgFiles, logoSvg } from "./logo-geometry";

describe("geometria da marca", () => {
  it("os SVGs estáticos estão em dia com LOGO_PATHS (rode `npm run brand:svgs` se falhar)", () => {
    for (const [path, expected] of Object.entries(brandSvgFiles())) {
      expect(readFileSync(resolve(process.cwd(), path), "utf8"), path).toBe(expected);
    }
  });

  it("a estrela é sempre âmbar e a lua usa a cor pedida", () => {
    const svg = logoSvg({ line: "#123456" });
    expect(svg).toContain(`d="${LOGO_PATHS.moon}" fill="#123456" stroke="#123456"`);
    expect(svg).toContain(`d="${LOGO_PATHS.star}" fill="${BRAND_HEX.ambar400}"`);
  });

  it("o ícone quadrado centraliza o símbolo na escala definida", () => {
    const svg = logoSvg({ line: "#fff", tile: BRAND_HEX.violeta700 });
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain('transform="translate(5.28 5.28) scale(0.78)"');
    expect(svg).toContain(`fill="${BRAND_HEX.violeta700}"`);
  });
});
