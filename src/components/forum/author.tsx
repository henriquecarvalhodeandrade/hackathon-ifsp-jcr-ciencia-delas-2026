import Link from "next/link";
import { Shield } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import type { ForumAuthor } from "@/lib/forum/types";
import { cn } from "@/lib/utils";

export const ANONYMOUS_LABEL = "Anônima";

const anonSizes = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-5",
  lg: "size-14 [&_svg]:size-6",
} as const;

/**
 * Avatar de quem publicou. Conteúdo anônimo usa um escudo neutro — nunca iniciais,
 * cor derivada de id ou qualquer pista da autoria.
 */
export function ForumAvatar({
  author,
  size = "md",
  className,
}: {
  author: ForumAuthor | null;
  size?: keyof typeof anonSizes;
  className?: string;
}) {
  if (!author) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-subtle ring-1 ring-border",
          anonSizes[size],
          className,
        )}
      >
        <Shield />
      </span>
    );
  }
  return <Avatar name={author.full_name} src={author.avatar_url} seed={author.id} size={size} className={className} />;
}

/** Nome da autora (link para o perfil) ou "Anônima"; selo "você" na própria autoria anônima. */
export function AuthorName({
  author,
  isOwnAnonymous = false,
  linkClassName,
}: {
  author: ForumAuthor | null;
  isOwnAnonymous?: boolean;
  /** Ex.: "relative z-10" quando dentro de um cartão com link esticado. */
  linkClassName?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {author ? (
        <Link
          href={`/pesquisadoras/${author.id}`}
          className={cn("font-semibold text-fg transition-colors hover:text-primary hover:underline", linkClassName)}
        >
          {author.full_name || "Pesquisadora"}
        </Link>
      ) : (
        <span className="font-semibold text-fg-muted">{ANONYMOUS_LABEL}</span>
      )}
      {!author && isOwnAnonymous && (
        <Badge variant="primary" title="Só você vê este selo: a autoria continua anônima para as outras membros.">
          você
        </Badge>
      )}
    </span>
  );
}
