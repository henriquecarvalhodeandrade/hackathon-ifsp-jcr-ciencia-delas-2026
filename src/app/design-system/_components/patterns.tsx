import { CheckCircle2, MessageCircle, Pin, Sparkles, Star } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardLink,
  Chip,
  ConstellationPattern,
  EmptyState,
  ScoreMeter,
  VoteButton,
} from "@/components/ui";
import { formatRelativeTime, pluralize } from "@/lib/utils";
import { DsSection, DsSubheading } from "./ds";
import { FormExample } from "./form-example";

/* Exemplos de composição para as equipes de features (não são componentes exportados). */

export function PaperCardExample() {
  return (
    <Card as="article" variant="interactive" className="flex gap-4 p-5">
      {/* Toggle: nome fixo ("Destacar") + aria-pressed. Na feature: <form action={toggleVote}> + type="submit". */}
      <VoteButton pressed count={128} label="Destacar este paper" />
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Ciências da Saúde</Badge>
          <Badge variant="accent">
            <Star aria-hidden="true" className="fill-current" />
            #1 da semana
          </Badge>
        </div>
        <h3 className="font-serif text-xl leading-snug font-semibold text-fg">
          <CardLink href="/design-system#padroes">
            Biomarcadores salivares para diagnóstico precoce de diabetes gestacional
          </CardLink>
        </h3>
        <p className="truncate text-sm text-fg-muted">Ana Souza, Beatriz Lima, Carolina Duarte · Revista Demo · 2026</p>
        <p className="line-clamp-2 text-[0.9375rem] text-fg-muted">
          <span className="font-semibold text-fg">Em linguagem simples: </span>
          um teste de saliva pode indicar o risco de diabetes na gravidez semanas antes do exame de sangue tradicional.
        </p>
        <div className="flex items-center gap-4 text-sm text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <MessageCircle aria-hidden="true" className="size-4" /> {pluralize(14, "comentário")}
          </span>
          <span className="font-mono text-xs">10.5555/demo.0042</span>
        </div>
      </div>
    </Card>
  );
}

export function MentorMatchExample() {
  return (
    <Card as="article" className="grid gap-4 p-5">
      <div className="flex items-start gap-4">
        <Avatar name="Beatriz Lima" size="lg" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 className="font-display text-lg leading-snug font-semibold text-fg">Dra. Beatriz Lima</h3>
          <p className="text-sm text-fg-muted">Bioinformática · Unicamp, SP</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="primary">Mentora</Badge>
            <Badge variant="success">1 vaga aberta</Badge>
          </div>
        </div>
        <ScoreMeter value={92} size="sm" label="Compatibilidade com Beatriz Lima" />
      </div>
      <div className="rounded-control bg-surface-2 p-3.5 text-[0.9375rem] text-fg-muted">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-info uppercase">
          <Sparkles aria-hidden="true" className="size-3.5" />
          Por que ela? · sugestão da IA
        </p>
        Vocês duas trabalham com genômica do câncer e ela já orientou bolsistas de doutorado sanduíche — um dos seus
        objetivos.
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm">genômica</Chip>
        <Chip size="sm">bolsas e editais</Chip>
        <Chip size="sm">intercâmbio</Chip>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button>Pedir mentoria</Button>
        <Button variant="ghost">Ver perfil</Button>
      </div>
    </Card>
  );
}

export function ThreadRowExample() {
  const twoHoursAgo = new Date(Date.UTC(2026, 9, 27, 12, 0, 0));
  const now = new Date(Date.UTC(2026, 9, 27, 14, 5, 0));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {[
        { title: "Como conciliar maternidade e prazos do doutorado?", replies: 23, solved: false, pinned: true, anon: true },
        { title: "Alguém já fez sanduíche pela CAPES em 2026?", replies: 8, solved: true, pinned: false, anon: false },
      ].map((t) => (
        <li key={t.title} className="relative flex gap-4 p-4 transition-colors hover:bg-surface-2">
          {t.anon ? (
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-fg-subtle ring-1 ring-border">
              ?
            </span>
          ) : (
            <Avatar name="Camila Reis" size="md" />
          )}
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {t.pinned && (
                <Badge variant="primary">
                  <Pin aria-hidden="true" />
                  Fixado
                </Badge>
              )}
              {t.solved && (
                <Badge variant="success">
                  <CheckCircle2 aria-hidden="true" />
                  Resolvido
                </Badge>
              )}
            </div>
            <h3 className="font-display text-base leading-snug font-semibold text-fg">
              {/* CardLink estica o link pela linha inteira e desenha o anel de foco nela. */}
              <CardLink href="/design-system#padroes" className="after:rounded-none">
                {t.title}
              </CardLink>
            </h3>
            <p className="text-sm text-fg-subtle">
              {t.anon ? "Anônima" : "Camila Reis"} · {formatRelativeTime(twoHoursAgo, now)} ·{" "}
              {pluralize(t.replies, "resposta")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NewsletterHeaderExample() {
  return (
    <div className="relative isolate overflow-hidden rounded-card bg-violeta-950 px-6 py-8 text-white">
      <ConstellationPattern
        density="medium"
        align="end"
        className="absolute inset-0 -z-10 size-full text-violeta-300/60 [mask-image:linear-gradient(100deg,transparent_35%,black_80%)]"
      />
      <p className="eyebrow text-violeta-200">Newsletter · Semana 44 de 2026</p>
      <p className="mt-2 max-w-md font-serif text-3xl leading-tight font-semibold">
        As estrelas da semana na ciência feita por mulheres
      </p>
    </div>
  );
}

export function Patterns() {
  return (
    <DsSection
      id="padroes"
      number="08"
      group="Padrões"
      title="Padrões"
      description="Composições de referência para as telas do produto — copie a estrutura, não o texto."
    >
      <DsSubheading description="Voto = “destaque” (estrela) com <VoteButton>: nome fixo + aria-pressed. O cartão inteiro leva ao paper via CardLink.">
        Paper na vitrine
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-2">
        <PaperCardExample />
        <NewsletterHeaderExample />
      </div>

      <DsSubheading description="Sugestão de mentora: medidor de afinidade, explicação da IA sinalizada e uma ação principal.">
        Sugestão de mentoria
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-2">
        <MentorMatchExample />
        <EmptyState
          headingLevel="h4"
          title="Ainda não encontramos mentoras para você"
          description="Complete suas áreas de pesquisa e temas de interesse — é com eles que calculamos a afinidade."
          action={<Button variant="outline">Completar perfil</Button>}
        />
      </div>

      <DsSubheading description="Lista do fórum: autora (ou “Anônima”), tempo relativo, contagem e selos de estado.">
        Tópicos do fórum
      </DsSubheading>
      <ThreadRowExample />

      <DsSubheading
        id="formulario"
        description="Server Action com zod + useActionState. Os valores voltam no estado para não se perderem quando a validação falha."
      >
        Formulário completo
      </DsSubheading>
      <div className="max-w-3xl">
        <FormExample />
      </div>
    </DsSection>
  );
}
