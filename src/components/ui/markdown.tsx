import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Image as ImageIcon } from "lucide-react";
import { cn, isExternalUrl } from "@/lib/utils";

export interface MarkdownProps {
  /** Texto em Markdown (GFM: tabelas, listas de tarefas, ~~riscado~~, autolinks). */
  children: string | null | undefined;
  /** "default" (fórum, comentários) ou "editorial" (newsletter, resumos — serifada). */
  variant?: "default" | "editorial";
  /**
   * Quantos níveis rebaixar os títulos (padrão 1: "# Título" vira <h2>, pois a página já tem h1).
   */
  headingOffset?: number;
  /**
   * Imagens externas expõem o IP de quem lê a sites de terceiros. Por padrão viram links;
   * ative só para conteúdo editorial confiável.
   */
  allowImages?: boolean;
  className?: string;
}

type HeadingTag = "h2" | "h3" | "h4" | "h5" | "h6";

function headingTag(level: number, offset: number): HeadingTag {
  const n = Math.min(6, Math.max(2, level + offset));
  return `h${n}` as HeadingTag;
}

/** react-markdown passa a árvore `node` como prop; ela não pode chegar ao DOM. */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const copy = { ...props };
  delete copy.node;
  return copy;
}

function buildComponents(headingOffset: number, allowImages: boolean): Components {
  const heading = (level: number) =>
    function MarkdownHeading(props: React.ComponentProps<"h1"> & { node?: unknown }) {
      const Tag = headingTag(level, headingOffset);
      return <Tag {...withoutNode(props)} />;
    };

  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    a(allProps) {
      const { href, children, ...props } = withoutNode(allProps);
      if (isExternalUrl(href)) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
            {children}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        );
      }
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      const url = typeof src === "string" ? src : undefined;
      if (!url) return null;
      if (!allowImages) {
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 align-middle"
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            {alt ? `Imagem: ${alt}` : "Abrir imagem"}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        );
      }
      // eslint-disable-next-line @next/next/no-img-element -- conteúdo de terceiros, dimensões desconhecidas
      return <img src={url} alt={alt ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
    },
    table(props) {
      return (
        <div className="prose-table" role="region" aria-label="Tabela" tabIndex={0}>
          <table {...withoutNode(props)} />
        </div>
      );
    },
    // Blocos de código longos rolam na horizontal: precisam receber foco para rolar pelo teclado.
    pre(props) {
      return <pre tabIndex={0} {...withoutNode(props)} />;
    },
    // Listas de tarefas (- [x]) do GFM geram checkboxes desabilitados sem rótulo: damos um nome.
    input(allProps) {
      const props = withoutNode(allProps);
      if (props.type === "checkbox") {
        return <input {...props} aria-label={props.checked ? "Item concluído" : "Item pendente"} />;
      }
      return <input {...props} />;
    },
  };
}

/**
 * Renderiza Markdown escrito por usuárias com segurança: HTML cru é descartado,
 * URLs perigosas (javascript:) são neutralizadas e links externos abrem em nova aba
 * com rel="noopener noreferrer nofollow".
 */
export function Markdown({
  children,
  variant = "default",
  headingOffset = 1,
  allowImages = false,
  className,
}: MarkdownProps) {
  if (!children) return null;
  return (
    <div className={cn("prose-delas", variant === "editorial" && "prose-delas-editorial", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={buildComponents(headingOffset, allowImages)}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
