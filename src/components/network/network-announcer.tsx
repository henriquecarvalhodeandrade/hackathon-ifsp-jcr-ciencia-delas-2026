"use client";

/**
 * Passagem de foco depois de uma ação que tira o botão da tela (aceitar, recusar, remover…).
 * O cartão (ou o aviso de convite do perfil) some — junto com o botão focado —, então o foco iria
 * parar no <body>. Aqui ele vai para um elemento estável: o título da seção, ou, num grupo de
 * ações, o botão principal (`[data-primary]`) — senão o primeiro botão. O resultado em si é
 * anunciado pelo aviso (`toast`), cuja região `role="status"` fica no layout.
 *
 * Espera a página revalidada chegar: tenta por ~1,5 s enquanto o foco ainda está no botão que vai
 * sumir. Se a pessoa já levou o foco para outro lugar, não mexe.
 */
export function handOffFocus(
  targetId: string | undefined,
  options: {
    waitForPrimary?: boolean;
    /** Id do elemento que vai sumir: enquanto o foco estiver dentro dele, espera. */
    leaving?: string;
  } = {},
) {
  if (!targetId || typeof window === "undefined") return;
  const id = targetId;
  const origin = document.activeElement;
  let tries = 0;

  function attempt() {
    tries += 1;
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected;
    if (!lost) {
      // Ainda no botão de origem (ou no cartão que vai sumir): a página revalidada não chegou.
      const leaving = options.leaving ? document.getElementById(options.leaving) : null;
      const waiting = active === origin || Boolean(leaving?.contains(active));
      if (waiting && tries < 15) window.setTimeout(attempt, 100);
      return;
    }
    const element = document.getElementById(id);
    const primary = element?.querySelector<HTMLElement>(
      "[data-primary] a[href], [data-primary] button",
    );
    // O grupo de ações do perfil ganha o botão principal só quando a página revalidada chega.
    if (options.waitForPrimary && !primary && tries < 15) {
      window.setTimeout(attempt, 100);
      return;
    }
    if (!element) {
      // A lista acabou (o título dela saiu junto): o foco vai para o título da página.
      const heading = document.querySelector<HTMLElement>("main h1");
      if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading?.focus();
      return;
    }
    const target =
      primary ??
      (element.matches("button, a[href], input, [tabindex]")
        ? element
        : element.querySelector<HTMLElement>("button:not([disabled]), a[href]"));
    target?.focus();
  }

  window.setTimeout(attempt, 150);
}
