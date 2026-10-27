import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { Logo } from "@/components/ui/logo";
import { SITE } from "@/lib/constants";

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string; external?: boolean }> }> = [
  {
    title: "Comunidade",
    links: [
      { href: "/forum", label: "Fórum" },
      { href: "/mentoria", label: "Mentoria" },
      { href: "/pesquisadoras", label: "Pesquisadoras" },
    ],
  },
  {
    title: "Vitrine",
    links: [
      { href: "/papers", label: "Papers" },
      { href: "/ranking", label: "Ranking" },
      { href: "/newsletter", label: "Newsletter" },
    ],
  },
  {
    title: "Projeto",
    links: [
      { href: "/sobre", label: "Sobre" },
      { href: "/conduta", label: "Código de conduta" },
      { href: "/privacidade", label: "Privacidade" },
      { href: "/design-system", label: "Design system" },
      { href: SITE.repoUrl, label: "Código no GitHub", external: true },
    ],
  },
];

const linkClass =
  "inline-flex items-center gap-1 rounded-badge text-[0.9375rem] text-fg-muted transition-colors hover:text-primary hover:underline hover:underline-offset-4";

export function SiteFooter() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-border bg-surface">
      <ConstellationPattern
        density="low"
        orbits={false}
        animated={false}
        accents={false}
        className="absolute inset-x-0 top-0 h-40 w-full text-primary/15 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-8 sm:px-6 lg:grid-cols-[1.4fr_2fr] lg:px-8">
        <div className="grid content-start gap-4">
          <Logo size={30} />
          <p className="max-w-sm text-fg-muted">{SITE.tagline}.</p>
          <p className="text-sm text-fg-subtle">
            Feito no <strong className="font-semibold text-fg-muted">Hackathon IFSP Jacareí 2026</strong> — tema
            “Ciência Delas”.
          </p>
        </div>
        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="eyebrow mb-3 text-fg-subtle">{col.title}</h2>
              <ul className="grid gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {link.label}
                        <ArrowUpRight aria-hidden="true" className="size-3.5" />
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="relative border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Ciência Delas · código aberto sob licença MIT</p>
          <p>Feito com cuidado para pesquisadoras de todo o Brasil.</p>
        </div>
      </div>
    </footer>
  );
}
