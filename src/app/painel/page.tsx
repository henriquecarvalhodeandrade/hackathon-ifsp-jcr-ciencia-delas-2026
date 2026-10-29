import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { firstName } from "@/components/landing/featured";
import { NetworkPostsCard } from "@/components/painel/network-posts-card";
import { NewsCard } from "@/components/painel/news-card";
import { NextStepsCard } from "@/components/painel/next-steps-card";
import { QuestionsCard } from "@/components/painel/questions-card";
import { WaitingCard, waitingItems } from "@/components/painel/waiting-card";
import { AwaitingQuestionsCard } from "@/components/pergunte/awaiting-questions-card";
import { RecognitionTodos } from "@/components/recognition/recognition-todos";
import { Container, PageHeader } from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { loadNetworkWaiting } from "@/lib/painel/network";
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
 * painel saem de um único Promise.all em loadPainelData (6 idas ao Supabase, com RLS). As
 * pendências da rede social (mensagens diretas, convites, candidaturas — com nome) vêm de
 * loadNetworkWaiting, em paralelo, e entram em "O que está esperando você". Os blocos das outras
 * funcionalidades (RecognitionTodos, AwaitingQuestionsCard) leem por conta própria e não
 * aparecem quando não há nada para mostrar; NetworkPostsCard ("Da sua rede") também lê sozinho.
 *
 * Ordem: quando há algo esperando por ela, isso vem primeiro (e logo depois o que a rede está
 * publicando) — no celular, é o que aparece na primeira tela; sem pendências, os passos abrem.
 */
export default async function PainelPage() {
  const profile = await requireOnboardedProfile("/painel");
  const [data, network] = await Promise.all([
    loadPainelData(profile),
    loadNetworkWaiting(profile.id),
  ]);
  const { now } = data;
  const steps = computeNextSteps(data.steps);
  const name = firstName(profile.full_name);
  const waitingFirst = !data.waitingFailed && waitingItems(data.waiting, now, network).length > 0;

  const waitingCard = (
    <WaitingCard
      key="pendencias"
      waiting={data.waiting}
      failed={data.waitingFailed}
      now={now}
      network={network}
    />
  );
  const stepsCard = <NextStepsCard key="passos" result={steps} failed={data.stepsFailed} />;
  // Rede social: as publicações recentes de quem ela segue (docs/18).
  const postsCard = <NetworkPostsCard key="da-rede" userId={profile.id} />;

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
          {waitingFirst ? [waitingCard, postsCard, stepsCard] : [stepsCard, postsCard, waitingCard]}
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
