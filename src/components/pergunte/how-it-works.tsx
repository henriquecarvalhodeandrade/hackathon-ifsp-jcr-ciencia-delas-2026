import { EyeOff, KeyRound, MessagesSquare, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";

const STEPS = [
  {
    icon: EyeOff,
    title: "Você pergunta sem se identificar",
    text: "Sem conta, sem nome e sem contato. Não guardamos nada que leve até você.",
  },
  {
    icon: ShieldCheck,
    title: "A moderação lê antes",
    text: "Nada aparece no site antes de uma moderadora conferir a pergunta.",
  },
  {
    icon: MessagesSquare,
    title: "Cientistas respondem em público",
    text: "Sem conversa privada: todo mundo lê as mesmas respostas, e a moderação acompanha cada uma.",
  },
  {
    icon: KeyRound,
    title: "Você acompanha pelo seu link",
    text: "Ao enviar, você recebe um link só seu. Por ele, vê o andamento e pode apagar a pergunta.",
  },
] as const;

/** Como funciona + o modelo de proteção, em quatro passos (coluna ao lado do formulário). */
export function HowItWorks({ titleId = "como-funciona" }: { titleId?: string }) {
  return (
    <Card as="section" variant="muted" aria-labelledby={titleId} className="p-5 sm:p-6">
      <h2 id={titleId} className="font-display text-xl font-semibold text-fg">
        Como funciona
      </h2>
      <ol className="mt-4 grid gap-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="grid grid-cols-[2.25rem_1fr] gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-[1.125rem]"
            >
              <Icon />
            </span>
            <div className="grid gap-0.5">
              <h3 className="leading-snug font-semibold text-fg">
                <span className="sr-only">Passo {i + 1}: </span>
                {title}
              </h3>
              <p className="text-sm text-fg-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
