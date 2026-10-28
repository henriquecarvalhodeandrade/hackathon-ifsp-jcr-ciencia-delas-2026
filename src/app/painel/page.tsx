import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { firstName } from "@/components/landing/featured";
import { NewsCard } from "@/components/painel/news-card";
import { NextStepsCard } from "@/components/painel/next-steps-card";
import { QuestionsCard } from "@/components/painel/questions-card";
import { WaitingCard } from "@/components/painel/waiting-card";
import { AwaitingQuestionsCard } from "@/components/pergunte/awaiting-questions-card";
import { RecognitionTodos } from "@/components/recognition/recognition-todos";
import { Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { computeNextSteps } from "@/lib/painel/next-steps";
import { loadPainelData } from "@/lib/painel/queries";

export const metadata: Metadata = {
  title: "Meu painel",
  description: "Seus próximos passos, o que está esperando por você e as novidades da rede.",
  robots: { index: false, follow: false },
};

/**
 * /painel — o "início" de quem já faz parte da rede (docs/14-painel-e-modo-demo.md).
 * Cada bloco é um Server Component independente que recebe os próprios dados; as leituras do
 * painel saem de um único Promise.all em loadPainelData (6 idas ao Supabase, com RLS). Os blocos
 * das outras funcionalidades (RecognitionTodos, AwaitingQuestionsCard) leem por conta própria
 * e não aparecem quando não há nada para mostrar.
 */
export default async function PainelPage() {
  const profile = await requireOnboardedProfile("/painel");
  const data = await loadPainelData(profile);
  const { now } = data;
  const steps = computeNextSteps(data.steps);
  const name = firstName(profile.full_name);

  return (
    <Container>
      <PageHeader
        eyebrow="Meu painel"
        title={name ? `Que bom te ver, ${name}.` : "Que bom te ver por aqui."}
        description={
          profile.is_mentor
            ? "Onde você é esperada esta semana, em poucos minutos."
            : "Seus próximos passos na Artemis, um de cada vez."
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-8">
        <div className="grid min-w-0 gap-6">
          <NextStepsCard result={steps} failed={data.stepsFailed} />
          <WaitingCard waiting={data.waiting} failed={data.waitingFailed} now={now} />
          {/* Pendências das mentorias concluídas (retorno e declaração; docs/15). */}
          <RecognitionTodos userId={profile.id} />
        </div>

        <div className="grid min-w-0 gap-6">
          <QuestionsCard
            questions={data.questions}
            isMentor={profile.is_mentor}
            failed={data.questionsFailed}
            now={now}
          />
          {/* Perguntas de estudantes sem resposta (Pergunte a uma cientista; docs/16). */}
          <AwaitingQuestionsCard now={now} />
          <NewsCard news={data.news} failed={data.newsFailed} />
        </div>
      </div>

      <footer className="flex justify-center py-10 sm:py-12">
        <Link
          href="/?visao=publica"
          className="inline-flex items-center gap-2 rounded-control text-sm font-semibold text-fg-muted underline-offset-4 hover:text-primary hover:underline"
        >
          <Globe aria-hidden="true" className="size-4" />
          Ver a página pública da Artemis
        </Link>
      </footer>
    </Container>
  );
}
