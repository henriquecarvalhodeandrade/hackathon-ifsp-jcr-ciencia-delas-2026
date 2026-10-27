import { careerStageLabel } from "./profile-text";
import type { AreaLookup, MenteeForMatching, RankedMentor } from "./types";

/**
 * Sugestões de "como puxar conversa" sem IA (puro e determinístico). Usadas quando a IA
 * está desligada/falha, ou para completar quando o modelo devolve menos de 2 sugestões.
 */

const TOPIC_STARTERS: Record<string, string> = {
  "carreira-academica": "Que decisões fizeram mais diferença na sua carreira acadêmica até aqui?",
  "bolsas-editais": "Que dicas você daria para montar uma candidatura forte a bolsas e editais?",
  "escrita-cientifica":
    "Como você organiza a escrita de um artigo, do primeiro rascunho à submissão?",
  "pos-graduacao": "O que você gostaria de ter sabido antes de entrar na pós-graduação?",
  internacionalizacao: "Como você se preparou para oportunidades de pesquisa fora do país?",
  "maternidade-ciencia": "Como você equilibra (ou equilibrou) a maternidade e a pesquisa?",
  lideranca: "O que você aprendeu ao liderar ou coordenar uma equipe de pesquisa?",
  "industria-inovacao": "Como é a transição entre a universidade e a indústria na sua experiência?",
  empreendedorismo: "Como surgiu a ideia de empreender a partir da pesquisa?",
  "saude-mental": "Que práticas ajudam você a cuidar da saúde mental durante a pesquisa?",
  "divulgacao-cientifica": "Como você começou a divulgar a sua pesquisa para o público?",
  "programacao-dados":
    "Que ferramentas de programação e análise de dados você recomenda para começar?",
  metodologia: "Como você escolhe a metodologia mais adequada para uma nova pergunta de pesquisa?",
  oratoria: "Como você se prepara para apresentar trabalhos em congressos?",
  networking: "Como você aproveita congressos e eventos para criar contatos?",
};

const GENERIC_STARTERS = [
  "Como costuma funcionar uma mentoria com você (frequência e formato dos encontros)?",
  "Qual conselho você daria para quem está começando agora na pesquisa?",
  "Que desafio da sua trajetória você gostaria de ter enfrentado com mais apoio?",
];

export function buildHeuristicStarters(
  mentee: MenteeForMatching,
  ranked: RankedMentor,
  areas?: AreaLookup,
): string[] {
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    if (s && !out.includes(s) && out.length < 3) out.push(s);
  };

  const areaName = ranked.breakdown.sharedAreaIds.map((id) => areas?.get(id)?.name).find(Boolean);
  if (areaName) push(`Como você começou a pesquisar em ${areaName}?`);

  for (const topic of ranked.breakdown.sharedTopics) push(TOPIC_STARTERS[topic]);

  const keyword = ranked.breakdown.sharedKeywords[0];
  if (keyword) push(`Que tendências você enxerga hoje em ${keyword}?`);

  const gap = ranked.breakdown.seniorityGap;
  const menteeStage = careerStageLabel(mentee.career_stage);
  if (gap !== null && gap > 0 && menteeStage) {
    push(`O que mais ajudou você a avançar depois da etapa de ${menteeStage.toLowerCase()}?`);
  }

  for (const generic of GENERIC_STARTERS) push(generic);
  return out.slice(0, 3);
}
