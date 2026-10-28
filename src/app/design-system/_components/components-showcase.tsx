import {
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  EllipsisVertical,
  Inbox,
  LogOut,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  ButtonLink,
  Card,
  CategoryIcon,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardLink,
  CardTitle,
  Checkbox,
  Chip,
  ChipGroup,
  ChipLink,
  ChipToggle,
  ConfirmDialog,
  ConstellationPattern,
  Dialog,
  DropdownMenu,
  EmptyState,
  Field,
  FormMessage,
  Input,
  Kbd,
  KeywordInput,
  Logo,
  LogoMark,
  Markdown,
  PageHeader,
  Pagination,
  ProgressMeter,
  RadioGroup,
  ScoreMeter,
  Select,
  Separator,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  Spinner,
  Stat,
  StatGroup,
  Steps,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabNav,
  Tabs,
  Textarea,
  Tooltip,
  VisuallyHidden,
  VoteButton,
} from "@/components/ui";
import { SiteHeaderView } from "@/components/layout/site-header-view";
import { MEETING_FORMATS, MENTORSHIP_TOPIC_OPTIONS } from "@/lib/constants";
import { demoConfirmAction, demoConfirmFailure } from "./actions";
import { DsSection, DsSubheading, Specimen } from "./ds";

const MARKDOWN_SAMPLE = `## Dica para o primeiro edital

Antes de escrever, **leia o edital duas vezes** e marque os critérios de avaliação.

1. Monte um cronograma realista
2. Peça para alguém de fora ler o resumo
3. Revise as referências — formato importa

> "A gente aprende a pedir bolsa pedindo bolsa." — mentora da rede

| Etapa | Prazo |
| --- | --- |
| Rascunho | 2 semanas |
| Revisão | 1 semana |

Código inline: \`p < 0.05\`. Link externo: [Plataforma Lattes](https://lattes.cnpq.br).

- [x] Ler o edital
- [ ] Enviar a proposta
`;

export function ComponentsShowcase() {
  return (
    <DsSection
      id="componentes"
      number="07"
      group="Componentes"
      title="Componentes"
      description={
        <>
          Tudo em <code className="font-mono text-base">@/components/ui</code>. Server Components
          por padrão; os interativos (diálogo, menu, abas, chips com limite, palavras-chave,
          contador) são Client Components e funcionam a partir de páginas de servidor com props
          serializáveis.
        </>
      }
    >
      {/* ---------------- Botões ---------------- */}
      <DsSubheading
        id="c-botoes"
        description="Um único botão primário por área. Verbos no infinitivo: “Salvar perfil”, “Pedir mentoria”."
      >
        Botões
      </DsSubheading>
      <div className="grid gap-4">
        <Specimen label="variant" code={`<Button variant="primary">Pedir mentoria</Button>`}>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Pedir mentoria</Button>
            <Button variant="secondary">Aceitar</Button>
            <Button variant="accent">
              <Star aria-hidden="true" className="fill-current" />
              Destacar
            </Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="ghost">Ver mais</Button>
            <Button variant="danger">
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
            <Button variant="link">Ler o código de conduta</Button>
          </div>
        </Specimen>
        <div className="grid gap-4 lg:grid-cols-2">
          <Specimen label="size" code={`<Button size="sm" /> · md (padrão) · lg · icon · icon-sm`}>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <Button size="icon" variant="outline" aria-label="Buscar">
                <Search aria-hidden="true" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Configurações">
                <Settings aria-hidden="true" />
              </Button>
            </div>
          </Specimen>
          <Specimen
            label="estados"
            code={`<Button loading loadingText="Salvando…">Salvar</Button>`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button loading loadingText="Salvando…">
                Salvar
              </Button>
              <Button disabled>Desabilitado</Button>
              <Button variant="outline" disabled>
                Desabilitado
              </Button>
              <ButtonLink href="/papers" variant="outline">
                Explorar papers
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
            </div>
          </Specimen>
        </div>
        <Specimen
          label="VoteButton (destaque)"
          code={`<form action={toggleVote}><VoteButton type="submit" pressed={voted} count={paper.vote_count} /></form>`}
        >
          <div className="flex flex-wrap items-center gap-6">
            <VoteButton pressed={false} count={41} label="Destacar paper" />
            <VoteButton pressed count={128} label="Destacar paper" />
            <VoteButton pressed={false} count={7} layout="horizontal" label="Destacar paper" />
            <VoteButton pressed count={1} layout="horizontal" label="Destacar paper" />
            <VoteButton pressed={false} count={12} pending label="Destacar paper" />
            <p className="max-w-xs text-sm text-fg-muted">
              Nome fixo (&quot;Destacar&quot;) + <code className="font-mono">aria-pressed</code>: o
              leitor de tela anuncia &quot;pressionado&quot;. Não troque o texto ao alternar.
            </p>
          </div>
        </Specimen>
      </div>

      {/* ---------------- Campos ---------------- */}
      <DsSubheading
        id="c-campos"
        description="Todo campo tem rótulo visível. <Field> liga rótulo, dica e erro ao controle (aria-describedby, aria-invalid)."
      >
        Campos de formulário
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="Input + Field">
          <div className="grid gap-5">
            <Field label="Instituição" hint="Onde você estuda ou trabalha.">
              <Input name="demo_institution" placeholder="Ex.: IFSP campus Jacareí" />
            </Field>
            <Field label="Buscar pesquisadoras" hideLabel>
              <Input
                name="demo_search"
                type="search"
                placeholder="Buscar por nome ou área…"
                leadingIcon={<Search />}
              />
            </Field>
            <Field
              label="ORCID"
              required
              error="O ORCID tem 16 dígitos, no formato 0000-0000-0000-0000."
            >
              <Input name="demo_orcid" defaultValue="0000-0002-12" />
            </Field>
            <Field label="E-mail (não editável)">
              <Input name="demo_email" defaultValue="ana@exemplo.org" disabled />
            </Field>
          </div>
        </Specimen>
        <Specimen label="Textarea · Select">
          <div className="grid gap-5">
            <Field label="Mensagem para a mentora" hint="Entre 20 e 1.500 caracteres." required>
              <Textarea
                name="demo_message"
                maxLength={1500}
                showCount
                rows={4}
                defaultValue="Olá! Estou no mestrado em bioinformática e gostaria de conversar sobre bolsas no exterior."
              />
            </Field>
            <Field label="Formato dos encontros">
              <Select
                name="demo_format"
                placeholder="Selecione…"
                options={Object.entries(MEETING_FORMATS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                defaultValue="online"
              />
            </Field>
            <Field label="Estado" optional>
              <Select name="demo_state" size="sm" options={[{ value: "SP", label: "São Paulo" }]} />
            </Field>
          </div>
        </Specimen>
        <Specimen label="Checkbox · Switch">
          <div className="grid gap-4">
            <Checkbox
              name="demo_c1"
              label="Quero ser mentora"
              description="Você aparece nas sugestões para pesquisadoras iniciantes."
              defaultChecked
            />
            <Checkbox name="demo_c2" label="Busco mentoria" />
            <Checkbox name="demo_c3" label="Opção indisponível" disabled />
            <Separator className="my-1" />
            <Switch name="demo_s1" label="Disponível para novas mentorias" defaultChecked />
            <Switch
              name="demo_s2"
              label="Receber a newsletter semanal"
              description="Toda segunda, com os papers mais destacados."
            />
            <Switch name="demo_s3" label="Preferência bloqueada" disabled />
          </div>
        </Specimen>
        <Specimen label="RadioGroup (default e card)">
          <div className="grid gap-6">
            <RadioGroup
              name="demo_relation"
              legend="Sua relação com o paper"
              defaultValue="author"
              options={[
                { value: "author", label: "Sou a autora principal" },
                { value: "coauthor", label: "Sou coautora" },
                { value: "reader", label: "Estou indicando o trabalho de outra pesquisadora" },
              ]}
            />
            <RadioGroup
              name="demo_mode"
              legend="Como você quer participar?"
              variant="card"
              orientation="horizontal"
              defaultValue="mentee"
              options={[
                {
                  value: "mentee",
                  label: "Busco mentoria",
                  description: "Receba sugestões de mentoras.",
                },
                {
                  value: "mentor",
                  label: "Quero mentorar",
                  description: "Apoie quem está começando.",
                },
              ]}
            />
          </div>
        </Specimen>
      </div>

      {/* ---------------- Chips & badges ---------------- */}
      <DsSubheading
        id="c-chips"
        description="Badge = status (não clicável). Chip = tag/tópico; ChipLink = filtro por URL; ChipToggle/ChipGroup = escolha em formulário."
      >
        Badges e chips
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="Badge" code={`<Badge variant="success">Mentoria ativa</Badge>`}>
          <div className="flex flex-wrap gap-2">
            <Badge>Rascunho</Badge>
            <Badge variant="primary">Mentora</Badge>
            <Badge variant="secondary">IF</Badge>
            <Badge variant="accent">
              <Star aria-hidden="true" className="fill-current" />
              Em alta
            </Badge>
            <Badge variant="success">Mentoria ativa</Badge>
            <Badge variant="warning">Aguardando resposta</Badge>
            <Badge variant="danger">Denunciado</Badge>
            <Badge variant="info">Gerado por IA</Badge>
            <Badge variant="outline">Ciências Biológicas</Badge>
            <Badge variant="primary" size="md">
              Tamanho md
            </Badge>
          </div>
        </Specimen>
        <Specimen label="Chip · ChipLink">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip>bioinformática</Chip>
              <Chip variant="primary">escrita científica</Chip>
              <Chip variant="secondary">bolsas</Chip>
              <Chip variant="accent" size="sm">
                novo
              </Chip>
              <Chip variant="outline">aprendizado de máquina</Chip>
            </div>
            <nav aria-label="Filtro de áreas (exemplo)" className="flex flex-wrap gap-2">
              <ChipLink href="/design-system#c-chips" active count={42}>
                Todas
              </ChipLink>
              <ChipLink href="/design-system#c-chips" count={12}>
                Exatas
              </ChipLink>
              <ChipLink href="/design-system#c-chips" count={9}>
                Saúde
              </ChipLink>
            </nav>
          </div>
        </Specimen>
        <Specimen label="ChipToggle · ChipGroup (máx. 3)">
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <ChipToggle name="demo_toggle" value="a" label="Online" defaultChecked />
              <ChipToggle name="demo_toggle" value="b" label="Presencial" />
              <ChipToggle name="demo_toggle" value="c" label="Indisponível" disabled />
            </div>
            <ChipGroup
              name="demo_topics"
              legend="Temas de mentoria"
              options={MENTORSHIP_TOPIC_OPTIONS.slice(0, 7)}
              defaultValue={["bolsas-editais", "escrita-cientifica"]}
              max={3}
            />
          </div>
        </Specimen>
        <Specimen label="KeywordInput (cliente)">
          <Field label="Palavras-chave" hint="Até 6. As palavras são salvas em minúsculas.">
            <KeywordInput
              name="demo_keywords"
              max={6}
              defaultValue={["genômica", "câncer de mama", "r"]}
            />
          </Field>
        </Specimen>
      </div>

      {/* ---------------- Cartões ---------------- */}
      <DsSubheading
        id="c-cartoes"
        description="Cartão = superfície de conteúdo. Interativo com CardLink (link “esticado”), sem aninhar links."
      >
        Cartões
      </DsSubheading>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>default</CardTitle>
            <CardDescription>Borda sutil + shadow-card.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Para agrupar conteúdo relacionado.
          </CardContent>
        </Card>
        <Card variant="interactive">
          <CardHeader>
            <CardTitle>
              <CardLink href="/design-system#c-cartoes">interactive</CardLink>
            </CardTitle>
            <CardDescription>Eleva no hover; o cartão todo é clicável.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">Passe o mouse ou use Tab.</CardContent>
        </Card>
        <Card variant="outline">
          <CardHeader>
            <CardTitle>outline</CardTitle>
            <CardDescription>Sem sombra, para dentro de outras superfícies.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">Bom para listas aninhadas.</CardContent>
        </Card>
        <Card variant="muted">
          <CardHeader>
            <CardTitle>muted</CardTitle>
            <CardDescription>Preenchimento sutil, sem borda.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">Notas e resumos.</CardContent>
        </Card>
      </div>
      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <CardTitle as="h4">Anatomia completa</CardTitle>
          <CardDescription>
            CardHeader · CardTitle · CardDescription · CardContent · CardFooter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[0.9375rem] text-fg-muted">
            O rodapé tem borda superior e acomoda ações secundárias à direita.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="ghost" size="sm">
            Agora não
          </Button>
          <Button size="sm">Confirmar</Button>
        </CardFooter>
      </Card>

      {/* ---------------- Avatares ---------------- */}
      <DsSubheading
        id="c-avatares"
        description="Iniciais como fallback (sem JS: se a foto falhar, elas aparecem). Cor determinística pelo nome/id."
      >
        Avatares
      </DsSubheading>
      <Specimen label="Avatar · AvatarGroup">
        <div className="flex flex-wrap items-end gap-6">
          <Avatar name="Ana Maria da Silva" size="xs" />
          <Avatar name="Beatriz Lima" size="sm" />
          <Avatar name="Carolina Duarte" size="md" />
          <Avatar name="Dandara Santos" size="lg" />
          <Avatar name="Elisa Okabe" size="xl" src="/brand/avatar-exemplo.svg" alt="Elisa Okabe" />
          <Avatar name="Fernanda Rocha" size="2xl" />
          <AvatarGroup
            label="7 pesquisadoras apoiaram"
            people={[
              { name: "Ana Souza" },
              { name: "Bruna Alves" },
              { name: "Camila Reis" },
              { name: "Daniela Costa" },
              { name: "Eva Martins" },
              { name: "Flávia Nunes" },
              { name: "Gabriela Prado" },
            ]}
          />
        </div>
      </Specimen>

      {/* ---------------- Navegação ---------------- */}
      <DsSubheading
        id="c-navegacao"
        description="TabNav = cada aba é uma URL (servidor). Tabs = painéis na mesma página (cliente, setas do teclado)."
      >
        Navegação
      </DsSubheading>
      <div className="grid gap-4">
        <Specimen label="TabNav (links)">
          <TabNav
            label="Períodos do ranking (exemplo)"
            items={[
              { href: "/design-system#c-navegacao", label: "Em alta", active: true },
              { href: "/design-system#c-navegacao", label: "Semana", count: 18 },
              { href: "/design-system#c-navegacao", label: "Mês", count: 64 },
              { href: "/design-system#c-navegacao", label: "Ano" },
              { href: "/design-system#c-navegacao", label: "Todos os tempos" },
            ]}
          />
        </Specimen>
        <Specimen label="Tabs (cliente)">
          <Tabs
            label="Perfil da pesquisadora (exemplo)"
            tabs={[
              {
                id: "sobre",
                label: "Sobre",
                icon: <UserRound aria-hidden="true" />,
                content: (
                  <p className="text-fg-muted">
                    Pesquisa resistência antimicrobiana em biofilmes hospitalares.
                  </p>
                ),
              },
              {
                id: "papers",
                label: "Papers",
                icon: <BookOpen aria-hidden="true" />,
                content: (
                  <p className="text-fg-muted">3 papers na vitrine, 41 destaques recebidos.</p>
                ),
              },
              {
                id: "forum",
                label: "Fórum",
                icon: <MessagesSquare aria-hidden="true" />,
                content: <p className="text-fg-muted">12 respostas, 4 marcadas como solução.</p>,
              },
            ]}
          />
        </Specimen>
        <Specimen
          label="Steps (onboarding em etapas)"
          code={`<Steps label="Etapas do cadastro" current={1} steps={[{ label: "Sobre você" }, …]} />`}
        >
          <Steps
            label="Etapas do cadastro (exemplo)"
            current={1}
            steps={[
              { label: "Sobre você", description: "Nome, fase, instituição" },
              { label: "Pesquisa", description: "Áreas e palavras-chave" },
              { label: "Mentoria", description: "O que busca ou oferece" },
              { label: "Privacidade", description: "IA e consentimentos" },
            ]}
          />
        </Specimen>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Specimen label="Pagination (?pagina=N)">
            <Pagination
              page={3}
              totalPages={12}
              basePath="/design-system"
              searchParams={{ area: "saude" }}
            />
          </Specimen>
          <Specimen label="DropdownMenu · Tooltip">
            <div className="flex flex-wrap items-center gap-4">
              <DropdownMenu
                triggerLabel="Menu da conta (exemplo)"
                align="start"
                trigger={<Avatar name="Ana Souza" size="md" />}
                triggerClassName="ring-2 ring-transparent hover:ring-border-strong aria-expanded:ring-primary"
                header={
                  <div>
                    <p className="font-semibold text-fg">Ana Souza</p>
                    <p className="text-sm text-fg-muted">Doutoranda em Microbiologia</p>
                  </div>
                }
                items={[
                  {
                    href: "/design-system#c-navegacao",
                    label: "Meu perfil",
                    icon: <UserRound aria-hidden="true" />,
                  },
                  {
                    href: "/design-system#c-navegacao",
                    label: "Notificações",
                    icon: <Bell aria-hidden="true" />,
                  },
                  {
                    href: "/design-system#c-navegacao",
                    label: "Moderação",
                    icon: <ShieldCheck aria-hidden="true" />,
                  },
                  { type: "separator" },
                  {
                    type: "form",
                    action: "/design-system",
                    method: "get",
                    label: "Sair",
                    icon: <LogOut aria-hidden="true" />,
                    tone: "danger",
                  },
                ]}
              />
              <Tooltip content="Salvar para ler depois">
                <Button variant="outline" size="icon" aria-label="Salvar paper">
                  <Bookmark aria-hidden="true" />
                </Button>
              </Tooltip>
              <Tooltip content="Destaques ajudam o paper a subir no ranking" side="bottom">
                <Button variant="ghost" size="sm">
                  <Star aria-hidden="true" />
                  Como funciona?
                </Button>
              </Tooltip>
              <Tooltip
                content="Alinhada pela borda direita: cresce para a esquerda"
                side="bottom"
                align="end"
              >
                <Button variant="outline" size="sm">
                  align=&quot;end&quot;
                </Button>
              </Tooltip>
            </div>
          </Specimen>
        </div>
      </div>

      {/* ---------------- Feedback ---------------- */}
      <DsSubheading
        id="c-feedback"
        description="Alertas explicam o que aconteceu e o que fazer. Mensagens que surgem após uma ação usam live={true}."
      >
        Feedback
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <Alert variant="info" title="Sugestões feitas com IA">
            As mentoras sugeridas foram ordenadas por afinidade de áreas e temas. Confira o perfil
            antes de enviar o pedido.
          </Alert>
          <Alert variant="success" title="Pedido de mentoria enviado">
            A Dra. Beatriz recebeu sua mensagem. Você será avisada quando ela responder.
          </Alert>
          <Alert
            variant="warning"
            title="Seu perfil está incompleto"
            actions={
              <ButtonLink href="/design-system#c-feedback" size="sm" variant="outline">
                Completar perfil
              </ButtonLink>
            }
          >
            Sem áreas de pesquisa, não conseguimos sugerir mentoras para você.
          </Alert>
          <Alert variant="danger" title="Não conseguimos salvar">
            Verifique sua conexão e tente de novo. Seu texto continua aqui.
          </Alert>
          <FormMessage tone="success">Perfil atualizado.</FormMessage>
        </div>
        <EmptyState
          headingLevel="h4"
          icon={<Inbox />}
          title="Nenhum pedido de mentoria ainda"
          description="Quando uma pesquisadora pedir sua mentoria, o pedido aparece aqui. Enquanto isso, que tal revisar seu perfil?"
          action={
            <>
              <ButtonLink href="/design-system#c-feedback">Revisar perfil</ButtonLink>
              <ButtonLink href="/design-system#c-feedback" variant="ghost">
                Ver dicas para mentoras
              </ButtonLink>
            </>
          }
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Specimen label="Skeleton">
          <div className="grid gap-4" aria-busy="true">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <SkeletonText lines={3} />
          </div>
        </Specimen>
        <Specimen label="SkeletonCard">
          <SkeletonCard />
        </Specimen>
        <Specimen label="Spinner · Dialog · ConfirmDialog">
          <div className="grid gap-4">
            <div className="flex items-center gap-4 text-primary">
              <Spinner size={16} />
              <Spinner size={24} />
              <Spinner size={32} label="Buscando mentoras" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog
                trigger={<Button variant="outline">Abrir diálogo</Button>}
                title="Pedir mentoria a Beatriz Lima"
                description="Conte em poucas linhas o que você busca."
                footer={
                  <form method="dialog" className="contents">
                    <Button type="submit" variant="ghost">
                      Cancelar
                    </Button>
                    <Button type="submit">Enviar pedido</Button>
                  </form>
                }
              >
                <Field label="Mensagem" hint="Entre 20 e 1.500 caracteres.">
                  <Textarea name="demo_dialog_msg" maxLength={1500} showCount rows={4} />
                </Field>
              </Dialog>
              <ConfirmDialog
                triggerLabel="Excluir tópico"
                triggerVariant="danger"
                title="Excluir este tópico?"
                description="As respostas também serão apagadas. Essa ação não pode ser desfeita."
                confirmLabel="Sim, excluir"
                pendingLabel="Excluindo…"
                action={demoConfirmAction}
                hiddenFields={{ id: "demo" }}
              />
              <ConfirmDialog
                triggerLabel="Arquivar (com erro)"
                triggerIcon={<Archive aria-hidden="true" />}
                triggerVariant="ghost"
                tone="primary"
                title="Arquivar esta conversa?"
                description="Demonstração do erro dentro do diálogo: a ação sempre falha e o diálogo continua aberto."
                confirmLabel="Sim, arquivar"
                pendingLabel="Arquivando…"
                cancelLabel="Voltar"
                stateAction={demoConfirmFailure}
                hiddenFields={{ id: "demo" }}
              />
            </div>
          </div>
        </Specimen>
      </div>

      {/* ---------------- Dados ---------------- */}
      <DsSubheading
        id="c-dados"
        description="Números em Bricolage com algarismos tabulares. Medidores têm role=meter e valor anunciado."
      >
        Dados e medidores
      </DsSubheading>
      <StatGroup>
        <Stat
          label="Pesquisadoras"
          value={1284}
          icon={<Users aria-hidden="true" />}
          trend={{ value: 37, label: "na semana" }}
        />
        <Stat label="Mentoras disponíveis" value={156} icon={<Star aria-hidden="true" />} />
        <Stat
          label="Papers na vitrine"
          value={412}
          icon={<BookOpen aria-hidden="true" />}
          trend={{ value: 12, label: "novos" }}
        />
        <Stat label="Destaques dados" value={15320} compact icon={<Trophy aria-hidden="true" />} />
      </StatGroup>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Specimen label="ProgressMeter">
          <div className="grid gap-5">
            <ProgressMeter label="Perfil completo" value={80} />
            <ProgressMeter
              label="Vagas de mentoria ocupadas"
              value={50}
              valueLabel="1 de 2"
              tone="secondary"
            />
            <ProgressMeter label="Meta de destaques" value={30} tone="accent" size="sm" />
          </div>
        </Specimen>
        <Specimen label="ScoreMeter (compatibilidade)">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreMeter value={92} size="lg" label="Compatibilidade com Beatriz Lima" />
            <ScoreMeter value={71} showLabel label="Compatibilidade com Carolina Duarte" />
            <ScoreMeter value={38} size="sm" showLabel label="Compatibilidade com Dandara Santos" />
          </div>
        </Specimen>
      </div>
      <div className="mt-4">
        <Specimen label="Table (painel /admin)" contentClassName="p-4 sm:p-5">
          <Table label="Denúncias abertas (exemplo)">
            <TableCaption srOnly>Denúncias abertas, mais recentes primeiro</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead sort="descending">Recebida</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  what: "Resposta em “Bolsas FAPESP 2026”",
                  category: "bolsas-editais",
                  reason: "Spam",
                  when: "há 2 horas",
                  state: "Aberta",
                },
                {
                  what: "Tópico em “Rede de apoio”",
                  category: "shield-heart",
                  reason: "Assédio",
                  when: "ontem",
                  state: "Em análise",
                },
              ].map((row) => (
                <TableRow key={row.what}>
                  <TableCell className="min-w-56">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CategoryIcon
                        name={
                          row.category === "bolsas-editais" ? "badge-dollar-sign" : row.category
                        }
                        className="size-4 text-primary"
                      />
                      {row.what}
                    </span>
                  </TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell className="whitespace-nowrap text-fg-muted">{row.when}</TableCell>
                  <TableCell>
                    <Badge variant={row.state === "Aberta" ? "warning" : "info"}>{row.state}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu
                      triggerLabel={`Ações para: ${row.what}`}
                      trigger={<EllipsisVertical aria-hidden="true" className="size-5" />}
                      triggerClassName="size-9 justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg"
                      items={[
                        { href: "/design-system#c-dados", label: "Ver conteúdo" },
                        { href: "/design-system#c-dados", label: "Revelar autoria" },
                        { type: "separator" },
                        {
                          type: "form",
                          action: "/design-system",
                          method: "get",
                          label: "Ocultar conteúdo",
                          tone: "danger",
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Specimen>
      </div>

      {/* ---------------- Conteúdo ---------------- */}
      <DsSubheading
        id="c-conteudo"
        description="Markdown de usuárias: sem HTML cru, links externos com nofollow, imagens viram links (privacidade)."
      >
        Conteúdo
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Specimen label="<Markdown>">
          <Markdown>{MARKDOWN_SAMPLE}</Markdown>
        </Specimen>
        <div className="grid content-start gap-4">
          <Specimen label='<Markdown variant="editorial">'>
            <Markdown variant="editorial">
              {
                "Nesta semana, **três papers sobre saúde da mulher** lideraram o ranking — e a comunidade abriu uma conversa necessária sobre maternidade na pós-graduação."
              }
            </Markdown>
          </Specimen>
          <Specimen label="Kbd · Separator · VisuallyHidden">
            <div className="grid gap-4 text-[0.9375rem] text-fg-muted">
              <p>
                Tecle <Kbd>Enter</Kbd> para adicionar e <Kbd>Esc</Kbd> para fechar.
              </p>
              <Separator label="ou" />
              <p>
                Ícone com texto oculto:{" "}
                <span className="inline-flex items-center gap-1 text-fg">
                  <Star aria-hidden="true" className="size-4 fill-accent text-accent-strong" />
                  12<VisuallyHidden> destaques</VisuallyHidden>
                </span>
              </p>
            </div>
          </Specimen>
        </div>
      </div>

      {/* ---------------- Marca ---------------- */}
      <DsSubheading
        id="c-marca"
        description="Logo em linha com o nome; LogoMark sozinho (com title) em espaços pequenos. ConstellationPattern é sempre decorativo."
      >
        Marca e padrão
      </DsSubheading>
      <div className="grid gap-4 lg:grid-cols-3">
        <Specimen label='<Logo /> · <Logo variant="mark" />'>
          <div className="flex flex-wrap items-center gap-6">
            <Logo size={36} />
            <Logo variant="mark" size={40} />
            {/* Ícone de app: peça de marca fixa (violeta-700 + lua branca), igual ao favicon nos dois temas. */}
            <span className="inline-flex size-12 items-center justify-center rounded-[11px] bg-violeta-700 text-white">
              <LogoMark size={30} />
            </span>
          </div>
        </Specimen>
        <Specimen
          label="ConstellationPattern"
          className="lg:col-span-2"
          contentClassName="p-0 sm:p-0"
        >
          <div className="relative h-48 overflow-hidden bg-surface-2">
            <ConstellationPattern className="absolute inset-0 size-full text-primary/40" />
          </div>
        </Specimen>
      </div>

      {/* ---------------- Layout ---------------- */}
      <DsSubheading
        id="c-layout"
        description="Toda página: <Container> + <PageHeader> (um h1) + <Section>s. O <main> já vem do layout raiz."
      >
        Layout de página
      </DsSubheading>
      <div className="mb-4 grid gap-4">
        <Specimen label="SiteHeader — visitante" contentClassName="p-0 sm:p-0">
          <SiteHeaderView account={null} sticky={false} navLabel="Principal (exemplo: visitante)" />
        </Specimen>
        <Specimen
          label="SiteHeader — membra logada (moderadora, 3 notificações)"
          contentClassName="p-0 sm:p-0"
        >
          <SiteHeaderView
            sticky={false}
            navLabel="Principal (exemplo: membra)"
            account={{
              id: "demo-ana",
              name: "Ana Souza",
              avatarUrl: null,
              headline: "Doutoranda em Microbiologia · USP",
              unread: 3,
              isModerator: true,
            }}
          />
        </Specimen>
      </div>
      <Specimen label="PageHeader" contentClassName="py-0">
        <PageHeader
          titleAs="p"
          className="pt-6 sm:pt-6"
          back={{ href: "/design-system#c-layout", label: "Voltar para o fórum" }}
          eyebrow="Fórum · Bolsas, editais e oportunidades"
          title="Como montar um bom plano de trabalho para a FAPESP?"
          description="Dicas de quem já foi aprovada — e de quem aprendeu com a recusa."
          actions={
            <>
              <Button variant="outline">
                <Bell aria-hidden="true" />
                Seguir
              </Button>
              <Button>
                <Plus aria-hidden="true" />
                Responder
              </Button>
            </>
          }
        />
      </Specimen>
    </DsSection>
  );
}
