import { ExternalLink, Fingerprint, Globe, GraduationCap, UserRound } from "lucide-react";
import { displayUrl, orcidUrl } from "@/lib/profile/links";

export interface ProfileLinksProps {
  lattes_url: string | null;
  orcid: string | null;
  linkedin_url: string | null;
  website_url: string | null;
}

/** Lista de links acadêmicos do perfil (abrem em nova aba, sem repassar a origem). */
export function ProfileLinks({ lattes_url, orcid, linkedin_url, website_url }: ProfileLinksProps) {
  const links = [
    lattes_url && { href: lattes_url, label: "Currículo Lattes", detail: displayUrl(lattes_url, 34), icon: GraduationCap },
    orcid && {
      href: orcidUrl(orcid),
      label: "ORCID",
      detail: orcid.replace(/^https?:\/\/(www\.)?orcid\.org\//i, ""),
      icon: Fingerprint,
      mono: true,
    },
    linkedin_url && { href: linkedin_url, label: "LinkedIn", detail: displayUrl(linkedin_url, 34), icon: UserRound },
    website_url && { href: website_url, label: "Site", detail: displayUrl(website_url, 34), icon: Globe },
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    detail: string;
    icon: typeof Globe;
    mono?: boolean;
  }>;

  if (links.length === 0) return null;

  return (
    <ul className="grid gap-2">
      {links.map(({ href, label, detail, icon: Icon, mono }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group flex items-center gap-3 rounded-control border border-border px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="grid min-w-0 flex-1">
              <span className="text-sm font-semibold text-fg">{label}</span>
              <span className={mono ? "truncate font-mono text-xs text-fg-subtle" : "truncate text-xs text-fg-subtle"}>
                {detail}
              </span>
            </span>
            <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-fg-subtle group-hover:text-fg" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
