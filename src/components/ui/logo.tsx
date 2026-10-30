import { cn } from "@/lib/utils";
import { LOGO_PATHS, LOGO_VIEWBOX } from "./logo-geometry";

/*
 * Símbolo da Artemis: uma lua crescente (Ártemis, deusa grega da caça e da Lua) com a estrela
 * âmbar na curva. A geometria fica em logo-geometry.ts — fonte única também do favicon, do ícone
 * iOS, da imagem de compartilhamento e dos SVGs em public/brand.
 */
export { LOGO_PATHS } from "./logo-geometry";

/** Cor da estrela da marca (âmbar 400 — igual nos dois temas). */
export const LOGO_STAR_COLOR = "var(--color-ambar-400, #ffb24a)";

export interface LogoMarkProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /** Altura (e largura — o símbolo é quadrado) em px. */
  size?: number;
  /** Rótulo acessível; omita quando houver texto ao lado (fica decorativo). */
  title?: string;
}

/** Só o símbolo. A lua usa `currentColor` — controle com text-primary, text-white etc. */
export function LogoMark({ size = 32, title, className, ...props }: LogoMarkProps) {
  const { moon, moonStrokeWidth, star } = LOGO_PATHS;
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      height={size}
      width={size}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      <path
        d={moon}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={moonStrokeWidth}
        strokeLinejoin="round"
      />
      <path d={star} fill={LOGO_STAR_COLOR} />
    </svg>
  );
}

export interface LogoProps extends React.ComponentProps<"span"> {
  /** full = símbolo + nome; mark = só o símbolo. */
  variant?: "full" | "mark";
  /** Altura do símbolo em px. */
  size?: number;
}

/** Marca "Artemis": símbolo + nome em Bricolage Grotesque 700, uma cor só (a do texto). */
export function Logo({ variant = "full", size = 30, className, ...props }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={cn("inline-flex text-primary", className)} {...props}>
        <LogoMark size={size} title="Artemis" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)} {...props}>
      <LogoMark size={size} className="text-primary" />
      <span
        className="font-display leading-none font-bold tracking-[-0.02em] whitespace-nowrap"
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        Artemis
      </span>
    </span>
  );
}
