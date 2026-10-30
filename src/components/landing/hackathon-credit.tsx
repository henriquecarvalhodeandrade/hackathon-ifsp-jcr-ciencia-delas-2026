import Link from "next/link";
import { ArrowUpRight, Code, GraduationCap } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SITE } from "@/lib/constants";

export function HackathonCredit() {
  return (
    <section aria-labelledby="credito-titulo" className="pb-4">
      <Container>
        <div className="grid gap-6 rounded-card border border-border bg-surface p-6 shadow-card sm:p-8 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-secondary-soft text-secondary-soft-fg">
            <GraduationCap aria-hidden="true" className="size-7" />
          </span>
          <div className="grid gap-1.5">
            <h2 id="credito-titulo" className="font-display text-xl font-semibold text-fg">
              Nasceu no Hackathon IFSP Câmpus Jacareí 2026
            </h2>
            <p className="text-fg-muted">
              Projeto criado para o tema “{SITE.theme}”, com código aberto e custo zero de operação.
              O verde da marca é o mesmo dos Institutos Federais.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/sobre"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Conheça o projeto
            </Link>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
            >
              <Code aria-hidden="true" className="size-4" />
              Código-fonte
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
