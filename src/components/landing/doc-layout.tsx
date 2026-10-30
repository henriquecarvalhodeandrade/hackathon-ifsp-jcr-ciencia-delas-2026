import { ArrowUpRight, ListTree } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { cn, formatDate, toIsoString } from "@/lib/utils";

/**
 * Layout das páginas institucionais (/sobre, /conduta, /privacidade):
 * sumário fixo no desktop (recolhível no celular) e texto com a tipografia `prose-delas`.
 */

export interface DocTocItem {
  id: string;
  label: string;
}

export interface DocLayoutProps {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  toc: readonly DocTocItem[];
  /** Data da última revisão do texto ("AAAA-MM-DD"). */
  updatedAt?: string;
  children: React.ReactNode;
}

function TocList({ toc }: { toc: readonly DocTocItem[] }) {
  return (
    <ol className="grid gap-0.5 text-[0.9375rem]">
      {toc.map((item, i) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="flex gap-2 rounded-control px-2 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <span aria-hidden="true" className="w-5 shrink-0 text-right text-fg-subtle tabular">
              {i + 1}.
            </span>
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function DocLayout({
  eyebrow,
  title,
  description,
  toc,
  updatedAt,
  children,
}: DocLayoutProps) {
  return (
    <Container size="wide" className="pb-16">
      <PageHeader eyebrow={eyebrow} title={title} description={description}>
        {updatedAt && (
          <p className="text-sm text-fg-subtle">
            Última atualização:{" "}
            <time dateTime={toIsoString(`${updatedAt}T12:00:00Z`)}>
              {formatDate(`${updatedAt}T12:00:00Z`, { dateStyle: "long" })}
            </time>
          </p>
        )}
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Nesta página" className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-card border border-border bg-surface p-2 shadow-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control px-2 py-1.5 font-semibold text-fg [&::-webkit-details-marker]:hidden">
              <ListTree aria-hidden="true" className="size-4 text-primary" />
              Nesta página
              <span
                aria-hidden="true"
                className="ml-auto text-fg-subtle transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </summary>
            <div className="pt-2">
              <TocList toc={toc} />
            </div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 px-2 eyebrow text-fg-subtle">Nesta página</p>
            <TocList toc={toc} />
          </div>
        </nav>
        <article
          className={cn(
            "prose-delas min-w-0",
            "[&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 [&>section:first-child>h2]:mt-0",
            "[&_section+section]:mt-12 [&_section+section]:border-t [&_section+section]:border-border [&_section+section]:pt-2",
          )}
        >
          {children}
        </article>
      </div>
    </Container>
  );
}

export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Link externo em texto corrido: nova aba + aviso para leitores de tela. */
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {/* Inline (e não inline-flex): num parágrafo, o link quebra junto com o texto em vez de
          virar um bloco na largura toda no celular. */}
      {children}
      <ArrowUpRight aria-hidden="true" className="ml-0.5 inline-block size-3.5 align-[-0.1em]" />
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Caixa de destaque dentro do texto (não usa a tipografia de prose). */
export function DocCallout({
  tone = "primary",
  title,
  children,
}: {
  tone?: "primary" | "secondary" | "warning" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary-soft-fg",
    secondary: "bg-secondary-soft text-secondary-soft-fg",
    warning: "bg-warning-soft text-warning-soft-fg",
    danger: "bg-danger-soft text-danger-soft-fg",
  } as const;
  return (
    <aside
      className={cn(
        "my-6 grid gap-1.5 rounded-card p-5 text-[0.9375rem] leading-relaxed [&_a]:font-semibold [&_a]:text-current [&_a]:underline",
        tones[tone],
      )}
    >
      <p className="m-0 font-display text-base font-semibold">{title}</p>
      <div className="grid gap-2 [&_p]:m-0">{children}</div>
    </aside>
  );
}
