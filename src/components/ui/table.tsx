import { cn } from "@/lib/utils";

export interface TableProps extends React.ComponentProps<"table"> {
  /**
   * Nome da área rolável (ex.: "Denúncias abertas"). Com ele, o contêiner vira uma região
   * focável — quem usa teclado consegue rolar tabelas largas no celular.
   */
  label?: string;
  /** Classes do contêiner rolável (borda, raio, sombra). */
  containerClassName?: string;
}

/**
 * Tabela de dados (painel /admin, listas densas). HTML semântico puro — funciona em Server
 * Components. Rola na horizontal em telas pequenas, sem estourar a página.
 *
 * <Table label="Denúncias abertas">
 *   <TableCaption srOnly>Denúncias abertas, mais recentes primeiro</TableCaption>
 *   <TableHeader><TableRow><TableHead>Motivo</TableHead>…</TableRow></TableHeader>
 *   <TableBody><TableRow><TableCell>…</TableCell></TableRow></TableBody>
 * </Table>
 */
export function Table({ label, containerClassName, className, ...props }: TableProps) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cn(
        "relative w-full overflow-x-auto rounded-card border border-border bg-surface shadow-card",
        containerClassName,
      )}
    >
      <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-2 [&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={cn("border-t border-border bg-surface-2 font-semibold", className)} {...props} />;
}

/** Linha. Marque a selecionada com `aria-selected` (ou data-state="selected"). */
export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors hover:bg-surface-2/60 aria-selected:bg-primary-soft/50 data-[state=selected]:bg-primary-soft/50",
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends React.ComponentProps<"th"> {
  /** Ordenação atual desta coluna (vira aria-sort). */
  sort?: "ascending" | "descending" | "none";
}

/** Cabeçalho de coluna (scope="col" por padrão; use scope="row" na primeira célula de linhas-título). */
export function TableHead({ className, scope = "col", sort, ...props }: TableHeadProps) {
  return (
    <th
      scope={scope}
      aria-sort={sort}
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-bold tracking-wide whitespace-nowrap text-fg-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-fg", className)} {...props} />;
}

export interface TableCaptionProps extends React.ComponentProps<"caption"> {
  /** Legenda só para leitores de tela (quando o título já está visível acima). */
  srOnly?: boolean;
}

export function TableCaption({ className, srOnly, ...props }: TableCaptionProps) {
  return (
    <caption
      className={cn("px-4 py-3 text-left text-sm text-fg-muted", srOnly && "sr-only", className)}
      {...props}
    />
  );
}
