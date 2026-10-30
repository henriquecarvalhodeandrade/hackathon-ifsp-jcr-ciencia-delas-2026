import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "@/components/layout/theme";
import { SITE } from "@/lib/constants";
import manifest from "./manifest";

/** Tamanho e tipo de cor de um PNG, lidos do cabeçalho (assinatura + bloco IHDR). */
function pngHeader(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).toString("hex"), file).toBe("89504e470d0a1a0a");
  expect(buf.subarray(12, 16).toString("ascii"), file).toBe("IHDR");
  // Tipo de cor do PNG: 2 = RGB (sem canal alfa), 6 = RGBA.
  return { size: `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`, colorType: buf[25] };
}

describe("manifesto do app (PWA)", () => {
  const m = manifest();
  const icons = m.icons ?? [];

  it("tem os campos que o navegador usa para instalar", () => {
    expect(m).toMatchObject({
      id: "/",
      name: "Artemis",
      short_name: "Artemis",
      description: SITE.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "pt-BR",
    });
    expect(m.background_color).toBe(THEME_COLORS.light);
    expect(m.theme_color).toBe(THEME_COLORS.light);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("tem ícones comuns de 192 e 512 px e um maskable de 512 px", () => {
    const has = (sizes: string, purpose: string) =>
      icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });

  it("cada ícone existe em public/ como PNG do tamanho declarado (se falhar: npm run brand:pwa)", () => {
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png$/);
      const { size, colorType } = pngHeader(resolve(process.cwd(), "public", icon.src.slice(1)));
      expect(size, icon.src).toBe(icon.sizes);
      // O maskable é recortado pelo sistema (círculo, gota...): precisa ser opaco até a borda,
      // senão sobra fundo transparente (preto ou branco) dentro da máscara.
      if (icon.purpose === "maskable") expect(colorType, `${icon.src} sem transparência`).toBe(2);
    }
  });
});
