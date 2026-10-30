import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui";

const STEPS = [
  {
    title: "Combinem formato e horário",
    body: "On-line, presencial ou híbrido? Uma conversa de 30 a 45 minutos costuma bastar para começar.",
  },
  {
    title: "Definam um objetivo para os próximos 3 meses",
    body: "Ex.: submeter o primeiro artigo, montar o projeto para o edital, preparar a entrevista do mestrado.",
  },
  {
    title: "Acertem a frequência e o canal",
    body: "Encontros quinzenais ou mensais funcionam bem. Combinem também por onde vocês vão trocar mensagens.",
  },
  {
    title: "Falem sobre limites e confidencialidade",
    body: "O que é conversado fica entre vocês. Vale dizer o que cada uma pode (e não pode) oferecer.",
  },
  {
    title: "Registrem os combinados",
    body: "Um resumo curto por e-mail depois de cada encontro ajuda a acompanhar a evolução.",
  },
] as const;

/** Orientação para o primeiro encontro (mostrada em "Mentorias ativas"). */
export function FirstMeetingChecklist() {
  return (
    <Card
      as="aside"
      variant="muted"
      aria-labelledby="primeiro-encontro"
      className="grid gap-4 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <ListChecks aria-hidden="true" className="size-5 text-primary" />
        <h2 id="primeiro-encontro" className="font-display text-lg font-semibold text-fg">
          Checklist do primeiro encontro
        </h2>
      </div>
      <ol className="grid gap-3.5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg tabular"
            >
              {index + 1}
            </span>
            <span className="grid gap-0.5 text-sm">
              <span className="font-semibold text-fg">{step.title}</span>
              <span className="text-fg-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-border pt-4 text-sm text-fg-muted">
        Mentorias aqui seguem o{" "}
        <Link href="/conduta" className="font-semibold text-primary underline underline-offset-2">
          código de conduta
        </Link>
        . Se algo não estiver bem, você pode encerrar a mentoria a qualquer momento ou falar com a
        moderação.
      </p>
    </Card>
  );
}
