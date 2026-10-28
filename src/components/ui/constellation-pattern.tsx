import { cn } from "@/lib/utils";

/** Gerador pseudoaleatório determinístico (mesmo desenho no servidor e no cliente). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = readonly [number, number];

const W = 800;
const H = 400;

/** Cruzeiro do Sul (está na bandeira do Brasil): Gacrux, Acrux, Mimosa, Delta e Epsilon Crucis. */
const CRUZEIRO: Pt[] = [
  [150, 58],
  [158, 190],
  [92, 118],
  [214, 104],
  [176, 146],
];
/** Caminho de mentoria: estrelas que sobem até uma estrela-guia âmbar. */
const MENTORIA: Pt[] = [
  [520, 330],
  [572, 286],
  [618, 300],
  [664, 236],
  [722, 178],
];
/** Pequeno aglomerado — colaboração. */
const REDE: Pt[] = [
  [372, 92],
  [430, 64],
  [468, 120],
  [410, 150],
];

function field(count: number, seed: number) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: Math.round(rand() * W),
    y: Math.round(rand() * H),
    r: Number((0.8 + rand() * 1.3).toFixed(2)),
    o: Number((0.25 + rand() * 0.45).toFixed(2)),
    twinkle: rand() > 0.82,
    delay: Number((rand() * 4).toFixed(2)),
  }));
}

const FIELDS = { low: field(26, 7), medium: field(54, 7), high: field(90, 7) } as const;

export interface ConstellationPatternProps extends React.ComponentProps<"svg"> {
  /** Quantidade de estrelas de fundo. */
  density?: keyof typeof FIELDS;
  /** Desenha as órbitas (anéis tracejados). */
  orbits?: boolean;
  /** Estrelas piscando suavemente (desligado automaticamente com prefers-reduced-motion). */
  animated?: boolean;
  /** Estrelas-guia em âmbar (desligue quando houver outro destaque âmbar por perto, ex.: o logo). */
  accents?: boolean;
  /**
   * Qual parte do desenho fica visível quando o container é mais estreito que o desenho:
   * "center" (padrão) ou "end" (lado direito — deixa a esquerda livre para texto).
   */
  align?: "center" | "end";
}

/**
 * Padrão decorativo de constelação: estrelas, linhas finas e órbitas. Sempre aria-hidden.
 * Usa currentColor (controle com text-primary/20 etc.); as estrelas-guia usam o âmbar.
 * Posicione com `absolute inset-0 size-full` dentro de um container `relative overflow-hidden`.
 */
export function ConstellationPattern({
  density = "medium",
  orbits = true,
  animated = true,
  accents = true,
  align = "center",
  className,
  ...props
}: ConstellationPatternProps) {
  const line = (pts: Pt[], closed = false) =>
    `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")}${closed ? " Z" : ""}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={align === "end" ? "xMaxYMid slice" : "xMidYMid slice"}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
      {...props}
    >
      {orbits && (
        <g
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 7"
          strokeLinecap="round"
          opacity="0.45"
        >
          <ellipse cx="660" cy="150" rx="150" ry="52" transform="rotate(-16 660 150)" />
          <ellipse cx="160" cy="124" rx="118" ry="118" opacity="0.6" />
          <circle cx="722" cy="178" r="24" />
        </g>
      )}

      {/* estrelas de fundo */}
      <g fill="currentColor">
        {FIELDS[density].map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            opacity={s.o}
            className={animated && s.twinkle ? "animate-twinkle" : undefined}
            style={animated && s.twinkle ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
      </g>

      {/* linhas das constelações */}
      <g
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      >
        <path d={line([CRUZEIRO[0]!, CRUZEIRO[1]!])} />
        <path d={line([CRUZEIRO[2]!, CRUZEIRO[3]!])} />
        <path d={line(MENTORIA)} />
        <path d={line(REDE, true)} />
        <path d={line([REDE[1]!, REDE[3]!])} opacity="0.6" />
      </g>

      {/* nós */}
      <g fill="currentColor">
        {[...CRUZEIRO.slice(0, 4), ...MENTORIA.slice(0, 4), ...REDE].map(([x, y], i) => (
          <circle key={`n-${i}`} cx={x} cy={y} r={i % 3 === 0 ? 4 : 3.2} />
        ))}
        <circle cx={CRUZEIRO[4]![0]} cy={CRUZEIRO[4]![1]} r="2.4" />
      </g>

      {/* estrelas-guia (âmbar) */}
      <g fill={accents ? "var(--color-accent)" : "currentColor"}>
        <circle cx={MENTORIA[4]![0]} cy={MENTORIA[4]![1]} r="7" />
        <circle cx={CRUZEIRO[1]![0]} cy={CRUZEIRO[1]![1]} r="5" />
      </g>
    </svg>
  );
}
