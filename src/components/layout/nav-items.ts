/** Itens de navegação principal (rotas do contrato §5). */

export interface NavItem {
  href: string;
  label: string;
}

/** Para visitantes: a vitrine pública. */
export const PUBLIC_NAV: readonly NavItem[] = [
  { href: "/papers", label: "Papers" },
  { href: "/ranking", label: "Ranking" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/pergunte", label: "Pergunte" },
  { href: "/sobre", label: "Sobre" },
];

/** Para membras logadas: comunidade primeiro. */
export const MEMBER_NAV: readonly NavItem[] = [
  { href: "/forum", label: "Fórum" },
  { href: "/mentoria", label: "Mentoria" },
  { href: "/pesquisadoras", label: "Pesquisadoras" },
  { href: "/papers", label: "Papers" },
  { href: "/ranking", label: "Ranking" },
  { href: "/newsletter", label: "Newsletter" },
];
