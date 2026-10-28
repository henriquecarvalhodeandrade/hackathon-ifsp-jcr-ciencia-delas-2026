import type { Metadata } from "next";
import { MessageCircleQuestion, SearchX } from "lucide-react";
import { HowItWorks } from "@/components/pergunte/how-it-works";
import { QuestionFilters } from "@/components/pergunte/question-filters";
import { QuestionForm } from "@/components/pergunte/question-form";
import { QuestionList } from "@/components/pergunte/question-list";
import {
  Alert,
  ButtonLink,
  Card,
  Container,
  EmptyState,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { filterHref, filterParams, parseQuestionFilters } from "@/lib/pergunte/params";
import {
  listBigAreas,
  listPublicQuestions,
  type BigArea,
  type QuestionsPage,
} from "@/lib/pergunte/queries";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pergunte a uma cientista",
  description:
    "Para estudantes do ensino médio, do técnico e do começo da graduação: pergunte sem criar conta e sem dizer quem é. Cientistas da rede respondem em público.",
  alternates: { canonical: "/pergunte" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_PAGE: QuestionsPage = { questions: [], total: 0, totalPages: 0, page: 1, error: false };

/** Momento da montagem do formulário (o servidor recusa envios rápidos demais, típicos de robôs). */
function serverNow(): number {
  return Date.now();
}

export default async function PerguntePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const [areas, profile] = await Promise.all([
    configured ? listBigAreas() : Promise.resolve<BigArea[]>([]),
    getCurrentProfile(),
  ]);
  const filters = parseQuestionFilters(params, new Set(areas.map((area) => area.id)));
  const isMember = Boolean(profile?.onboarded_at);
  const hasFilters = Boolean(filters.stage || filters.areaId);

  const [answered, awaiting] = configured
    ? await Promise.all([
        listPublicQuestions({
          filter: "respondidas",
          stage: filters.stage,
          areaId: filters.areaId,
          page: filters.page,
        }),
        isMember ? listPublicQuestions({ filter: "sem_resposta", pageSize: 4 }) : null,
      ])
    : [EMPTY_PAGE, null];

  const now = serverNow();
  const deleted = params.pergunta === "apagada";

  return (
    <Container>
      <PageHeader
        eyebrow="Pergunte a uma cientista"
        title="Ainda não pesquisa? Pergunte a uma cientista."
        description="Para estudantes do ensino médio, do técnico e do começo da graduação. Você não precisa criar conta nem dizer quem é: cientistas da rede respondem em público."
      />

      {deleted && (
        <Alert variant="success" title="Sua pergunta foi apagada" className="mb-8">
          Ela e as respostas que recebeu não existem mais na Artemis. Quando quiser, é só perguntar
          de novo.
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
        <Card as="section" aria-labelledby="enviar-pergunta" className="min-w-0 p-5 sm:p-7">
          <h2 id="enviar-pergunta" className="font-display text-2xl font-semibold text-fg">
            Envie sua pergunta
          </h2>
          <p className="mt-1 text-fg-muted">
            Sobre ciência, pesquisa ou carreira científica. Nenhuma pergunta é boba.
          </p>
          <div className="mt-6">
            <QuestionForm areas={areas} renderedAt={now} />
          </div>
        </Card>
        <HowItWorks />
      </div>

      {isMember && awaiting && awaiting.questions.length > 0 && (
        <section aria-labelledby="perguntas-esperando" className="grid gap-5 pt-14">
          <div className="grid gap-1">
            <h2
              id="perguntas-esperando"
              className="flex items-center gap-2 font-display text-2xl font-semibold text-fg"
            >
              <MessageCircleQuestion aria-hidden="true" className="size-6 text-secondary" />
              Perguntas esperando resposta
            </h2>
            <p className="text-fg-muted">
              Você faz parte da rede: em poucos minutos, sua experiência abre caminho para uma
              estudante. {pluralize(awaiting.total, "pergunta")} sem resposta agora.
            </p>
          </div>
          <QuestionList questions={awaiting.questions} variant="esperando" now={now} />
        </section>
      )}

      <section
        id="perguntas-respondidas"
        aria-labelledby="respondidas-titulo"
        className="grid scroll-mt-20 gap-6 pt-14 pb-16"
      >
        <div className="grid gap-1">
          <h2 id="respondidas-titulo" className="font-display text-2xl font-semibold text-fg">
            Perguntas respondidas
          </h2>
          <p className="text-fg-muted">
            Perguntas de estudantes, respondidas por cientistas da rede.
            {answered.total > 0 && ` ${pluralize(answered.total, "pergunta")} neste filtro.`}
          </p>
        </div>

        <QuestionFilters stage={filters.stage} areaId={filters.areaId} areas={areas} />

        {answered.error ? (
          <Alert variant="warning" title="Não conseguimos carregar as perguntas agora">
            Recarregue a página em instantes.
          </Alert>
        ) : answered.questions.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={
              hasFilters
                ? "Nenhuma pergunta respondida com esses filtros"
                : "Ainda não há perguntas respondidas"
            }
            description={
              hasFilters
                ? "Tente outra etapa ou outra área — ou faça você a primeira pergunta sobre o tema."
                : "Faça a primeira pergunta: cientistas da rede respondem depois da moderação."
            }
            action={
              hasFilters ? (
                <ButtonLink href={filterHref({ stage: null, areaId: null })} variant="outline">
                  Ver todas as perguntas
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <QuestionList questions={answered.questions} now={now} />
        )}

        <Pagination
          page={answered.page}
          totalPages={answered.totalPages}
          basePath="/pergunte"
          searchParams={filterParams(filters)}
        />
      </section>
    </Container>
  );
}
