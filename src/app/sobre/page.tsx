import type { Metadata } from "next";
import Link from "next/link";
import { DocCallout, DocLayout, DocSection, ExternalLink } from "@/components/landing/doc-layout";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sobre o projeto",
  description:
    "Missão, problema, funcionamento e tecnologia da Artemis — rede de apoio, mentoria e visibilidade para mulheres na ciência, criada no Hackathon IFSP Jacareí 2026.",
  alternates: { canonical: "/sobre" },
};

const TOC = [
  { id: "missao", label: "Nossa missão" },
  { id: "problema", label: "O problema" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "para-quem", label: "Para quem" },
  { id: "principios", label: "Princípios" },
  { id: "tecnologia", label: "Tecnologia" },
  { id: "equipe", label: "Equipe do hackathon" },
  { id: "codigo", label: "Código e documentação" },
] as const;

const UN_SOURCE = "https://www.un.org/en/observances/women-and-girls-in-science-day";

export default function AboutPage() {
  return (
    <DocLayout
      eyebrow="Sobre"
      title="Ciência também é delas"
      description="Uma rede de apoio, mentoria e visibilidade para mulheres na ciência, criada no Hackathon IFSP Câmpus Jacareí 2026."
      toc={TOC}
      updatedAt="2026-10-28"
    >
      <DocSection id="missao" title="Nossa missão">
        <p>
          Queremos que nenhuma pesquisadora comece — ou continue — a carreira sozinha. A Artemis
          conecta quem está chegando à pesquisa com mulheres que já trilharam esse caminho, oferece
          um espaço seguro para conversar sobre o que costuma ficar em silêncio e dá visibilidade ao
          trabalho científico feito por mulheres.
        </p>
        <p>
          Cada cientista é uma estrela; mentoria, colaboração e reconhecimento desenham
          constelações. É daí que vem a identidade visual da plataforma.
        </p>
      </DocSection>

      <DocSection id="problema" title="O problema">
        <p>
          Segundo a UNESCO, as mulheres são menos de um terço das pessoas que fazem pesquisa no
          mundo (
          <ExternalLink href={UN_SOURCE}>
            ONU — Dia Internacional das Mulheres e Meninas na Ciência
          </ExternalLink>
          ). Quem começa na iniciação científica, no ensino técnico, na graduação ou na pós costuma
          esbarrar nos mesmos obstáculos:
        </p>
        <ul>
          <li>
            <strong>Falta de referências próximas.</strong> É difícil encontrar uma pesquisadora
            mais experiente, da mesma área, disposta a conversar sobre carreira, bolsas, publicação
            ou maternidade.
          </li>
          <li>
            <strong>Isolamento.</strong> Dúvidas e situações difíceis, como assédio, ficam sem um
            espaço seguro para serem compartilhadas.
          </li>
          <li>
            <strong>Pouca visibilidade.</strong> O trabalho de pesquisadoras circula menos fora dos
            círculos acadêmicos e quase não chega ao público em linguagem acessível.
          </li>
        </ul>
      </DocSection>

      <DocSection id="como-funciona" title="Como funciona">
        <h3>Fórum seguro</h3>
        <p>
          Discussões por categoria — apresentações, carreira acadêmica, bolsas e editais, dúvidas de
          pesquisa, maternidade e cuidado, rede de apoio, saúde mental e eventos. O fórum é só para
          membras. Nos temas sensíveis é possível publicar de forma <strong>anônima</strong>, e todo
          conteúdo pode ser denunciado à moderação. Veja o{" "}
          <Link href="/conduta">código de conduta</Link>.
        </p>
        <h3>Mentoria com IA</h3>
        <p>
          A pesquisadora iniciante conta sobre a pesquisa no perfil (áreas, palavras-chave,
          objetivos) e recebe sugestões de mentoras com uma nota de afinidade, o motivo da
          combinação e temas para a primeira conversa. Depois envia o pedido; a mentora aceita ou
          recusa conforme as vagas que ela mesma definiu. O e-mail de cada uma só aparece para a
          outra depois do aceite.
        </p>
        <p>
          As sugestões funcionam para toda pesquisadora que ativa “Quero ser mentorada”: a afinidade
          é calculada por regras transparentes dentro da própria plataforma, sem enviar dados a
          terceiros. A IA é opcional e só entra com consentimento explícito (e para maiores de 18
          anos): com uma chave de IA configurada, ela compara o sentido dos perfis de pesquisa
          (embeddings), reordena as combinações e explica cada uma; sem chave — ou se a IA falhar —
          valem as regras. Os detalhes estão na{" "}
          <Link href="/privacidade#ia">política de privacidade</Link>.
        </p>
        <h3>Vitrine, Ranking e Boletim</h3>
        <p>
          A <Link href="/papers">Vitrine</Link> reúne papers com autoria de mulheres, com resumo em
          linguagem simples (escrito pela autora ou gerado por IA e sinalizado). A comunidade dá{" "}
          <strong>destaques</strong> — votos só positivos — e o <Link href="/ranking">ranking</Link>{" "}
          mostra os mais destacados por semana, mês, ano, de todos os tempos e “em alta”. Toda
          segunda-feira o <Link href="/newsletter">Boletim Delas</Link> reúne os destaques da
          semana.
        </p>
      </DocSection>

      <DocSection id="para-quem" title="Para quem">
        <ul>
          <li>
            <strong>Pesquisadoras iniciantes</strong> — estudantes do técnico, da graduação, do
            mestrado e do doutorado que querem orientação de carreira, entender editais e ter com
            quem conversar.
          </li>
          <li>
            <strong>Mentoras</strong> — doutorandas, pós-docs, docentes e pesquisadoras da indústria
            que querem retribuir, com controle de quantas mentoradas conseguem acompanhar.
          </li>
          <li>
            <strong>Público em geral</strong> — que pode ler a Vitrine, os rankings e o Boletim sem
            precisar de conta.
          </li>
          <li>
            <strong>Moderação</strong> — que recebe denúncias, tranca tópicos, oculta conteúdo e
            protege o espaço.
          </li>
        </ul>
      </DocSection>

      <DocSection id="principios" title="Princípios">
        <ol>
          <li>
            <strong>Segurança antes de engajamento.</strong> Fórum fechado, anonimato em temas
            sensíveis, denúncia em todo conteúdo e votos só positivos.
          </li>
          <li>
            <strong>IA como apoio, não como juíza.</strong> A IA explica e reordena sugestões
            calculadas de forma transparente; a decisão é sempre da pessoa. Sem chave de API ou sem
            autorização, tudo continua funcionando.
          </li>
          <li>
            <strong>Privacidade por padrão.</strong> Consentimento explícito para IA e newsletter,
            dados mínimos nos prompts e direito de exclusão.
          </li>
          <li>
            <strong>Acessível e inclusiva.</strong> Fonte Atkinson Hyperlegible, contraste WCAG AA
            nos temas claro e escuro, navegação por teclado e linguagem no feminino por padrão.
          </li>
          <li>
            <strong>Custo zero.</strong> Tudo roda nos planos gratuitos de hospedagem, banco de
            dados, IA e e-mail.
          </li>
        </ol>
      </DocSection>

      <DocSection id="tecnologia" title="Tecnologia">
        <div className="prose-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Camada</th>
                <th scope="col">O que usamos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Aplicação</td>
                <td>
                  Next.js 16 (App Router, Server Actions), React 19, TypeScript e Tailwind CSS 4
                </td>
              </tr>
              <tr>
                <td>Banco e autenticação</td>
                <td>
                  Supabase: Postgres com Row Level Security em todas as tabelas, Auth (e-mail e
                  senha, link mágico), Storage para avatares e pgvector para a afinidade de perfis
                </td>
              </tr>
              <tr>
                <td>Inteligência artificial</td>
                <td>
                  Google Gemini (plano gratuito), com Groq e OpenRouter como reserva — chamados só
                  pelo servidor, com dados pseudonimizados e só com consentimento. Sem chave ou sem
                  autorização, as sugestões usam regras transparentes da própria plataforma
                </td>
              </tr>
              <tr>
                <td>E-mail</td>
                <td>Resend para o Boletim, com confirmação dupla e descadastro em um clique</td>
              </tr>
              <tr>
                <td>Hospedagem</td>
                <td>Vercel, com uma tarefa agendada semanal que monta e envia o Boletim</td>
              </tr>
              <tr>
                <td>Design</td>
                <td>
                  Design system Artemis, com tokens de cor verificados em WCAG AA —{" "}
                  <Link href="/design-system">veja o guia vivo</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="equipe" title="Equipe do hackathon">
        <p>
          A Artemis foi criada por uma equipe no Hackathon do IFSP Câmpus Jacareí 2026, com o tema “
          {SITE.theme}”.
        </p>
        <DocCallout title="Espaço reservado para a equipe">
          <p>
            Nomes, cursos e contatos das integrantes serão preenchidos pela equipe antes da
            apresentação final. Para editar, altere <code>src/app/sobre/page.tsx</code>.
          </p>
        </DocCallout>
      </DocSection>

      <DocSection id="codigo" title="Código e documentação">
        <p>
          O projeto é de código aberto, sob licença MIT. Contribuições e sugestões são bem-vindas.
        </p>
        <ul>
          <li>
            <ExternalLink href={SITE.repoUrl}>Repositório no GitHub</ExternalLink>
          </li>
          <li>
            <ExternalLink href={`${SITE.repoUrl}/tree/main/docs`}>
              Documentação técnica (pasta docs)
            </ExternalLink>
          </li>
          <li>
            <Link href="/design-system">Design system Artemis</Link>
          </li>
          <li>
            <Link href="/conduta">Código de conduta</Link> e{" "}
            <Link href="/privacidade">política de privacidade</Link>
          </li>
        </ul>
      </DocSection>
    </DocLayout>
  );
}
