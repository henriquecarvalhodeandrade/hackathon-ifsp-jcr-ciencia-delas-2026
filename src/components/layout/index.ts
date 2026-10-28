export { MobileNav, type MobileNavProps } from "./mobile-nav";
export { MEMBER_NAV, PUBLIC_NAV, type NavItem } from "./nav-items";
export { NavLink, isActivePath, type NavLinkProps } from "./nav-link";
export { SiteFooter } from "./site-footer";
// SiteHeader (async, só servidor) NÃO sai por aqui — importe de "@/components/layout/site-header".
// Assim este índice pode ser usado em Client Components sem puxar "server-only".
export { SiteHeaderView, type HeaderAccount, type SiteHeaderViewProps } from "./site-header-view";
export { SkipLink } from "./skip-link";
export { SupabaseSetupNotice } from "./supabase-setup-notice";
export {
  THEME_COLORS,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";
export { ThemeToggle, setThemePreference, type ThemeToggleProps } from "./theme-toggle";
export { UserMenu, type UserMenuProps } from "./user-menu";
