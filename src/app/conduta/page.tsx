import type { Metadata } from "next";
import Link from "next/link";
import { DocCallout, DocLayout, DocSection } from "@/components/landing/doc-layout";
import { REPORT_REASONS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Código de conduta",
  description:
    "As regras de convivência da Ciência Delas: acolhimento, respeito, zero tolerância a assédio, anonimato, moderação, como denunciar e consequências.",
  alternates: { canonical: "/conduta" },
};

const TOC = [
  { id: "compromisso", label: "Nosso compromisso" },
  { id: "acolhimento", label: "Acolhimento" },
  { id: "respeito", label: "Respeito no dia a dia" },
  { id: "assedio", label: "Zero tolerância a assédio" },
  { id: "confidencialidade", label: "Confidencialidade dos relatos" },
  { id: "anonimato", label: "Anonimato e moderação" },
  { id: "denunciar", label: "Como denunciar" },
  { id: "consequencias", label: "Consequências" },
  { id: "ajuda", label: "Ajuda fora da plataforma" },
  { id: "atualizacoes", label: "Atualizações" },
] as const;

export default function ConductPage() {
  return (
    <DocLayout
      eyebrow="Comunidade"
      title="Código de conduta"
      description="As regras que mantêm a Ciência Delas um lugar seguro para perguntar, compartilhar e crescer. Valem para o fórum, a mentoria, a Vitrine e qualquer conversa iniciada aqui."
      toc={TOC}
      updatedAt="2026-10-27"
    >
      <DocSection id="compromisso" title="Nosso compromisso">
        <p>
          A Ciência Delas existe para que mulheres na ciência se apoiem. Ao criar uma conta, você se compromete a tratar
          as outras pessoas com respeito, a contribuir de boa-fé e a seguir este código. A moderação tem o dever de
          aplicá-lo com cuidado, coerência e o mínimo de exposição de quem está envolvida.
        </p>
      </DocSection>

      <DocSection id="acolhimento" title="Acolhimento">
        <p>Aqui cabe quem está começando e quem já tem décadas de pesquisa. Na prática, isso significa:</p>
        <ul>
          <li>Não existe pergunta boba. Responda como você gostaria de ter sido respondida no seu primeiro ano.</li>
          <li>Pesquisadoras de todas as áreas, origens, raças, etnias, deficiências, orientações e identidades são bem-vindas — incluindo mulheres trans e pessoas não binárias que se identificam com a comunidade.</li>
          <li>Linguagem simples sempre que possível: explique siglas e termos técnicos.</li>
          <li>Celebre conquistas alheias — publicações, bolsas, defesas — sem comparações.</li>
        </ul>
      </DocSection>

      <DocSection id="respeito" title="Respeito no dia a dia">
        <ul>
          <li>Critique ideias, métodos e argumentos — nunca a pessoa.</li>
          <li>Discorde com evidências e gentileza. Se errar, reconheça; se a outra pessoa errar, corrija com cuidado.</li>
          <li>Respeite o tempo das mentoras: um “não posso agora” é uma resposta legítima.</li>
          <li>Não compartilhe dados pessoais de terceiros (telefone, endereço, prints de conversas privadas) sem autorização.</li>
          <li>Dê crédito: cite autoras, fontes e trabalhos. Só divulgue na Vitrine papers com autoria feminina e informe sua relação com o trabalho.</li>
          <li>Nada de spam, propaganda não solicitada ou correntes. Divulgação de eventos e oportunidades vai na categoria certa.</li>
        </ul>
      </DocSection>

      <DocSection id="assedio" title="Zero tolerância a assédio">
        <p>
          Assédio e discriminação levam à remoção imediata do conteúdo e podem levar à exclusão da conta, sem aviso
          prévio. Não são aceitos, entre outros:
        </p>
        <ul>
          <li>Comentários depreciativos sobre gênero, raça, etnia, orientação sexual, identidade de gênero, deficiência, idade, maternidade, religião, aparência ou origem.</li>
          <li>Investidas sexuais, comentários sobre o corpo ou pedidos de encontro fora do propósito da mentoria.</li>
          <li>Intimidação, ameaças, perseguição dentro ou fora da plataforma, ou insistência depois de um “não”.</li>
          <li>Exposição de quem publicou de forma anônima, ou tentativas de descobrir quem é.</li>
          <li>Desinformação deliberada, plágio ou uso indevido do trabalho de outras pesquisadoras.</li>
        </ul>
      </DocSection>

      <DocSection id="confidencialidade" title="Confidencialidade dos relatos">
        <p>
          Muitas conversas aqui tratam de assédio, maternidade, luto, saúde mental e conflitos com orientação. O que é
          contado no fórum fica no fórum:
        </p>
        <ul>
          <li>Não copie, fotografe nem repasse relatos para fora da plataforma.</li>
          <li>Não cite publicamente detalhes que permitam identificar a pessoa ou a instituição envolvida.</li>
          <li>As mensagens trocadas num pedido de mentoria são vistas só pelas duas participantes.</li>
          <li>A moderação só acessa informações sensíveis quando necessário para resolver uma denúncia.</li>
        </ul>
      </DocSection>

      <DocSection id="anonimato" title="Anonimato e moderação">
        <p>
          Nas categorias <strong>Maternidade e cuidado</strong>, <strong>Rede de apoio — assédio e desafios</strong> e{" "}
          <strong>Saúde mental</strong>, você pode publicar tópicos e respostas como <strong>Anônima</strong>. Outras
          membras não conseguem ver quem escreveu.
        </p>
        <DocCallout title="O que o anonimato garante — e o que não garante">
          <p>
            A autoria real fica registrada de forma protegida, para que você continue podendo editar, apagar e receber
            avisos de respostas. A moderação consegue consultar esse registro <strong>apenas para proteger a
            comunidade</strong>, em casos graves como ameaça, assédio ou risco a alguém.
          </p>
          <p>
            Revelar a autoria é uma ação exclusiva de administradoras, exige justificativa e fica registrada na
            denúncia, com nome de quem revelou, data e motivo.
          </p>
        </DocCallout>
        <p>
          A moderação é feita por membras com papel de moderadora ou administradora. Elas podem fixar e trancar
          tópicos, ocultar papers da Vitrine, excluir conteúdo que viole este código e resolver ou arquivar denúncias.
          Moderadoras também seguem este código.
        </p>
      </DocSection>

      <DocSection id="denunciar" title="Como denunciar">
        <p>
          Todo tópico, resposta, paper, comentário e perfil tem o botão <strong>Denunciar</strong>. Escolha o motivo e,
          se quiser, conte o que aconteceu. A denúncia é vista só por você e pela moderação — a pessoa denunciada não
          sabe quem denunciou.
        </p>
        <p>Motivos disponíveis:</p>
        <ul>
          {Object.values(REPORT_REASONS).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p>Depois da denúncia:</p>
        <ol>
          <li>A moderação lê o conteúdo e o contexto da conversa.</li>
          <li>Decide a medida proporcional (veja abaixo) e registra o que foi feito na denúncia.</li>
          <li>A denúncia é marcada como resolvida ou arquivada (quando não há violação).</li>
        </ol>
        <p>
          Se você estiver em perigo, não espere pela moderação: procure os canais da seção{" "}
          <a href="#ajuda">Ajuda fora da plataforma</a>.
        </p>
      </DocSection>

      <DocSection id="consequencias" title="Consequências">
        <p>As medidas são proporcionais à gravidade e ao histórico, e podem ser combinadas:</p>
        <ol>
          <li>
            <strong>Orientação</strong> — uma conversa com a moderação para ajustar o tom ou o local da publicação.
          </li>
          <li>
            <strong>Intervenção no conteúdo</strong> — trancar o tópico, ocultar o paper da Vitrine ou excluir a
            publicação.
          </li>
          <li>
            <strong>Restrição de papel</strong> — perda do papel de moderadora ou de administradora.
          </li>
          <li>
            <strong>Exclusão da conta</strong> — em assédio, ameaças, discriminação ou reincidência.
          </li>
        </ol>
        <p>
          Situações que podem configurar crime são orientadas para os canais oficiais. Decisões da moderação podem ser
          revistas: escreva para a coordenação contando o caso.
        </p>
      </DocSection>

      <DocSection id="ajuda" title="Ajuda fora da plataforma">
        <p>A Ciência Delas é uma rede de apoio, não um serviço de emergência. Se você precisar de ajuda agora:</p>
        <ul>
          <li>
            <strong>Ligue 180</strong> — Central de Atendimento à Mulher, gratuita, 24 horas, para orientar e receber
            denúncias de violência contra a mulher.
          </li>
          <li>
            <strong>190</strong> — Polícia Militar, em situações de risco imediato.
          </li>
          <li>
            <strong>188</strong> — CVV (Centro de Valorização da Vida), apoio emocional gratuito e sigiloso, 24 horas.
          </li>
          <li>
            A ouvidoria, a comissão de ética ou o núcleo de gênero e diversidade da sua instituição, para casos que
            envolvem colegas, orientação ou chefia.
          </li>
        </ul>
      </DocSection>

      <DocSection id="atualizacoes" title="Atualizações">
        <p>
          Este código pode ser atualizado conforme a comunidade cresce; mudanças importantes serão avisadas no fórum.
          Sugestões são bem-vindas — fale com a coordenação pelo contato indicado na{" "}
          <Link href="/privacidade#contato">política de privacidade</Link>.
        </p>
      </DocSection>
    </DocLayout>
  );
}
