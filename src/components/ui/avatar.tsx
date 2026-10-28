import { env } from "@/lib/env";
import { displayableAvatarSrc } from "@/lib/profile/avatar";
import { cn, formatNumber, hashString, initials } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
  "2xl": "size-28 text-4xl",
} as const;

export type AvatarSize = keyof typeof sizes;

/** Pares de cor (fundo suave + texto) — todos passam AA nos dois temas. */
const tones = [
  "bg-primary-soft text-primary-soft-fg",
  "bg-secondary-soft text-secondary-soft-fg",
  "bg-accent-soft text-accent-soft-fg",
  "bg-info-soft text-info-soft-fg",
  "bg-danger-soft text-danger-soft-fg",
] as const;

/** Cor determinística a partir do nome (a mesma pessoa sempre tem a mesma cor). */
export function avatarTone(seed: string): string {
  return tones[hashString(seed) % tones.length]!;
}

export interface AvatarProps extends Omit<React.ComponentProps<"span">, "children"> {
  name: string | null | undefined;
  src?: string | null;
  size?: AvatarSize;
  /**
   * Texto alternativo. Por padrão o avatar é decorativo (alt=""), porque quase sempre
   * aparece ao lado do nome. Passe `alt` quando ele estiver sozinho.
   */
  alt?: string;
  /** Usado para a cor quando o nome pode mudar (ex.: id do perfil). */
  seed?: string;
}

/**
 * Foto de perfil com fallback de iniciais. As iniciais ficam por baixo da imagem:
 * se a foto falhar, elas aparecem — sem precisar de JavaScript.
 */
export function Avatar({ name, src, size = "md", alt, seed, className, ...props }: AvatarProps) {
  const label = alt ?? "";
  // Só fotos do Storage deste projeto (ou do Google): endereços de terceiros revelariam o IP de
  // quem vê o avatar. Fora da lista, ficam as iniciais.
  const safeSrc = displayableAvatarSrc(src, env.supabaseUrl);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold select-none",
        sizes[size],
        avatarTone(seed ?? name ?? "?"),
        className,
      )}
      {...props}
    >
      {/* Iniciais como conteúdo gerado (CSS), não texto do DOM: são decorativas, e assim botões
          com avatar (menu da conta) não violam "rótulo no nome" (WCAG 2.5.3). */}
      <span
        aria-hidden="true"
        data-initials={initials(name)}
        className="before:content-[attr(data-initials)]"
      />
      {safeSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- avatares vêm de domínios variados (Storage, Google); <img> evita erro de host não configurado
        <img
          src={safeSrc}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}

export interface AvatarGroupProps extends React.ComponentProps<"div"> {
  people: ReadonlyArray<{ id?: string; name: string | null; src?: string | null }>;
  max?: number;
  size?: Extract<AvatarSize, "xs" | "sm" | "md">;
  /** Rótulo acessível do grupo, ex.: "12 pesquisadoras apoiaram". */
  label?: string;
}

/** Avatares sobrepostos com contador "+N". */
export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
  label,
  className,
  ...props
}: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("flex items-center -space-x-2", className)}
      {...props}
    >
      {visible.map((person, index) => (
        <Avatar
          key={person.id ?? `${person.name}-${index}`}
          name={person.name}
          src={person.src}
          seed={person.id}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex items-center justify-center rounded-full bg-surface-2 font-semibold text-fg-muted ring-2 ring-surface",
            sizes[size],
          )}
        >
          +{formatNumber(rest)}
        </span>
      )}
    </div>
  );
}
