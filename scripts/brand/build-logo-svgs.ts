/**
 * Gera os SVGs estáticos da marca Artemis a partir da geometria única
 * (src/components/ui/logo-geometry.ts): app/icon.svg (favicon) e public/brand/*.svg.
 *
 * Uso (na raiz do projeto): npm run brand:svgs
 * Depois de mudar LOGO_PATHS, rode de novo — o teste logo-geometry.test.ts falha se os
 * arquivos estiverem desatualizados.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brandSvgFiles } from "../../src/components/ui/logo-geometry";

for (const [path, content] of Object.entries(brandSvgFiles())) {
  writeFileSync(resolve(process.cwd(), path), content);
  console.log(`gerado: ${path}`);
}
