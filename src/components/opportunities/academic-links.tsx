import Link from "next/link";
import { ExternalLink, Fingerprint, GraduationCap } from "lucide-react";
import { displayUrl, orcidUrl } from "@/lib/profile/links";

export interface AcademicLinksProps {
  lattes_url: string | null;
  orcid: string | null;
  /**
   * "self": é a própria usuária (candidatando-se) — sem links, sugere completar o perfil.
   * "other": perfil de outra pessoa (candidatura recebida) — sem links, não mostra nada.
   */
  viewer: "self" | "other";
}

/** Lattes e ORCID em uma linha compacta (abrem em nova aba, sem repassar a origem). */
export function AcademicLinks({ lattes_url, orcid, viewer }: AcademicLinksProps) {
  const links = [
    lattes_url && {
      href: lattes_url,
      label: "Lattes",
      detail: displayUrl(lattes_url, 34),
      icon: GraduationCap,
    },
    orcid && {
      href: orcidUrl(orcid),
      label: "ORCID",
      detail: orcid.replace(/^https?:\/\/(www\.)?orcid\.org\//i, ""),
      icon: Fingerprint,
    },
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    detail: string;
    icon: typeof GraduationCap;
  }>;

  if (links.length === 0) {
    if (viewer === "other") return null;
    return (
      <p className="text-sm text-fg-muted">
        Você ainda não informou Lattes nem ORCID.{" "}
        <Link
          href="/perfil#pesquisa"
          className="font-semibold text-primary underline underline-offset-2"
        >
          Adicione no seu perfil
        </Link>{" "}
        — eles ajudam a mostrar sua trajetória, mas não são obrigatórios.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {links.map(({ href, label, detail, icon: Icon }) => (
        <li key={label} className="min-w-0">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="shrink-0">{label}</span>
            <span className="truncate font-normal text-fg-subtle">{detail}</span>
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
