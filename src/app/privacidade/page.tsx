import type { Metadata } from "next";
import Link from "next/link";
import { DocCallout, DocLayout, DocSection, ExternalLink } from "@/components/landing/doc-layout";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Como a Ciência Delas trata dados pessoais segundo a LGPD: dados coletados, finalidades e bases legais, IA, newsletter, compartilhamento, retenção e direitos das titulares.",
  alternates: { canonical: "/privacidade" },
};

const TOC = [
  { id: "resumo", label: "Resumo" },
  { id: "controladora", label: "Quem cuida dos seus dados" },
  { id: "dados", label: "Dados que coletamos" },
  { id: "finalidades", label: "Finalidades e bases legais" },
  { id: "ia", label: "Inteligência artificial" },
  { id: "newsletter", label: "Boletim (newsletter)" },
  { id: "compartilhamento", label: "Com quem compartilhamos" },
  { id: "cookies", label: "Cookies e armazenamento local" },
  { id: "retencao", label: "Por quanto tempo guardamos" },
  { id: "seguranca", label: "Segurança" },
  { id: "direitos", label: "Seus direitos" },
  { id: "menores", label: "Menores de idade" },
  { id: "contato", label: "Contato" },
  { id: "alteracoes", label: "Alterações" },
] as const;

const LGPD_URL = "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm";
const ANPD_URL = "https://www.gov.br/anpd";

export default function PrivacyPage() {
  return (
    <DocLayout
      eyebrow="LGPD"
      title="Política de privacidade"
      description="Como tratamos os seus dados pessoais, em linguagem simples, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
      toc={TOC}
      updatedAt="2026-10-27"
    >
      <DocSection id="resumo" title="Resumo">
        <ul>
          <li>Coletamos só o necessário para a rede funcionar: conta, perfil e o que você publica.</li>
          <li>
            Perfis são visíveis <strong>apenas para membras logadas</strong>. O público vê só a Vitrine de papers, os
            rankings e o Boletim.
          </li>
          <li>
            A IA da mentoria só é usada com o seu <strong>consentimento</strong>, para maiores de 18 anos, e nunca
            recebe seu nome, e-mail ou contatos.
          </li>
          <li>O Boletim exige confirmação por e-mail e tem descadastro em um clique.</li>
          <li>Não vendemos dados, não usamos cookies de publicidade nem ferramentas de rastreamento.</li>
          <li>Você pode acessar, corrigir, exportar ou apagar seus dados a qualquer momento.</li>
        </ul>
      </DocSection>

      <DocSection id="controladora" title="Quem cuida dos seus dados">
        <p>
          A controladora dos dados é a equipe responsável pela Ciência Delas, projeto criado no Hackathon IFSP Câmpus
          Jacareí 2026. Os dados de identificação e o contato da pessoa encarregada estão na seção{" "}
          <a href="#contato">Contato</a>.
        </p>
      </DocSection>

      <DocSection id="dados" title="Dados que coletamos">
        <h3>Que você nos informa</h3>
        <ul>
          <li>
            <strong>Conta:</strong> e-mail e senha (guardada pelo provedor de autenticação apenas como hash — nós nunca
            vemos a sua senha).
          </li>
          <li>
            <strong>Perfil:</strong> nome, pronomes, foto, frase de apresentação, bio, instituição, cidade e UF, etapa
            da carreira, áreas de pesquisa, palavras-chave e links (Lattes, ORCID, LinkedIn, site) — todos opcionais,
            exceto o nome.
          </li>
          <li>
            <strong>Mentoria:</strong> se você busca ou oferece mentoria, objetivos, temas, formatos de encontro,
            idiomas, número de vagas, mensagens dos pedidos e respostas.
          </li>
          <li>
            <strong>Fórum:</strong> tópicos, respostas e reações. Em publicações anônimas, a autoria real fica
            registrada em uma tabela protegida (veja o <Link href="/conduta#anonimato">código de conduta</Link>).
          </li>
          <li>
            <strong>Vitrine:</strong> papers divulgados, destaques (votos) e comentários.
          </li>
          <li>
            <strong>Boletim:</strong> e-mail, áreas de interesse, o texto do consentimento e as datas de confirmação e
            descadastro.
          </li>
          <li>
            <strong>Denúncias:</strong> o que foi denunciado, o motivo e o relato que você escrever.
          </li>
        </ul>
        <h3>Gerados pelo uso</h3>
        <ul>
          <li>Notificações (respostas, pedidos de mentoria, comentários) e o histórico de leitura delas.</li>
          <li>
            Sugestões de mentoria calculadas para você e, com consentimento, uma representação numérica do seu perfil
            (embedding) usada para medir afinidade.
          </li>
          <li>
            Registros técnicos mantidos pelos provedores de infraestrutura (como endereço IP, data e hora de acesso),
            necessários para segurança e funcionamento.
          </li>
        </ul>
        <DocCallout tone="warning" title="Cuidado com dados sensíveis">
          <p>
            Temas como maternidade, saúde mental e assédio podem revelar dados pessoais sensíveis (LGPD, art. 5º, II).
            Você decide o que compartilha: prefira o modo anônimo nesses espaços e nunca publique informações de saúde
            ou de vida íntima de outras pessoas.
          </p>
        </DocCallout>
      </DocSection>

      <DocSection id="finalidades" title="Finalidades e bases legais">
        <div className="prose-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Para quê</th>
                <th scope="col">Dados</th>
                <th scope="col">Base legal (LGPD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Criar e manter sua conta e o seu perfil na rede</td>
                <td>Conta e perfil</td>
                <td>Execução do contrato com você (art. 7º, V)</td>
              </tr>
              <tr>
                <td>Fórum, pedidos de mentoria, Vitrine e notificações</td>
                <td>O que você publica e envia</td>
                <td>Execução do contrato (art. 7º, V)</td>
              </tr>
              <tr>
                <td>Sugestões de mentoria com IA e afinidade por embeddings</td>
                <td>Dados de pesquisa do perfil, sem identificação direta</td>
                <td>Consentimento (art. 7º, I), revogável a qualquer momento</td>
              </tr>
              <tr>
                <td>Sugestões de mentoria sem IA (regras internas)</td>
                <td>Áreas, temas, etapa da carreira e vagas</td>
                <td>Execução do contrato (art. 7º, V)</td>
              </tr>
              <tr>
                <td>Envio do Boletim semanal</td>
                <td>E-mail e áreas de interesse</td>
                <td>Consentimento (art. 7º, I)</td>
              </tr>
              <tr>
                <td>Moderação, prevenção de abuso e segurança</td>
                <td>Denúncias, conteúdo denunciado, autoria anônima, registros técnicos</td>
                <td>Legítimo interesse (art. 7º, IX) e proteção das membras</td>
              </tr>
              <tr>
                <td>Cumprir obrigações legais e atender autoridades</td>
                <td>O mínimo exigido</td>
                <td>Obrigação legal (art. 7º, II)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Não usamos seus dados para publicidade nem para decisões que produzam efeitos jurídicos sobre você.</p>
      </DocSection>

      <DocSection id="ia" title="Inteligência artificial">
        <p>
          A mentoria pode usar serviços de IA de terceiros para sugerir e explicar combinações entre mentoranda e
          mentoras, e para gerar resumos em linguagem simples de papers públicos. Regras que seguimos:
        </p>
        <ul>
          <li>
            <strong>Consentimento explícito e 18 anos ou mais.</strong> A caixa de consentimento no onboarding e no
            perfil vem desmarcada. Os termos do plano gratuito do Google Gemini exigem maioridade.
          </li>
          <li>
            <strong>Dados mínimos e pseudonimizados.</strong> Enviamos etapa da carreira, áreas, palavras-chave, temas
            e objetivos de mentoria, com contatos removidos do texto. Nunca enviamos nome, e-mail, telefone, instituição,
            cidade, links, foto ou identificadores reais: as candidatas aparecem para a IA como “c1”, “c2”… e o
            servidor faz a correspondência depois.
          </li>
          <li>
            <strong>Mentoras sem consentimento</strong> entram na análise apenas com dados de classificação (áreas,
            temas, etapa), sem nenhum texto escrito por elas.
          </li>
          <li>
            <strong>Uso pelo provedor.</strong> No plano gratuito do Google Gemini, o Google pode usar prompts e
            respostas para melhorar os produtos dele, inclusive com revisão humana. O Groq informa que não usa dados da
            API para treinar modelos; no OpenRouter, a política depende do modelo gratuito escolhido. Por isso
            enviamos só o mínimo, sem identificação direta.
          </li>
          <li>
            <strong>A decisão é sua.</strong> A IA só sugere e explica; quem escolhe a mentora e quem aceita o pedido
            são pessoas. Conteúdo gerado por IA é sempre sinalizado.
          </li>
          <li>
            <strong>Revogação.</strong> Desmarque o consentimento em <Link href="/perfil">Meu perfil</Link> quando
            quiser: a análise do seu perfil (embedding) é apagada automaticamente e as sugestões passam a ser
            calculadas só com regras dentro da plataforma.
          </li>
        </ul>
      </DocSection>

      <DocSection id="newsletter" title="Boletim (newsletter)">
        <ul>
          <li>
            A inscrição exige marcar uma caixa de consentimento (que vem desmarcada) e confirmar pelo link enviado ao
            seu e-mail (confirmação dupla).
          </li>
          <li>Guardamos o texto exato do consentimento aceito e as datas de inscrição e confirmação.</li>
          <li>
            Todo e-mail tem um link de descadastro e suporta o descadastro em um clique do seu provedor de e-mail. Na
            página de descadastro você também pode pedir a exclusão do seu cadastro.
          </li>
          <li>
            As edições são públicas e reúnem papers da Vitrine, títulos de discussões do fórum (nunca das categorias que
            aceitam anonimato) e o nome e a frase de apresentação de novas mentoras da rede.
          </li>
        </ul>
      </DocSection>

      <DocSection id="compartilhamento" title="Com quem compartilhamos">
        <p>
          Não vendemos nem alugamos dados. Usamos fornecedores (operadores, na linguagem da LGPD) que tratam dados em
          nosso nome, cada um só para a sua função:
        </p>
        <div className="prose-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Fornecedor</th>
                <th scope="col">Função</th>
                <th scope="col">Dados envolvidos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Banco de dados, autenticação e armazenamento de fotos</td>
                <td>Todos os dados da plataforma</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Hospedagem do site e tarefa agendada do Boletim</td>
                <td>Requisições e registros técnicos</td>
              </tr>
              <tr>
                <td>Google (Gemini), Groq ou OpenRouter</td>
                <td>IA da mentoria e dos resumos — só com consentimento</td>
                <td>Dados de pesquisa pseudonimizados; textos de papers públicos</td>
              </tr>
              <tr>
                <td>Resend</td>
                <td>Envio dos e-mails do Boletim</td>
                <td>E-mail da inscrita e conteúdo da edição</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Alguns desses serviços armazenam dados fora do Brasil. Nesses casos, a transferência internacional se apoia
          nas garantias contratuais dos fornecedores (LGPD, art. 33). Também podemos compartilhar dados quando exigido
          por lei ou ordem judicial.
        </p>
        <p>
          Entre membras: seu perfil (sem e-mail) é visível para quem está logada. O seu e-mail só é mostrado à outra
          participante de uma mentoria <strong>aceita</strong>.
        </p>
      </DocSection>

      <DocSection id="cookies" title="Cookies e armazenamento local">
        <ul>
          <li>
            <strong>Cookies essenciais de sessão</strong>, do provedor de autenticação, para manter você conectada.
            Sem eles não é possível entrar na rede.
          </li>
          <li>
            <strong>Preferência de tema</strong> (claro, escuro ou automático), guardada só no seu navegador
            (armazenamento local).
          </li>
        </ul>
        <p>Não usamos cookies de publicidade, de análise de audiência ou de redes sociais.</p>
      </DocSection>

      <DocSection id="retencao" title="Por quanto tempo guardamos">
        <ul>
          <li>
            <strong>Conta e perfil:</strong> enquanto a conta existir. Ao excluir a conta, apagamos o perfil e, em
            cascata, publicações, votos, comentários, pedidos de mentoria, sugestões, notificações e a autoria das suas
            publicações anônimas (que também são apagadas).
          </li>
          <li>
            <strong>Boletim:</strong> até você se descadastrar ou pedir a exclusão do cadastro.
          </li>
          <li>
            <strong>Denúncias:</strong> pelo tempo necessário para a segurança da comunidade e o histórico da
            moderação; denúncias feitas por uma conta excluída são apagadas junto com ela.
          </li>
          <li>
            <strong>Registros técnicos e cópias de segurança</strong> dos fornecedores: pelos prazos deles e, quando
            aplicável, pelos prazos legais (como o do Marco Civil da Internet).
          </li>
        </ul>
      </DocSection>

      <DocSection id="seguranca" title="Segurança">
        <p>
          Todo o tráfego usa HTTPS. No banco, cada tabela tem regras de acesso por linha (Row Level Security): você só
          lê o que tem permissão e só altera o que é seu. Chaves de serviço ficam apenas no servidor. A IA é chamada só
          pelo servidor, e os registros de erro não guardam prompts nem respostas. Nenhum sistema é infalível: se
          notarmos um incidente que possa trazer risco a você, avisaremos e comunicaremos a ANPD, como manda a lei.
        </p>
      </DocSection>

      <DocSection id="direitos" title="Seus direitos">
        <p>
          A LGPD (art. 18) garante a você, a qualquer momento e de graça: confirmação de que tratamos seus dados;
          acesso; correção de dados incompletos ou errados; anonimização, bloqueio ou eliminação de dados
          desnecessários; portabilidade; eliminação dos dados tratados com consentimento; informação sobre com quem
          compartilhamos; informação sobre a possibilidade de não consentir; e revogação do consentimento. Você também
          pode se opor a tratamentos e pedir revisão de decisões automatizadas (art. 20).
        </p>
        <p>Como exercer:</p>
        <ul>
          <li>
            Corrigir dados e revogar o consentimento de IA: em <Link href="/perfil">Meu perfil</Link>.
          </li>
          <li>Cancelar o Boletim: pelo link no rodapé de qualquer edição.</li>
          <li>
            Acesso, cópia dos dados, exclusão da conta ou qualquer outro pedido: pelo contato abaixo. Respondemos em
            até 15 dias.
          </li>
        </ul>
        <p>
          Se não ficar satisfeita, você pode reclamar à Autoridade Nacional de Proteção de Dados (
          <ExternalLink href={ANPD_URL}>ANPD</ExternalLink>). Texto completo da lei:{" "}
          <ExternalLink href={LGPD_URL}>Lei nº 13.709/2018</ExternalLink>.
        </p>
      </DocSection>

      <DocSection id="menores" title="Menores de idade">
        <ul>
          <li>A plataforma não é destinada a crianças (menores de 12 anos).</li>
          <li>
            Adolescentes (de 12 a 17 anos), como estudantes do ensino médio ou técnico, só devem participar com
            autorização e acompanhamento de mãe, pai ou responsável legal, sempre no seu melhor interesse (LGPD, art.
            14).
          </li>
          <li>
            Menores de 18 anos <strong>não devem</strong> ativar os recursos de IA nem se inscrever no Boletim: as duas
            caixas de consentimento exigem a declaração de 18 anos ou mais.
          </li>
          <li>Se soubermos que uma conta viola essas regras, poderemos suspendê-la e apagar os dados.</li>
        </ul>
      </DocSection>

      <DocSection id="contato" title="Contato">
        <DocCallout title="Dados da controladora (a preencher pela equipe)">
          <p>
            <strong>Controladora:</strong> [nome da equipe ou instituição responsável pela Ciência Delas]
          </p>
          <p>
            <strong>Encarregada pelo tratamento de dados (DPO):</strong> [nome] — [e-mail de contato]
          </p>
          <p>
            Enquanto esses dados não forem publicados, use o repositório do projeto, indicado na página{" "}
            <Link href="/sobre#codigo">Sobre</Link>.
          </p>
        </DocCallout>
      </DocSection>

      <DocSection id="alteracoes" title="Alterações">
        <p>
          Podemos atualizar esta política para refletir mudanças na plataforma ou na lei. A data no topo mostra a
          última revisão. Mudanças relevantes serão avisadas na plataforma e, se envolverem novos usos de dados
          baseados em consentimento, pediremos um novo consentimento.
        </p>
      </DocSection>
    </DocLayout>
  );
}
