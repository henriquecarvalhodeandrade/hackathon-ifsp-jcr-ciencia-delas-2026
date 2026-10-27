import { cn } from "@/lib/utils";

/** Seção numerada do guia vivo. */
export function DsSection({
  id,
  number,
  group,
  title,
  description,
  children,
  className,
}: {
  id: string;
  number: string;
  /** Grupo do guia (Fundamentos, Componentes, Diretrizes...). */
  group: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={cn("scroll-mt-24 border-t border-border py-14 first:border-t-0 first:pt-4", className)}>
      <header className="mb-8 grid max-w-3xl gap-2">
        <p className="eyebrow tabular text-primary">
          {number} · {group}
        </p>
        <h2 id={`${id}-titulo`} className="font-display text-3xl font-semibold tracking-[-0.025em] text-fg sm:text-4xl">
          {title}
        </h2>
        {description && <div className="text-lg text-fg-muted">{description}</div>}
      </header>
      {children}
    </section>
  );
}

/** Subtítulo dentro de uma seção. */
export function DsSubheading({ id, children, description }: { id?: string; children: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mt-12 mb-5 grid max-w-3xl gap-1 first:mt-0">
      <h3 id={id} className="scroll-mt-24 font-display text-xl font-semibold text-fg">
        {children}
      </h3>
      {description && <p className="text-fg-muted">{description}</p>}
    </div>
  );
}

/** Área de demonstração ("espécime") com rótulo e opcional trecho de código. */
export function Specimen({
  label,
  children,
  code,
  className,
  contentClassName,
}: {
  label?: string;
  children: React.ReactNode;
  code?: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <figure className={cn("flex flex-col overflow-hidden rounded-card border border-border bg-surface", className)}>
      {label && (
        <figcaption className="border-b border-border bg-surface-2 px-4 py-2 font-mono text-xs font-semibold text-fg-muted">
          {label}
        </figcaption>
      )}
      <div className={cn("p-5 sm:p-6", contentClassName)}>{children}</div>
      {code && (
        <pre
          // focável: trechos longos rolam na horizontal e precisam rolar pelo teclado
          tabIndex={0}
          className="mt-auto overflow-x-auto border-t border-border bg-surface-2 px-4 py-3 font-mono text-[0.8125rem] leading-relaxed text-fg-muted"
        >
          <code>{code}</code>
        </pre>
      )}
    </figure>
  );
}
