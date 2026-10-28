# Visão geral do produto

> **Artemis** — rede de apoio, mentoria e visibilidade para mulheres na ciência.
> Projeto do Hackathon IFSP Câmpus Jacareí 2026, tema _Ciência Delas_.

## O problema

Mulheres que começam na pesquisa — na iniciação científica, no técnico integrado, na graduação ou na
pós — costumam enfrentar os mesmos obstáculos:

- **Falta de referências próximas.** É difícil encontrar uma pesquisadora mais experiente, da mesma área,
  disposta a conversar sobre carreira, bolsas, publicação ou maternidade.
- **Isolamento.** Dúvidas e situações difíceis (como assédio) ficam sem um espaço seguro para serem compartilhadas.
- **Pouca visibilidade.** O trabalho de pesquisadoras circula menos fora dos círculos acadêmicos e quase não chega
  ao público em linguagem acessível.
- **Mentoria invisível.** Quem mentora dedica tempo sem nenhum reconhecimento, e ninguém consegue dizer se a
  mentoria ajudou.

## A proposta

Um fórum com rede de conexões em três pilares:

| Pilar                           | O que faz                                                                                                                                                                                                                                                    | Onde                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **Fórum seguro**                | Discussões por categoria (carreira, bolsas, dúvidas de pesquisa, maternidade, rede de apoio, saúde mental, eventos), reações de apoio, respostas marcadas como solução e publicação **anônima** em temas sensíveis. Só para membras.                         | `/forum`                             |
| **Mentoria com IA**             | A pesquisadora iniciante preenche o perfil (áreas, palavras-chave, objetivos) e recebe **sugestões de mentoras experientes** com uma explicação do porquê da combinação e temas para a primeira conversa. Depois envia o pedido; a mentora aceita ou recusa. | `/mentoria`                          |
| **Vitrine + Ranking + Boletim** | Divulgação de papers com autoria feminina, **resumo acessível** (escrito pela autora ou gerado por IA), votos de destaque, **rankings** por semana/mês/ano/sempre e por área, e o **Boletim Delas**, newsletter semanal automática com os destaques.         | `/papers`, `/ranking`, `/newsletter` |

E quatro funcionalidades que ligam os pilares numa única história, "da primeira curiosidade à mentoria
reconhecida" — todas funcionam **sem nenhuma chave de IA**:

| Funcionalidade                 | O que faz                                                                                                                               | Onde                          | Documento                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| **Pergunte a uma cientista**   | A estudante que ainda não pesquisa pergunta sem conta e sem nome; a moderação publica e cientistas da rede respondem em público.        | `/pergunte`                   | [`16-pergunte-a-uma-cientista.md`](16-pergunte-a-uma-cientista.md)     |
| **Afinidade de trajetória**    | Marcas opcionais ("fui a primeira da família na universidade") viram um bônus explicado na sugestão de mentoras: "Vocês têm em comum…". | `/mentoria`, `/pesquisadoras` | [`17-afinidade-de-trajetoria.md`](17-afinidade-de-trajetoria.md)       |
| **Meu painel**                 | O início de quem já é da rede: próximos passos e o que está esperando por ela, em vez da página de apresentação.                        | `/painel`                     | [`14-painel-e-modo-demo.md`](14-painel-e-modo-demo.md)                 |
| **Reconhecimento da mentoria** | Retorno privado ao concluir, declaração de participação verificável por QR code e impacto agregado (só a partir de 5 retornos).         | `/verificar`                  | [`15-reconhecimento-da-mentoria.md`](15-reconhecimento-da-mentoria.md) |

## Para quem

- **Estudante curiosa** (ensino médio, técnico integrado, começo da graduação): ainda não pesquisa, tem dúvidas
  sobre ciência e carreira e pergunta a uma cientista sem criar conta.
- **Pesquisadora iniciante** (ex.: estudante do técnico ou da graduação em iniciação científica, mestranda):
  quer orientação de carreira, entender editais e ter com quem conversar.
- **Mentora** (doutoranda, pós-doc, docente, pesquisadora da indústria): quer retribuir, com controle de quantas
  mentoradas consegue acompanhar.
- **Comunidade e público geral**: lê a vitrine, os rankings, o boletim e as respostas do Pergunte a uma
  cientista, e confere declarações de mentoria — sem precisar de conta.
- **Moderação**: recebe denúncias, bloqueia tópicos, oculta conteúdo e protege o espaço.

## Jornada principal (demo de 3 minutos)

A história do pitch: **da primeira curiosidade à mentoria reconhecida**. Com `DEMO_MODE=true`, a plateia entra
como uma persona fictícia em [`/demo`](14-painel-e-modo-demo.md) (um clique, sem senha; o QR code da página leva
para lá).

1. **Pergunte a uma cientista** (`/pergunte`) → uma estudante do técnico pergunta sem conta e sem nome → a
   moderação publica → uma cientista da rede responde em público.
2. **Matching com "Vocês têm em comum"** → a Larissa abre `/mentoria`, "Encontrar mentoras" → os cartões trazem a
   pontuação, o motivo e, quando há marcas em comum, "Vocês têm em comum: as duas foram as primeiras da família na
   universidade" — sem IA → "Pedir mentoria" com mensagem.
3. **Meu painel** (`/painel`) → a Marina (mentora) vê o pedido esperando por ela, perguntas do fórum que combinam
   com a pesquisa dela e as perguntas de estudantes sem resposta.
4. **Conclusão → retorno → declaração → `/verificar`** → a Débora concluiu a mentoria com a Patrícia, deixou o
   retorno privado e as duas autorizaram a declaração → o QR code abre `/verificar/ART-7K2M-Q9XD-4HNP`
   ("Declaração válida", dados de demonstração) → a landing mostra o impacto agregado.

Também dá para mostrar: a **Vitrine** (divulgar um paper pelo DOI, resumo acessível, destaques e **ranking da
semana**) e o **Boletim** semanal.

Contas de demonstração e o passo a passo para rodar localmente estão em
[`07-setup-e-deploy.md`](07-setup-e-deploy.md); o checklist da apresentação, em
[`13-proximos-passos.md`](13-proximos-passos.md).

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

| Documento                                                              | Conteúdo                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`01-arquitetura.md`](01-arquitetura.md)                               | Stack, diagrama, pastas, fluxo de dados, rotas             |
| [`02-design-system.md`](02-design-system.md)                           | Marca, tokens, tipografia, componentes, voz e tom          |
| [`03-banco-de-dados.md`](03-banco-de-dados.md)                         | Modelo de dados, RLS, triggers, RPCs, seed                 |
| [`04-mentoria-com-ia.md`](04-mentoria-com-ia.md)                       | Algoritmo de matching, prompts, provedores gratuitos, LGPD |
| [`05-papers-e-ranking.md`](05-papers-e-ranking.md)                     | Vitrine, votos, fórmulas de ranking, DOI/Crossref          |
| [`06-forum.md`](06-forum.md)                                           | Categorias, anonimato, reações, soluções, moderação        |
| [`07-setup-e-deploy.md`](07-setup-e-deploy.md)                         | Rodar localmente, variáveis de ambiente, deploy            |
| [`08-newsletter.md`](08-newsletter.md)                                 | Boletim semanal, envio, cron, descadastro                  |
| [`09-moderacao-e-seguranca.md`](09-moderacao-e-seguranca.md)           | Denúncias, papéis, LGPD, checklist de segurança            |
| [`10-roadmap.md`](10-roadmap.md)                                       | Próximos passos e ideias                                   |
| [`11-perfis-e-autenticacao.md`](11-perfis-e-autenticacao.md)           | Login, onboarding, perfil, diretório                       |
| [`12-mentoria-fluxos.md`](12-mentoria-fluxos.md)                       | Telas e estados dos pedidos de mentoria                    |
| [`13-proximos-passos.md`](13-proximos-passos.md)                       | O que está pronto e o checklist da apresentação            |
| [`14-painel-e-modo-demo.md`](14-painel-e-modo-demo.md)                 | /painel e modo demonstração (/demo)                        |
| [`15-reconhecimento-da-mentoria.md`](15-reconhecimento-da-mentoria.md) | Retorno, declaração verificável, impacto (k = 5)           |
| [`16-pergunte-a-uma-cientista.md`](16-pergunte-a-uma-cientista.md)     | Perguntas sem conta, moderação, proteção de menores        |
| [`17-afinidade-de-trajetoria.md`](17-afinidade-de-trajetoria.md)       | Marcas de trajetória, bônus no matching, LGPD              |
| [`adr/`](adr/README.md)                                                | Decisões de arquitetura                                    |
