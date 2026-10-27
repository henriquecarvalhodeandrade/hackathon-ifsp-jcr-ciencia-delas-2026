import { cn } from "@/lib/utils";

/**
 * Geometria da marca (grade 48×48): o símbolo astronômico de Vênus (♀) desenhado como
 * uma órbita com uma estrela âmbar, e a haste como uma pequena constelação.
 * Vênus é a "Estrela d'Alva", o astro mais brilhante do céu ao amanhecer.
 */
export const LOGO_PATHS = {
  orbit: "M33.93 17.78A10 10 0 1 1 25.22 9.07",
  stem: "M24 29v13.2M17.6 35.6h12.8",
  nodes: [
    { cx: 17.6, cy: 35.6, r: 2.7 },
    { cx: 30.4, cy: 35.6, r: 2.7 },
    { cx: 24, cy: 42.4, r: 2.9 },
  ],
  star: { cx: 31.07, cy: 11.93, r: 3.5 },
  strokeWidth: 3.4,
} as const;

/** Cor da estrela da marca (âmbar 400 — igual nos dois temas). */
export const LOGO_STAR_COLOR = "var(--color-ambar-400, #ffb24a)";

export interface LogoMarkProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /** Altura em px (a largura acompanha a proporção). */
  size?: number;
  /** Rótulo acessível; omita quando houver texto ao lado (fica decorativo). */
  title?: string;
}

/** Só o símbolo. Usa `currentColor` para as linhas — controle com text-primary, text-white etc. */
export function LogoMark({ size = 32, title, className, ...props }: LogoMarkProps) {
  const { orbit, stem, nodes, star, strokeWidth } = LOGO_PATHS;
  return (
    <svg
      viewBox="11 6 26 41"
      height={size}
      width={(size * 26) / 41}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d={orbit} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={stem} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      {nodes.map((n) => (
        <circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r={n.r} fill="currentColor" />
      ))}
      <circle cx={star.cx} cy={star.cy} r={star.r} fill={LOGO_STAR_COLOR} />
    </svg>
  );
}

export interface LogoProps extends React.ComponentProps<"span"> {
  /** full = símbolo + nome; mark = só o símbolo. */
  variant?: "full" | "mark";
  /** Altura do símbolo em px. */
  size?: number;
}

/** Marca "Ciência Delas". O texto usa a fonte display; "Delas" ganha a cor primária. */
export function Logo({ variant = "full", size = 30, className, ...props }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={cn("inline-flex text-primary", className)} {...props}>
        <LogoMark size={size} title="Ciência Delas" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)} {...props}>
      <LogoMark size={size} className="text-primary" />
      <span
        className="font-display leading-none font-bold tracking-[-0.02em] whitespace-nowrap"
        style={{ fontSize: Math.round(size * 0.66) }}
      >
        Ciência <span className="text-primary">Delas</span>
      </span>
    </span>
  );
}
