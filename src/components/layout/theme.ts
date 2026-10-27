/**
 * Tema claro/escuro.
 * - Preferência salva em localStorage (THEME_STORAGE_KEY): "light" | "dark" | "system" (padrão).
 * - <html data-theme="light|dark"> guarda o tema RESOLVIDO; data-theme-preference guarda a escolha.
 * - O script inline (THEME_SCRIPT) roda no <head> antes da pintura: sem flash de tema errado.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "cd-theme";
export const THEME_EVENT = "cd-themechange";

/** Cores do <meta name="theme-color"> (iguais a --color-bg). */
export const THEME_COLORS = { light: "#fcfbfe", dark: "#110f16" } as const;

/**
 * Script sem dependências executado antes da hidratação. Mantém-se pequeno e à prova de falhas
 * (localStorage pode estar bloqueado). Também acompanha mudanças do tema do sistema.
 */
export const THEME_SCRIPT = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function pref(){try{var p=localStorage.getItem(k);return p==="light"||p==="dark"?p:"system"}catch(e){return"system"}}function apply(){var p=pref();d.dataset.themePreference=p;d.dataset.theme=p==="system"?(m.matches?"dark":"light"):p}apply();try{m.addEventListener("change",function(){if(pref()==="system"){apply();window.dispatchEvent(new Event(${JSON.stringify(THEME_EVENT)}))}})}catch(e){}})();`;
