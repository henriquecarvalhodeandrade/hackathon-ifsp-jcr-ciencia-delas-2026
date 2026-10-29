/**
 * Ajudantes de foco e anúncio do feed (só no navegador). Mantêm a pessoa no lugar depois de
 * publicar, apagar ou carregar mais publicações (docs/02 §13).
 */

/** id da região `aria-live` do feed (renderizada por <FeedLiveRegion />). */
export const LIVE_REGION_ID = "feed-anuncios";

/** Anuncia uma mensagem para leitores de tela (limpa antes, para repetir a mesma frase). */
export function announce(message: string) {
  const region = document.getElementById(LIVE_REGION_ID);
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 60);
}

/** Cartões de publicação na ordem da página (lista inicial + páginas carregadas depois). */
function postArticles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("article[data-post-id]"));
}

/** Para onde levar o foco quando uma publicação some: a seguinte, ou a anterior. */
export function neighborPostId(postId: string): string | null {
  const list = postArticles();
  const index = list.findIndex((el) => el.dataset.postId === postId);
  if (index < 0) return null;
  return (list[index + 1] ?? list[index - 1])?.dataset.postId ?? null;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Foca um cartão (tabIndex -1) sem saltar e o traz para a vista. */
export function focusPost(postId: string, options: { highlight?: boolean } = {}): boolean {
  const article = document.getElementById(`post-${postId}`);
  if (!article) return false;
  article.focus({ preventScroll: true });
  article.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  if (options.highlight) {
    // Anel que some aos poucos (a transição respeita prefers-reduced-motion no CSS do cartão).
    article.setAttribute("data-destaque", "");
    window.setTimeout(() => article.removeAttribute("data-destaque"), 1600);
  }
  return true;
}

/** Foca um elemento qualquer pelo id (títulos com tabIndex -1, abas…). */
export function focusById(id: string): boolean {
  const element = document.getElementById(id);
  if (!element) return false;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  return true;
}

/** Foca a aba ativa do feed (quando não sobra publicação para focar). */
export function focusFeedTabs(): boolean {
  const tab = document.querySelector<HTMLElement>('nav[data-feed-tabs] a[aria-current="page"]');
  if (!tab) return focusById("publicacoes-titulo");
  tab.focus();
  return true;
}

/**
 * Espera um elemento aparecer (`present`) ou sumir (`!present`) do DOM — a página revalidada
 * chega logo depois da resposta da action — e o diálogo de confirmação fechar (ao fechar, ele
 * devolve o foco a quem o abriu; só depois disso movemos o foco). Desiste em ~2 s e chama `done`.
 */
export function waitForElement(id: string, present: boolean, done: () => void) {
  let frames = 0;
  const tick = () => {
    const exists = document.getElementById(id) !== null;
    const dialogOpen = document.querySelector("dialog[open]") !== null;
    if ((exists === present && !dialogOpen) || frames++ > 120) {
      window.setTimeout(done, 0);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Evento para as páginas carregadas com "Carregar mais" (fora da árvore revalidada). */
export const POST_CHANGED_EVENT = "feed:publicacao-alterada";
export type PostChangedDetail = { postId: string; deleted?: boolean };

export function notifyPostChanged(detail: PostChangedDetail) {
  window.dispatchEvent(new CustomEvent<PostChangedDetail>(POST_CHANGED_EVENT, { detail }));
}
