import { ArrowRight, BookOpen, HeartHandshake, MessagesSquare, UserRoundPen } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { SITE } from "@/lib/constants";

export interface LandingViewer {
  firstName: string | null;
  onboarded: boolean;
  seeksMentorship: boolean;
  isMentor: boolean;
}

const VERBS = [
  {
    title: "Conectar",
    text: "Pesquisadoras de todas as áreas e etapas, num fórum seguro e só para membras.",
  },
  {
    title: "Mentorar",
    text: "Sugestões de mentoras com o porquê de cada combinação — a IA é opcional e só entra com a sua autorização — e pedidos que respeitam as vagas de cada uma.",
  },
  {
    title: "Dar visibilidade",
    text: "Papers escritos por mulheres, resumos em linguagem simples, destaques e o Boletim semanal.",
  },
] as const;

function HeroActions({ viewer }: { viewer: LandingViewer | null }) {
  if (!viewer) {
    return (
      <>
        <ButtonLink href="/cadastro" size="lg">
          Criar minha conta
          <ArrowRight aria-hidden="true" />
        </ButtonLink>
        <ButtonLink href="/papers" size="lg" variant="outline">
          <BookOpen aria-hidden="true" />
          Explorar a Vitrine
        </ButtonLink>
      </>
    );
  }
  if (!viewer.onboarded) {
    return (
      <>
        <ButtonLink href="/onboarding" size="lg">
          <UserRoundPen aria-hidden="true" />
          Completar meu perfil
        </ButtonLink>
        <ButtonLink href="/papers" size="lg" variant="outline">
          <BookOpen aria-hidden="true" />
          Explorar a Vitrine
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <ButtonLink href="/forum" size="lg">
        <MessagesSquare aria-hidden="true" />
        Ir para o fórum
      </ButtonLink>
      {viewer.seeksMentorship ? (
        <ButtonLink href="/mentoria" size="lg" variant="outline">
          <HeartHandshake aria-hidden="true" />
          Ver minhas sugestões
        </ButtonLink>
      ) : viewer.isMentor ? (
        <ButtonLink href="/mentoria?aba=recebidas" size="lg" variant="outline">
          <HeartHandshake aria-hidden="true" />
          Ver pedidos de mentoria
        </ButtonLink>
      ) : (
        <ButtonLink href="/papers" size="lg" variant="outline">
          <BookOpen aria-hidden="true" />
          Explorar a Vitrine
        </ButtonLink>
      )}
    </>
  );
}

/** Hero da landing: ilha de tema escuro sobre violeta-950 com o padrão de constelação. */
export function LandingHero({ viewer }: { viewer: LandingViewer | null }) {
  const greeting = viewer?.firstName
    ? viewer.onboarded
      ? `Que bom te ver, ${viewer.firstName}.`
      : `Boas-vindas, ${viewer.firstName}! Falta pouco para entrar na rede.`
    : null;

  return (
    <section
      data-theme="dark"
      aria-labelledby="hero-titulo"
      className="relative isolate overflow-hidden bg-violeta-950 text-fg"
    >
      <ConstellationPattern
        density="high"
        align="end"
        className="absolute inset-x-0 bottom-0 -z-10 h-64 w-full [mask-image:linear-gradient(to_bottom,transparent,black_75%)] text-violeta-300/45 lg:inset-0 lg:h-full lg:[mask-image:linear-gradient(100deg,transparent_30%,black_75%)] lg:text-violeta-300/55"
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:pt-24 lg:pb-28">
        <div className="grid content-start gap-6">
          <p className="eyebrow text-violeta-200">{SITE.theme} · rede de apoio, mentoria e visibilidade</p>
          <h1 id="hero-titulo" className="font-display text-display font-bold text-white">
            Ciência também é{" "}
            <span className="font-serif font-semibold text-ambar-300 italic">delas</span>.
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-violeta-100">
            Conectamos pesquisadoras iniciantes a mentoras experientes, damos visibilidade a papers
            escritos por mulheres e mantemos um fórum seguro para quem faz ciência no Brasil.
          </p>
          {greeting && <p className="font-semibold text-white">{greeting}</p>}
          <div className="flex flex-wrap gap-3">
            <HeroActions viewer={viewer} />
          </div>
        </div>

        <div className="relative rounded-dialog border border-white/12 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8">
          <h2 className="mb-6 eyebrow text-violeta-200">O que fazemos juntas</h2>
          <ol className="relative grid gap-7">
            {/* linha da constelação ligando as três estrelas */}
            <span
              aria-hidden="true"
              className="absolute top-3 bottom-3 left-[0.6875rem] w-px bg-linear-to-b from-violeta-300/70 via-violeta-300/40 to-ambar-300/80"
            />
            {VERBS.map((verb, i) => (
              <li key={verb.title} className="relative grid grid-cols-[1.5rem_1fr] gap-4">
                <span
                  aria-hidden="true"
                  className="relative mt-1 flex size-6 items-center justify-center"
                >
                  <span
                    className={
                      i === VERBS.length - 1
                        ? "size-4 rounded-full bg-ambar-400 shadow-[0_0_0_6px_rgb(255_178_74/0.18)]"
                        : "size-3 rounded-full bg-violeta-200 shadow-[0_0_0_5px_rgb(203_174_255/0.14)]"
                    }
                  />
                </span>
                <div className="grid gap-1">
                  <h3 className="font-display text-xl font-semibold text-white">{verb.title}</h3>
                  <p className="text-[0.9375rem] leading-relaxed text-violeta-100">{verb.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
