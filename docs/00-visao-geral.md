# Visão geral do produto

> **Artemis** — rede de apoio, mentoria e visibilidade para mulheres na ciência.
> Projeto do Hackathon IFSP Câmpus Jacareí 2026, tema *Ciência Delas*.

## O problema

Mulheres que começam na pesquisa — na iniciação científica, no técnico integrado, na graduação ou na
pós — costumam enfrentar os mesmos obstáculos:

- **Falta de referências próximas.** É difícil encontrar uma pesquisadora mais experiente, da mesma área,
  disposta a conversar sobre carreira, bolsas, publicação ou maternidade.
- **Isolamento.** Dúvidas e situações difíceis (como assédio) ficam sem um espaço seguro para serem compartilhadas.
- **Pouca visibilidade.** O trabalho de pesquisadoras circula menos fora dos círculos acadêmicos e quase não chega
  ao público em linguagem acessível.

## A proposta

Um fórum com rede de conexões em três pilares:

| Pilar | O que faz | Onde |
| --- | --- | --- |
| **Fórum seguro** | Discussões por categoria (carreira, bolsas, dúvidas de pesquisa, maternidade, rede de apoio, saúde mental, eventos), reações de apoio, respostas marcadas como solução e publicação **anônima** em temas sensíveis. Só para membras. | `/forum` |
| **Mentoria com IA** | A pesquisadora iniciante preenche o perfil (áreas, palavras-chave, objetivos) e recebe **sugestões de mentoras experientes** com uma explicação do porquê da combinação e temas para a primeira conversa. Depois envia o pedido; a mentora aceita ou recusa. | `/mentoria` |
| **Vitrine + Ranking + Boletim** | Divulgação de papers com autoria feminina, **resumo acessível** (escrito pela autora ou gerado por IA), votos de destaque, **rankings** por semana/mês/ano/sempre e por área, e o **Boletim Delas**, newsletter semanal automática com os destaques. | `/papers`, `/ranking`, `/newsletter` |

## Para quem

- **Pesquisadora iniciante** (ex.: estudante do técnico ou da graduação em iniciação científica, mestranda):
  quer orientação de carreira, entender editais e ter com quem conversar.
- **Mentora** (doutoranda, pós-doc, docente, pesquisadora da indústria): quer retribuir, com controle de quantas
  mentoradas consegue acompanhar.
- **Comunidade e público geral**: lê a vitrine, os rankings e o boletim — sem precisar de conta.
- **Moderação**: recebe denúncias, bloqueia tópicos, oculta conteúdo e protege o espaço.

## Jornada principal (demo de 3 minutos)

1. **Cadastro** → onboarding em 4 passos (sobre você, sua pesquisa, mentoria, privacidade e IA).
2. **Mentoria** → "Encontrar mentoras" → cartões com pontuação de afinidade, motivo e temas de conversa
   → "Pedir mentoria" com mensagem.
3. **Mentora** (outra conta de demonstração) → aceita o pedido → as duas passam a ver o contato uma da outra.
4. **Vitrine** → divulgar um paper pelo DOI (metadados preenchidos automaticamente) → gerar resumo acessível com IA
   → receber destaques → aparecer no **ranking da semana**.
5. **Boletim** → a edição semanal reúne os papers mais destacados, discussões e novas mentoras.

Contas de demonstração e o passo a passo para rodar localmente estão em
[`07-setup-e-deploy.md`](07-setup-e-deploy.md).

## Princípios

1. **Segurança antes de engajamento.** Fórum fechado, anonimato em temas sensíveis, denúncia em todo conteúdo,
   votos só positivos (ver [ADR 0005](adr/0005-votos-somente-positivos.md)).
2. **IA como apoio, não como juíza.** A IA explica e reordena sugestões calculadas de forma transparente; sem chave
   de API, tudo continua funcionando (ver [ADR 0003](adr/0003-ia-gratuita-com-fallback.md)).
3. **Privacidade por padrão.** Consentimento explícito para IA e newsletter, dados mínimos nos prompts, direito de
   exclusão (ver [`/privacidade`](../src/app/privacidade) e [`09-moderacao-e-seguranca.md`](09-moderacao-e-seguranca.md)).
4. **Acessível e inclusiva.** Tipografia Atkinson Hyperlegible, contraste AA nos dois temas, navegação por teclado,
   linguagem no feminino por padrão (ver [`02-design-system.md`](02-design-system.md)).
5. **Custo zero.** Vercel Hobby + Supabase Free + APIs de IA gratuitas + Resend Free.

## Mapa da documentação

| Documento | Conteúdo |
| --- | --- |
| [`01-arquitetura.md`](01-arquitetura.md) | Stack, diagrama, pastas, fluxo de dados, rotas |
| [`02-design-system.md`](02-design-system.md) | Marca, tokens, tipografia, componentes, voz e tom |
| [`03-banco-de-dados.md`](03-banco-de-dados.md) | Modelo de dados, RLS, triggers, RPCs, seed |
| [`04-mentoria-com-ia.md`](04-mentoria-com-ia.md) | Algoritmo de matching, prompts, provedores gratuitos, LGPD |
| [`05-papers-e-ranking.md`](05-papers-e-ranking.md) | Vitrine, votos, fórmulas de ranking, DOI/Crossref |
| [`06-forum.md`](06-forum.md) | Categorias, anonimato, reações, soluções, moderação |
| [`07-setup-e-deploy.md`](07-setup-e-deploy.md) | Rodar localmente, variáveis de ambiente, deploy |
| [`08-newsletter.md`](08-newsletter.md) | Boletim semanal, envio, cron, descadastro |
| [`09-moderacao-e-seguranca.md`](09-moderacao-e-seguranca.md) | Denúncias, papéis, LGPD, checklist de segurança |
| [`10-roadmap.md`](10-roadmap.md) | Próximos passos e ideias |
| [`11-perfis-e-autenticacao.md`](11-perfis-e-autenticacao.md) | Login, onboarding, perfil, diretório |
| [`adr/`](adr/README.md) | Decisões de arquitetura |
