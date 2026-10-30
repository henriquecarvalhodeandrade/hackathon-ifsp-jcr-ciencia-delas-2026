/**
 * Gera os ícones PNG do app instalável (PWA) a partir da geometria única da marca
 * (src/components/ui/logo-geometry.ts), renderizando o SVG no Chromium do Playwright:
 *
 * - public/icons/icon-192.png e icon-512.png (purpose "any"): o mesmo ícone quadrado do favicon —
 *   fundo violeta com cantos arredondados, lua branca e estrela âmbar; transparente fora do quadrado;
 * - public/icons/icon-maskable-512.png (purpose "maskable"): fundo violeta até a borda (o Android
 *   recorta em círculo, gota ou quadrado arredondado) e o símbolo menor, com folga dentro da zona
 *   segura (círculo central de raio 40% do lado, especificação W3C de ícones maskable).
 *
 * Uso (na raiz do projeto): npm run brand:pwa
 * Precisa do Playwright com Chromium (global ou no projeto:
 * `npm i -D playwright && npx playwright install chromium`).
 * Rode de novo sempre que LOGO_PATHS mudar; o manifesto (src/app/manifest.ts) aponta para estes arquivos.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_HEX, LOGO_PATHS, logoSvg } from "../../src/components/ui/logo-geometry.ts";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "public", "icons");

/**
 * Escala do símbolo no ícone maskable (grade 48×48, centro em 24,24). Com 0,64 as pontas da
 * estrela (os pontos mais distantes do centro) ficam a ~29% do lado, com respiro dentro da zona
 * segura. O script confere isso nos pixels do PNG gerado e falha se algo sair do círculo.
 */
const MASKABLE_SCALE = 0.64;
/** Raio da zona segura de ícones maskable, em fração do lado (W3C: círculo de 80% de diâmetro). */
const SAFE_ZONE_RADIUS = 0.4;

/** Ícone maskable: quadrado violeta sem cantos arredondados, símbolo centrado e reduzido. */
function maskableSvg(size) {
  const offset = Math.round(24 * (1 - MASKABLE_SCALE) * 100) / 100;
  const { moon, moonStrokeWidth, star } = LOGO_PATHS;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" fill="none">` +
    `<rect width="48" height="48" fill="${BRAND_HEX.violeta700}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${MASKABLE_SCALE})">` +
    `<path d="${moon}" fill="${BRAND_HEX.white}" stroke="${BRAND_HEX.white}" stroke-width="${moonStrokeWidth}" stroke-linejoin="round"/>` +
    `<path d="${star}" fill="${BRAND_HEX.ambar400}"/>` +
    `</g></svg>`
  );
}

const tile = (size) => logoSvg({ line: BRAND_HEX.white, tile: BRAND_HEX.violeta700, size });

const ICONS = [
  { file: "icon-192.png", size: 192, svg: tile(192) },
  { file: "icon-512.png", size: 512, svg: tile(512) },
  { file: "icon-maskable-512.png", size: 512, svg: maskableSvg(512), maskable: true },
];

/**
 * Maior distância do centro (em fração do lado) de um pixel que não é o fundo violeta, lida do
 * PNG renderizado. Para o ícone maskable precisa ficar dentro de SAFE_ZONE_RADIUS.
 */
async function markRadius(page, png, size) {
  return page.evaluate(
    async ({ base64, size, bg }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, size, size);
      const center = size / 2;
      let max = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const isBg = [0, 1, 2].every((c) => Math.abs(data[i + c] - bg[c]) <= 2);
          if (!isBg) max = Math.max(max, Math.hypot(x + 0.5 - center, y + 0.5 - center));
        }
      }
      return max / size;
    },
    {
      base64: png.toString("base64"),
      size,
      bg: [1, 3, 5].map((i) => parseInt(BRAND_HEX.violeta700.slice(i, i + 2), 16)),
    },
  );
}

function loadPlaywright() {
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      return require(name);
    } catch {
      // tenta o próximo
    }
  }
  console.error(
    "Playwright não encontrado. Instale com `npm i -D playwright && npx playwright install chromium`.",
  );
  process.exit(2);
}

const { chromium } = loadPlaywright();
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, svg, maskable } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    let note = "";
    if (maskable) {
      const radius = await markRadius(page, png, size);
      if (radius > SAFE_ZONE_RADIUS) {
        throw new Error(
          `${file}: o símbolo vai até ${Math.round(radius * 100)}% do centro e sai da zona segura ` +
            `(${SAFE_ZONE_RADIUS * 100}%). Reduza MASKABLE_SCALE.`,
        );
      }
      note = `; símbolo até ${Math.round(radius * 100)}% do centro, zona segura ${SAFE_ZONE_RADIUS * 100}%`;
    }
    writeFileSync(path.join(OUT_DIR, file), png);
    console.log(`gerado: public/icons/${file} (${size}×${size}${note})`);
  }
} finally {
  await browser.close();
}
