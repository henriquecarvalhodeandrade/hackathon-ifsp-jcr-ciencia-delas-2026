import { BookOpen, HeartHandshake, MessagesSquare, ShieldCheck } from "lucide-react";

const PERKS = [
  {
    icon: BookOpen,
    title: "Papers em destaque",
    text: "Os trabalhos de pesquisadoras mais destacados pela comunidade na semana, com resumo em linguagem acessível.",
  },
  {
    icon: MessagesSquare,
    title: "Conversas do fórum",
    text: "As discussões que movimentaram a rede. Os espaços de apoio e os relatos anônimos nunca saem do fórum.",
  },
  {
    icon: HeartHandshake,
    title: "Mentoras na rede",
    text: "Quem chegou para orientar pesquisadoras em início de carreira — e como pedir mentoria.",
  },
] as const;

/** O que vem no boletim + nota de privacidade. */
export function NewsletterPerks() {
  return (
    <section aria-labelledby="o-que-vem" className="grid gap-5">
      <h2 id="o-que-vem" className="font-display text-2xl font-semibold text-fg">
        O que chega toda segunda-feira
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg"
            >
              <Icon className="size-5" />
            </span>
            <div className="grid gap-1">
              <p className="font-semibold text-fg">{title}</p>
              <p className="text-sm text-fg-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 text-sm text-fg-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
        <span>
          Seu e-mail é usado só para enviar o boletim. Pedimos confirmação antes do primeiro envio (double opt-in) e todo
          e-mail traz um link para cancelar e excluir seus dados.
        </span>
      </p>
    </section>
  );
}
