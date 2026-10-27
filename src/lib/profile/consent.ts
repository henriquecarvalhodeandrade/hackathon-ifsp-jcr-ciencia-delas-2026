/**
 * Texto do consentimento de IA (docs/04-mentoria-com-ia.md §6.4) — use exatamente este texto
 * em qualquer tela que grave `profiles.ai_consent` (onboarding, /perfil, /mentoria).
 */

export const AI_CONSENT_TITLE = "Quero usar a mentoria com inteligência artificial.";

export const AI_CONSENT_TEXT =
  "Declaro que tenho 18 anos ou mais e autorizo a Ciência Delas a enviar meus dados de pesquisa (etapa da carreira, áreas, palavras-chave, temas e objetivos de mentoria, sem meu nome, e-mail ou contatos) a serviços de IA de terceiros (Google Gemini e, como reserva, Groq ou OpenRouter), para sugerir e explicar combinações de mentoria. Sei que, no plano gratuito, o Google pode usar esses dados para melhorar os produtos dele e que posso retirar este consentimento a qualquer momento no meu perfil. Nesse caso, a análise do meu perfil é apagada.";

/** O que acontece com e sem a IA, em linguagem simples (exibido acima da caixa de seleção). */
export const AI_MATCHING_EXPLAINER = [
  "Com sua autorização, uma IA gratuita reordena as mentoras mais compatíveis e explica, em poucas frases, por que cada uma combina com você.",
  "Vai para a IA só o necessário: fase da carreira, áreas, palavras-chave, temas, formatos e idiomas, seu título curto e o que você busca (ou oferece, se for mentora) — com códigos no lugar dos nomes e sem e-mails, links ou telefones que estejam no texto.",
  "Nunca vão para a IA: nome, e-mail, instituição, cidade, links, foto, mensagens ou posts do fórum.",
  "Você pode retirar a autorização a qualquer momento no seu perfil — a análise do seu perfil é apagada na hora.",
] as const;
