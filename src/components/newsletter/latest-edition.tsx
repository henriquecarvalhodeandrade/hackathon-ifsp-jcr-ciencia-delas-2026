import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink, ConstellationPattern } from "@/components/ui";
import type { EditionListItem } from "@/lib/newsletter/queries";
import { formatEditionPeriod } from "@/lib/newsletter/week";
import { truncate } from "@/lib/utils";

/**
 * Destaque da última edição — peça de marca (violeta-950 nos dois temas) com o padrão Constelação,
 * como o "Cabeçalho da newsletter" do design system.
 */
export function LatestEdition({ edition }: { edition: EditionListItem | null }) {
  const period = edition ? formatEditionPeriod(edition.period_start, edition.period_end) : null;
  return (
    <section
      data-theme="dark"
      aria-labelledby="ultima-edicao"
      className="relative isolate overflow-hidden rounded-dialog bg-violeta-950 px-6 py-8 text-white sm:px-8 sm:py-10"
    >
      <ConstellationPattern
        density="medium"
        align="end"
        className="absolute inset-0 -z-10 size-full text-violeta-300/60 [mask-image:linear-gradient(100deg,transparent_30%,black_85%)]"
      />
      <p className="eyebrow text-violeta-200">{edition ? `Última edição${period ? ` · ${period}` : ""}` : "Em breve"}</p>
      {edition ? (
        <>
          <h2 id="ultima-edicao" className="mt-3 max-w-xl font-serif text-3xl leading-tight font-semibold text-balance">
            <Link href={`/newsletter/${edition.slug}`} className="rounded-control hover:underline hover:underline-offset-4">
              {edition.title}
            </Link>
          </h2>
          {edition.summary && (
            <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-violeta-100">
              {truncate(edition.summary, 260)}
            </p>
          )}
          <ButtonLink href={`/newsletter/${edition.slug}`} variant="accent" className="mt-6">
            Ler a edição
            <ArrowRight aria-hidden="true" />
          </ButtonLink>
        </>
      ) : (
        <>
          <h2 id="ultima-edicao" className="mt-3 max-w-xl font-serif text-3xl leading-tight font-semibold text-balance">
            A primeira edição chega na próxima segunda-feira
          </h2>
          <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-violeta-100">
            Assine agora para receber os papers mais destacados, as conversas da comunidade e as novas mentoras assim que
            o boletim sair.
          </p>
        </>
      )}
    </section>
  );
}
