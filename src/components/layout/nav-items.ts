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

/** Para membras logadas, na barra do desktop: a rede (docs/18) primeiro. */
export const MEMBER_NAV_PRIMARY: readonly NavItem[] = [
  { href: "/feed", label: "Feed" },
  { href: "/rede", label: "Rede" },
  { href: "/ics", label: "ICs" },
  { href: "/mentoria", label: "Mentoria" },
  { href: "/forum", label: "Fórum" },
];

/** Para membras logadas, no menu "Mais" do desktop. */
export const MEMBER_NAV_MORE: readonly NavItem[] = [
  { href: "/pesquisadoras", label: "Pesquisadoras" },
  { href: "/papers", label: "Papers" },
  { href: "/pergunte", label: "Pergunte" },
  { href: "/ranking", label: "Ranking" },
  { href: "/newsletter", label: "Newsletter" },
];

/** Para membras logadas: lista completa (gaveta do celular). */
export const MEMBER_NAV: readonly NavItem[] = [...MEMBER_NAV_PRIMARY, ...MEMBER_NAV_MORE];
