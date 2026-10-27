import { Check, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  FAMILY_INFO,
  PALETTE,
  SEMANTIC,
  computeContrastTable,
  semanticValue,
  type PaletteFamily,
} from "../_data/tokens";
import { DsSection, DsSubheading } from "./ds";
import { TokenDriftCheck } from "./token-drift-check";

/*
 * O rótulo fica FORA da cor: nos tons médios (500–700) nem preto nem branco alcançam 4,5:1
 * em texto de 11px, então o texto usa os tokens fg/fg-subtle sobre a superfície.
 */
function Swatch({ family, step, hex }: { family: string; step: string; hex: string }) {
  return (
    <li className="grid gap-1" title={`--color-${family}-${step}: ${hex}`}>
      <span
        aria-hidden="true"
        className="block h-10 rounded-control ring-1 ring-fg/10 ring-inset sm:h-12"
        style={{ backgroundColor: hex }}
      />
      <span className="grid text-[0.6875rem] leading-tight">
        <span className="font-semibold text-fg">{step}</span>
        <span className="font-mono text-fg-subtle uppercase">{hex.slice(1)}</span>
      </span>
    </li>
  );
}

function PaletteScale({ family }: { family: PaletteFamily }) {
  const info = FAMILY_INFO[family];
  const steps = Object.entries(PALETTE[family]);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="font-display text-lg font-semibold text-fg">
          {info.name} <span className="font-mono text-sm font-normal text-fg-subtle">{family}-*</span>
        </h4>
        <p className="text-sm text-fg-muted">{info.role}</p>
      </div>
      <ul
        className={cn(
          "grid grid-cols-4 gap-1.5 sm:grid-cols-6",
          steps.length > 11 ? "lg:grid-cols-13" : "lg:grid-cols-11",
        )}
        aria-label={`Escala ${info.name}`}
      >
        {steps.map(([step, hex]) => (
          <Swatch key={step} family={family} step={step} hex={hex} />
        ))}
      </ul>
      <p className="text-sm text-fg-subtle">{info.story}</p>
    </div>
  );
}

function Ratio({ value, min }: { value: number; min: number }) {
  const ok = value >= min;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular font-mono text-sm font-semibold text-fg">
        {formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-badge px-1.5 py-0.5 text-[0.6875rem] font-bold",
          ok ? "bg-success-soft text-success-soft-fg" : "bg-danger-soft text-danger-soft-fg",
        )}
      >
        {ok ? <Check aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}
        {ok ? (min >= 4.5 && value >= 7 ? "AAA" : "AA") : "falha"}
      </span>
    </span>
  );
}

/**
 * Amostra do par. Pares de 4,5:1 são de texto → "Aa". Pares de 3:1 são de elementos gráficos
 * (bordas, ícones, anel de foco) → mostramos um contorno e um ponto, não texto: texto nessa
 * cor não seria legível e não é assim que o token é usado.
 */
function PairPreview({ fg, bg, theme, min }: { fg: string; bg: string; theme: "light" | "dark"; min: number }) {
  const fgHex = semanticValue(fg, theme);
  const bgHex = semanticValue(bg, theme);
  if (min < 4.5) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-12 items-center justify-center rounded-badge ring-1 ring-border ring-inset"
        style={{ backgroundColor: bgHex }}
      >
        <span className="flex size-5 items-center justify-center rounded-[0.3125rem] border-2" style={{ borderColor: fgHex }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: fgHex }} />
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-8 w-12 items-center justify-center rounded-badge font-display text-sm font-bold ring-1 ring-border ring-inset"
      style={{ backgroundColor: bgHex, color: fgHex }}
    >
      Aa
    </span>
  );
}

export function Colors() {
  const table = computeContrastTable();
  const failures = table.filter((r) => r.light < r.min || r.dark < r.min).length;

  return (
    <DsSection
      id="cores"
      number="03"
      group="Fundamentos"
      title="Cores"
      description={
        <>
          Paletas geradas em OKLCH (degraus perceptualmente regulares) e tokens semânticos por cima. Nos
          componentes, use <strong className="text-fg">sempre os tokens semânticos</strong> — eles trocam sozinhos
          entre claro e escuro.
        </>
      }
    >
      <DsSubheading description="Escalas 50–950. A paleta padrão do Tailwind foi removida: só existem estas cores.">
        Paleta
      </DsSubheading>
      <div className="grid gap-8">
        {(Object.keys(PALETTE) as PaletteFamily[]).map((family) => (
          <PaletteScale key={family} family={family} />
        ))}
      </div>

      <DsSubheading
        id="tokens-semanticos"
        description="Cada token vira utilitário do Tailwind: bg-surface, text-fg-muted, border-border-strong, bg-primary text-primary-fg…"
      >
        Tokens semânticos
      </DsSubheading>
      {/* Celular: lista */}
      <ul className="grid gap-2 md:hidden">
        {Object.entries(SEMANTIC).map(([token, entry]) => (
          <li key={token} className="grid gap-2 rounded-control border border-border bg-surface p-3">
            <p className="font-mono text-[0.8125rem] font-semibold text-fg">--color-{token}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {(["light", "dark"] as const).map((theme) => (
                <span key={theme} className="inline-flex items-center gap-2 text-[0.8125rem] text-fg-muted">
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-badge ring-1 ring-border-strong/40 ring-inset"
                    style={{ backgroundColor: semanticValue(token, theme) }}
                  />
                  {theme === "light" ? "claro" : "escuro"}: <span className="font-mono">{theme === "light" ? entry.light : entry.dark}</span>
                </span>
              ))}
            </div>
            <p className="text-sm text-fg-muted">{entry.usage}</p>
          </li>
        ))}
      </ul>
      {/* Telas médias+: tabela */}
      <div
        className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block"
        role="region"
        aria-label="Tabela de tokens semânticos"
        tabIndex={0}
      >
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface-2 text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Token</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Claro</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Escuro</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(SEMANTIC).map(([token, entry]) => (
              <tr key={token}>
                <th scope="row" className="px-4 py-2 font-mono text-[0.8125rem] font-semibold text-fg">
                  --color-{token}
                </th>
                {(["light", "dark"] as const).map((theme) => (
                  <td key={theme} className="px-4 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-5 rounded-badge ring-1 ring-border-strong/40 ring-inset"
                        style={{ backgroundColor: semanticValue(token, theme) }}
                      />
                      <span className="font-mono text-[0.8125rem] text-fg-muted">
                        {theme === "light" ? entry.light : entry.dark}
                      </span>
                    </span>
                  </td>
                ))}
                <td className="px-4 py-2 text-fg-muted">{entry.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DsSubheading
        id="contraste"
        description={
          <>
            Todos os pares texto/fundo que os componentes usam, nos dois temas. Mínimo WCAG 2.2 AA: 4,5:1 para
            texto e 3:1 para bordas, ícones e anel de foco. Resultado:{" "}
            <strong className={failures === 0 ? "text-success" : "text-danger"}>
              {failures === 0 ? `${table.length} de ${table.length} pares passam nos dois temas` : `${failures} pares falhando`}
            </strong>
            .
          </>
        }
      >
        Contraste
      </DsSubheading>
      <div className="mb-4">
        <TokenDriftCheck />
      </div>
      {/* Celular: lista */}
      <ul className="grid gap-2 md:hidden">
        {table.map((row) => (
          <li key={`${row.fg}-${row.bg}`} className="grid gap-2.5 rounded-control border border-border bg-surface p-3">
            <div className="grid gap-0.5">
              <p className="font-mono text-[0.8125rem] font-semibold text-fg">
                {row.fg} / {row.bg}
              </p>
              <p className="text-sm text-fg-muted">
                {row.use} · mín. {String(row.min).replace(".", ",")}:1
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(["light", "dark"] as const).map((theme) => (
                <span key={theme} className="inline-flex items-center gap-2">
                  <PairPreview fg={row.fg} bg={row.bg} theme={theme} min={row.min} />
                  <span className="sr-only">{theme === "light" ? "Claro" : "Escuro"}:</span>
                  <Ratio value={theme === "light" ? row.light : row.dark} min={row.min} />
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {/* Telas médias+: tabela */}
      <div
        className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block"
        role="region"
        aria-label="Tabela de contraste"
        tabIndex={0}
      >
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-surface-2 text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Par (texto / fundo)</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Uso</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Mín.</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Claro</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Escuro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.map((row) => (
              <tr key={`${row.fg}-${row.bg}`}>
                <th scope="row" className="px-4 py-2 font-mono text-[0.8125rem] font-semibold whitespace-nowrap text-fg">
                  {row.fg} / {row.bg}
                </th>
                <td className="min-w-[11rem] px-4 py-2 text-fg-muted">{row.use}</td>
                <td className="tabular px-4 py-2 font-mono text-[0.8125rem] text-fg-muted">{String(row.min).replace(".", ",")}:1</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2.5">
                    <PairPreview fg={row.fg} bg={row.bg} theme="light" min={row.min} />
                    <Ratio value={row.light} min={row.min} />
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2.5">
                    <PairPreview fg={row.fg} bg={row.bg} theme="dark" min={row.min} />
                    <Ratio value={row.dark} min={row.min} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DsSection>
  );
}
