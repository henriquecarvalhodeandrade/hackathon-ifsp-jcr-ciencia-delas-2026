/**
 * Texto do consentimento de IA (docs/04-mentoria-com-ia.md §6.4) — use exatamente este texto
 * em qualquer tela que grave `profiles.ai_consent` (onboarding, /perfil, /mentoria).
 *
 * Decisão do produto: as sugestões de mentoras funcionam SEM este consentimento (regras da
 * própria plataforma, nada sai do servidor). O consentimento só liga (a) a análise semântica do
 * perfil com embeddings do Gemini e (b) a reordenação e as explicações geradas por IA.
 */

export const AI_CONSENT_TITLE =
  "Quero ativar as sugestões de mentoria com inteligência artificial.";

export const AI_CONSENT_TEXT =
  "Declaro que tenho 18 anos ou mais e autorizo a Artemis a enviar meus dados de pesquisa (etapa da carreira, áreas, palavras-chave, temas, frase de apresentação e objetivos de mentoria — ou, se eu for mentora, como posso ajudar —, sem meu nome, e-mail ou contatos) a serviços de IA de terceiros (Google Gemini e, como reserva, Groq ou OpenRouter), para analisar o sentido do meu perfil e explicar as sugestões de mentoria. Sei que, no plano gratuito, o Google pode usar esses dados para melhorar os produtos dele e que posso retirar este consentimento a qualquer momento no meu perfil. Nesse caso, a análise do meu perfil e as sugestões já geradas são apagadas.";

/** O que acontece com e sem a IA, em linguagem simples (exibido acima da caixa de seleção). */
export const AI_MATCHING_EXPLAINER = [
  "Sem autorização, as sugestões de mentoras continuam funcionando: a própria plataforma compara áreas, temas e etapa da carreira, e nenhum dado seu vai para serviços de IA.",
  "Com sua autorização, a IA analisa o sentido do seu perfil de pesquisa (não só palavras iguais), reordena as mentoras mais compatíveis e explica, em poucas frases, por que cada uma combina com você.",
  "Vai para a IA só o necessário: fase da carreira, áreas, palavras-chave, temas, formatos e idiomas, seu título curto e o que você busca (ou oferece, se for mentora) — com códigos no lugar dos nomes e sem e-mails, links ou telefones que estejam no texto.",
  "Nunca vão para a IA: nome, e-mail, instituição, cidade, links, foto, mensagens ou posts do fórum.",
  "Você pode retirar a autorização a qualquer momento no seu perfil — a análise do seu perfil e as sugestões já geradas são apagadas na hora.",
] as const;
