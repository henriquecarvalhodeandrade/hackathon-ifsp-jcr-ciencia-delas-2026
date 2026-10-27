"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/utils";
import { CONTRAST_PAIRS, PALETTE, SEMANTIC, contrastRatio, semanticValue } from "../_data/tokens";

type Result = {
  checked: number;
  mismatches: string[];
  pairs: number;
  failing: string[];
};

/** "#fc8" → "#ffcc88" (o CSS minificado pode encurtar hex). */
function expandHex(value: string): string {
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(v) ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
}

function rgbToHex(value: string): string | null {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Confere, no navegador, se o CSS real (globals.css) bate com o espelho em _data/tokens.ts
 * e recalcula o contraste a partir das cores que o navegador resolveu nos dois temas.
 */
export function TokenDriftCheck() {
  const lightRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const mismatches: string[] = [];
    let checked = 0;

    for (const [family, steps] of Object.entries(PALETTE)) {
      for (const [step, expected] of Object.entries(steps)) {
        checked++;
        const actual = expandHex(root.getPropertyValue(`--color-${family}-${step}`));
        if (actual !== expected) mismatches.push(`--color-${family}-${step}: CSS ${actual || "(vazio)"} ≠ ${expected}`);
      }
    }

    const resolved: Record<"light" | "dark", Record<string, string>> = { light: {}, dark: {} };
    for (const theme of ["light", "dark"] as const) {
      const island = theme === "light" ? lightRef.current : darkRef.current;
      if (!island) continue;
      for (const token of Object.keys(SEMANTIC)) {
        checked++;
        const probe = document.createElement("span");
        probe.style.color = `var(--color-${token})`;
        island.appendChild(probe);
        const actual = rgbToHex(getComputedStyle(probe).color);
        island.removeChild(probe);
        const expected = semanticValue(token, theme);
        if (actual) resolved[theme][token] = actual;
        if (actual !== expected) mismatches.push(`${token} (${theme === "light" ? "claro" : "escuro"}): CSS ${actual} ≠ ${expected}`);
      }
    }

    const failing: string[] = [];
    for (const pair of CONTRAST_PAIRS) {
      for (const theme of ["light", "dark"] as const) {
        const fg = resolved[theme][pair.fg];
        const bg = resolved[theme][pair.bg];
        if (!fg || !bg) continue;
        const ratio = contrastRatio(fg, bg);
        if (ratio < pair.min) failing.push(`${pair.fg}/${pair.bg} (${theme}): ${ratio.toFixed(2)}`);
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do DOM após montar
    setResult({ checked, mismatches, pairs: CONTRAST_PAIRS.length * 2, failing });
  }, []);

  const ok = result && result.mismatches.length === 0 && result.failing.length === 0;

  return (
    <div
      data-testid="token-drift-check"
      data-drift-count={result ? result.mismatches.length : undefined}
      data-contrast-failures={result ? result.failing.length : undefined}
    >
      <div ref={lightRef} data-theme="light" aria-hidden="true" className="pointer-events-none absolute size-0 overflow-hidden opacity-0" />
      <div ref={darkRef} data-theme="dark" aria-hidden="true" className="pointer-events-none absolute size-0 overflow-hidden opacity-0" />
      {!result ? (
        <Alert variant="info" title="Conferindo tokens no navegador…" />
      ) : ok ? (
        <Alert variant="success" title="Verificado ao vivo no seu navegador">
          {formatNumber(result.checked)} tokens do CSS batem com a documentação e os {formatNumber(result.pairs)}{" "}
          pares de contraste (claro + escuro) passam no WCAG AA com as cores realmente renderizadas.
        </Alert>
      ) : (
        <Alert variant="danger" title="Divergência entre o CSS e a documentação">
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {[...result.mismatches, ...result.failing].slice(0, 12).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
