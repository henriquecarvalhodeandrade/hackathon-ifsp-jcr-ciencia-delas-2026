import { Check, X } from "lucide-react";
import { Alert, Badge, Button, ScoreMeter } from "@/components/ui";
import { DsSection, DsSubheading } from "./ds";
import { MentorMatchExample, PaperCardExample } from "./patterns";

export function ThemeCompare() {
  return (
    <DsSection
      id="temas"
      number="09"
      group="Diretrizes"
      title="Claro e escuro"
      description={
        <>
          Os mesmos componentes, lado a lado, em “ilhas” de tema (<code className="font-mono text-base">data-theme</code>{" "}
          em qualquer elemento). O botão de tema no cabeçalho alterna automático → claro → escuro.
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme} data-theme={theme} className="grid gap-4 rounded-dialog border border-border bg-bg p-4 text-fg sm:p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-fg-muted">{theme === "light" ? "Tema claro" : "Tema escuro"}</p>
              <div className="flex gap-1.5">
                <Badge variant="primary">primary</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="accent">accent</Badge>
              </div>
            </div>
            <PaperCardExample />
            <MentorMatchExample />
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="outline">Contorno</Button>
              <ScoreMeter value={76} size="sm" label={`Exemplo no tema ${theme === "light" ? "claro" : "escuro"}`} />
            </div>
            <Alert variant="warning" title="Atenção">
              Prazo do edital termina em 3 dias.
            </Alert>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 text-[0.9375rem] text-fg-muted sm:grid-cols-2">
        <p>
          <strong className="text-fg">Como funciona:</strong> os tokens usam{" "}
          <code className="font-mono text-sm">light-dark()</code> e respondem ao{" "}
          <code className="font-mono text-sm">color-scheme</code> do elemento. Sem escolha salva, segue o sistema
          (inclusive sem JavaScript).
        </p>
        <p>
          <strong className="text-fg">Regra de ouro:</strong> nunca escreva cores fixas (hex, bg-white, text-black) em
          componentes. Se precisar de algo novo, crie um token semântico com os dois valores e verifique o contraste.
        </p>
      </div>
    </DsSection>
  );
}

const VOICE = [
  { title: "Acolhedora", text: "Fala com quem chega como uma colega mais experiente fala: sem jargão desnecessário, sem condescendência." },
  { title: "Direta", text: "Frases curtas, verbo no começo, uma ideia por frase. Diga o que aconteceu e o que fazer agora." },
  { title: "Precisa", text: "Ciência exige rigor: números, datas e nomes certos. Na dúvida, mostre a fonte." },
  { title: "Inclusiva", text: "Feminino por padrão para a comunidade (“pesquisadoras”, “bem-vinda”). Sem “x” ou “@”: leitores de tela não leem." },
] as const;

const DO_DONT: ReadonlyArray<{ context: string; do: string; dont: string }> = [
  {
    context: "Boas-vindas",
    do: "Bem-vinda à Artemis! Conte um pouco da sua pesquisa para encontrarmos mentoras para você.",
    dont: "Bem-vindo(a), usuário! Preencha todos os campos obrigatórios do formulário.",
  },
  {
    context: "Erro",
    do: "Não conseguimos salvar seu perfil. Verifique sua conexão e tente de novo — seu texto continua aqui.",
    dont: "Erro 500: falha na operação.",
  },
  {
    context: "Estado vazio",
    do: "Ainda não há papers nesta área. Que tal indicar o primeiro?",
    dont: "Nenhum resultado encontrado.",
  },
  {
    context: "Botões",
    do: "Pedir mentoria · Destacar paper · Salvar perfil",
    dont: "OK · Clique aqui · Enviar dados",
  },
  {
    context: "IA",
    do: "Sugestão feita com IA a partir das áreas do seu perfil. Revise antes de enviar.",
    dont: "Nossa IA encontrou a mentora perfeita para você!",
  },
  {
    context: "Linguagem inclusiva",
    do: "Pesquisadoras de todas as áreas · Quem pesquisa · Boas-vindas",
    dont: "Todxs xs pesquisadorxs · tod@s",
  },
  {
    context: "Moderação",
    do: "Este comentário foi ocultado por violar o código de conduta.",
    dont: "Conteúdo removido por usuário banido.",
  },
];

export function VoiceTone() {
  return (
    <DsSection
      id="voz"
      number="10"
      group="Diretrizes"
      title="Voz e tom"
      description="A voz é sempre a mesma; o tom se ajusta. Mais leve ao celebrar, mais cuidadoso em erros, assédio ou saúde mental."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VOICE.map((v) => (
          <div key={v.title} className="rounded-card border border-border bg-surface p-5">
            <h3 className="font-display text-lg font-semibold text-fg">{v.title}</h3>
            <p className="mt-1.5 text-[0.9375rem] text-fg-muted">{v.text}</p>
          </div>
        ))}
      </div>

      <DsSubheading>Faça / evite</DsSubheading>
      <div className="grid gap-3">
        {DO_DONT.map((row) => (
          <div key={row.context} className="grid gap-3 rounded-card border border-border bg-surface p-4 md:grid-cols-[10rem_1fr_1fr] md:items-start">
            <p className="eyebrow pt-1 text-fg-subtle">{row.context}</p>
            <p className="flex gap-2.5 text-[0.9375rem] text-fg">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">Faça: </span>
                {row.do}
              </span>
            </p>
            <p className="flex gap-2.5 text-[0.9375rem] text-fg-muted">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                <X aria-hidden="true" className="size-3.5" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">Evite: </span>
                <span className="line-through decoration-danger/50">{row.dont}</span>
              </span>
            </p>
          </div>
        ))}
      </div>

      <DsSubheading>Formatos</DsSubheading>
      <ul className="grid gap-2 text-[0.9375rem] text-fg-muted sm:grid-cols-2">
        <li>
          <strong className="text-fg">Datas:</strong> “27 de out. de 2026” (formatDate) · “há 3 horas” (formatRelativeTime),
          fuso de São Paulo.
        </li>
        <li>
          <strong className="text-fg">Números:</strong> “1.284 pesquisadoras”, “15,3 mil destaques” (formatNumber,
          pluralize).
        </li>
        <li>
          <strong className="text-fg">Títulos:</strong> só a primeira letra maiúscula (“Pedir mentoria”, não “Pedir
          Mentoria”).
        </li>
        <li>
          <strong className="text-fg">Votos:</strong> chamamos de “destaques”; o verbo é “destacar”.
        </li>
      </ul>
    </DsSection>
  );
}

const CHECKLIST = [
  "Um único h1 por página (PageHeader) e títulos em ordem, sem pular níveis.",
  "Todo campo tem <label> visível — use <Field>; placeholder não é rótulo.",
  "Erros de formulário aparecem junto do campo (aria-invalid + aria-describedby) e no topo via <FormMessage>.",
  "Foco sempre visível (outline 2px --color-focus); nunca remova sem substituto.",
  "Tudo funciona só com teclado: Tab, Shift+Tab, Enter, Espaço, Esc e setas em menus/abas.",
  "Botões só com ícone têm aria-label; ícones decorativos têm aria-hidden.",
  "Contraste AA nos dois temas (tabela acima) — não use cor como única forma de informar.",
  "Alvos de toque com pelo menos 24×24px (botões e campos de 40–44px).",
  "Imagens informativas têm alt; avatares ao lado do nome são decorativos (alt vazio).",
  "Animações respeitam prefers-reduced-motion; nada pisca mais de 3 vezes por segundo.",
  "Links que abrem nova aba avisam “(abre em nova aba)” para leitores de tela.",
  "Idioma da página é pt-BR (<html lang>) e trechos em outra língua usam lang=\"en\".",
] as const;

export function AccessibilityChecklist() {
  return (
    <DsSection
      id="acessibilidade"
      number="11"
      group="Diretrizes"
      title="Acessibilidade"
      description="Meta: WCAG 2.2 nível AA. Revise esta lista antes de abrir cada pull request."
    >
      <ul className="grid gap-2 md:grid-cols-2">
        {CHECKLIST.map((item) => (
          <li key={item} className="flex gap-3 rounded-control border border-border bg-surface p-3.5 text-[0.9375rem] text-fg">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </DsSection>
  );
}
