/** Primeiro elemento focável da página: leva direto ao <main id="conteudo">. */
export function SkipLink({ href = "#conteudo" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only rounded-control bg-primary px-4 py-2.5 font-semibold text-primary-fg shadow-overlay focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
    >
      Pular para o conteúdo
    </a>
  );
}
