import { BookOpen, HeartHandshake, MessagesSquare, Sparkles, Users } from "lucide-react";
import { Stat, StatGroup } from "@/components/ui/stat";
import type { PlatformStats } from "./data";

/** Números reais da plataforma (RPC get_platform_stats). Sem dados, a seção não aparece. */
export function LandingStats({ stats }: { stats: PlatformStats | null }) {
  if (!stats) return null;
  const items = [
    { label: "pesquisadoras na rede", value: stats.members, icon: <Users aria-hidden="true" /> },
    { label: "mentoras", value: stats.mentors, icon: <HeartHandshake aria-hidden="true" /> },
    {
      label: "mentorias iniciadas",
      value: stats.mentorships,
      icon: <Sparkles aria-hidden="true" />,
    },
    { label: "papers na Vitrine", value: stats.papers, icon: <BookOpen aria-hidden="true" /> },
    {
      label: "conversas no fórum",
      value: stats.threads,
      icon: <MessagesSquare aria-hidden="true" />,
    },
  ];
  return (
    <section
      aria-labelledby="numeros-titulo"
      className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6 lg:px-8"
    >
      <h2 id="numeros-titulo" className="sr-only">
        A rede em números
      </h2>
      <StatGroup className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, i) => (
          <Stat
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}
          />
        ))}
      </StatGroup>
      <p className="mt-3 text-center text-sm text-fg-subtle">
        Números da própria plataforma, atualizados a cada visita.
      </p>
    </section>
  );
}
