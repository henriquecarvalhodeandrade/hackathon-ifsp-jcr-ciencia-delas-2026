"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, SearchCheck, Send, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  Field,
  FormMessage,
  Input,
  KeywordInput,
  RadioGroup,
  revealFormMessage,
  SubmitButton,
  Textarea,
  type FormMessageTone,
} from "@/components/ui";
import { PAPER_RELATIONS } from "@/lib/constants";
import { generateSummary, lookupDoi, savePaper, type PaperFormState } from "@/lib/papers/actions";
import { PAPER_LIMITS } from "@/lib/papers/limits";
import {
  filledByOrcid,
  joinPt,
  mergeOrcidIntoValues,
  missingAfterOrcid,
  undoOrcidImport,
  type OrcidImportRecord,
} from "@/lib/papers/orcid";
import type { OrcidWorkItem } from "@/lib/papers/orcid-actions";
import type { AreaRow } from "@/lib/papers/params";
import { mergeCrossrefIntoValues, readPaperForm, type PaperFormValues } from "@/lib/papers/schema";
import { AreaSelect } from "./area-select";
import { OrcidImportPanel } from "./orcid-import";

export interface PaperFormProps {
  mode: "create" | "edit";
  paperId?: string;
  initialValues: PaperFormValues;
  areas: AreaRow[];
  aiEnabled: boolean;
  cancelHref: string;
  /** Mostra o painel "Importar do ORCID" acima do formulário (só no envio). */
  orcidImport?: { defaultOrcid: string };
}

type Notice = { tone: FormMessageTone; text: string; existingPaperId?: string } | null;

const RELATION_OPTIONS = Object.entries(PAPER_RELATIONS).map(([value, label]) => ({
  value,
  label,
}));

function SectionTitle({
  id,
  step,
  children,
  description,
}: {
  id: string;
  step: number;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <p className="eyebrow text-primary">Passo {step} de 4</p>
      <h2 id={id} tabIndex={-1} className="font-display text-xl font-semibold text-fg">
        {children}
      </h2>
      {description && <p className="text-[0.9375rem] text-fg-muted">{description}</p>}
    </div>
  );
}

/**
 * Formulário de envio/edição de paper. Os campos são não controlados; quando os valores mudam
 * por fora (resposta da action, dados do Crossref, resumo da IA) a `version` muda e os campos
 * remontam com o novo defaultValue — sem perder o que já foi digitado nos demais.
 */
export function PaperForm({
  mode,
  paperId,
  initialValues,
  areas,
  aiEnabled,
  cancelHref,
  orcidImport,
}: PaperFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState<PaperFormState, FormData>(savePaper, null);
  const [lastState, setLastState] = useState<PaperFormState>(null);
  const [source, setSource] = useState({ values: initialValues, version: 0 });
  const [summarySource, setSummarySource] = useState(initialValues.plain_summary_source);
  const [lookupNotice, setLookupNotice] = useState<Notice>(null);
  const [summaryNotice, setSummaryNotice] = useState<Notice>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [isSummarizing, startSummary] = useTransition();
  const [focusStep1, setFocusStep1] = useState(0);
  const lastOrcidImport = useRef<OrcidImportRecord | null>(null);

  if (state !== lastState) {
    setLastState(state);
    if (state) {
      setSource((s) => ({ values: state.values, version: s.version + 1 }));
      setSummarySource(state.values.plain_summary_source);
    }
  }

  // Depois de um envio com erros, leva o foco ao primeiro campo inválido. Erro do formulário
  // inteiro (ex.: limite de papers, CD024) aparece no topo, longe do botão: rola até a mensagem.
  useEffect(() => {
    if (!state) return;
    const invalid = state.fieldErrors
      ? formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  // Depois de importar do ORCID, leva a pessoa ao passo 1, onde está o resultado da importação.
  useEffect(() => {
    if (focusStep1 === 0) return;
    const heading = document.getElementById("passo-link");
    if (!heading) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.focus({ preventScroll: true });
    heading
      .closest("section")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [focusStep1]);

  const values = source.values;
  const v = source.version;
  const errors = state?.fieldErrors;

  function currentValues(): PaperFormValues {
    return formRef.current ? readPaperForm(new FormData(formRef.current)) : values;
  }

  function handleLookup() {
    const current = currentValues();
    setLookupNotice(null);
    startLookup(async () => {
      const result = await lookupDoi(current.doi, paperId ?? null);
      if (result.ok) {
        setSource((s) => ({
          values: mergeCrossrefIntoValues(current, result.data),
          version: s.version + 1,
        }));
        setLookupNotice({ tone: "success", text: result.message });
      } else {
        setLookupNotice({
          tone: "error",
          text: result.error,
          existingPaperId: result.existingPaperId,
        });
      }
    });
  }

  /**
   * Trabalho escolhido no painel do ORCID. Com DOI, usa a mesma busca do Crossref do botão
   * "Buscar dados pelo DOI" (e completa revista/ano com o ORCID se o Crossref não trouxer);
   * sem DOI ou se o Crossref falhar, preenche com os dados do próprio ORCID.
   */
  async function handleOrcidPick(work: OrcidWorkItem): Promise<boolean> {
    // Trocar de trabalho não pode misturar dados: desfaz o que a escolha anterior preencheu.
    const current = undoOrcidImport(currentValues(), lastOrcidImport.current);
    setLookupNotice(null);
    const apply = (next: PaperFormValues) => {
      lastOrcidImport.current = { before: current, after: next };
      setSource((s) => ({ values: next, version: s.version + 1 }));
    };
    let applied = true;

    if (work.doi) {
      const result = await lookupDoi(work.doi, paperId ?? null);
      if (result.ok) {
        const merged = mergeCrossrefIntoValues(current, result.data);
        apply({
          ...merged,
          title: merged.title || work.title,
          venue: merged.venue || work.journal || "",
          year: merged.year || (work.year ? String(work.year) : ""),
        });
        setLookupNotice({
          tone: "success",
          text: `Publicação importada do ORCID. ${result.message}`,
        });
      } else if (result.existingPaperId) {
        applied = false;
        setLookupNotice({
          tone: "error",
          text: result.error,
          existingPaperId: result.existingPaperId,
        });
      } else {
        apply(mergeOrcidIntoValues(current, work));
        setLookupNotice({
          tone: "info",
          text: `Preenchemos ${joinPt(filledByOrcid(work, current))} com os dados do ORCID. ${result.error}`,
        });
      }
    } else {
      const next = mergeOrcidIntoValues(current, work);
      const missing = missingAfterOrcid(next);
      apply(next);
      setLookupNotice({
        tone: "success",
        text: `Preenchemos ${joinPt(filledByOrcid(work, current))} com os dados do ORCID. Essa publicação não tem DOI: ${
          missing.length > 0 ? `complete ${joinPt(missing)} à mão e revise` : "revise"
        } tudo antes de publicar.`,
      });
    }
    setFocusStep1((n) => n + 1);
    return applied;
  }

  function handleSummary() {
    const current = currentValues();
    setSummaryNotice(null);
    startSummary(async () => {
      const result = await generateSummary({
        title: current.title,
        abstract: current.abstract,
        areaId: current.area_id,
      });
      if (result.ok) {
        setSource((s) => ({
          values: { ...current, plain_summary: result.summary, plain_summary_source: "ai" },
          version: s.version + 1,
        }));
        setSummarySource("ai");
        setSummaryNotice({
          tone: "success",
          text: "Rascunho gerado com IA. Leia com atenção e ajuste o que for preciso antes de publicar.",
        });
      } else {
        setSummaryNotice({ tone: "error", text: result.error });
      }
    });
  }

  const form = (
    <form ref={formRef} action={formAction} noValidate className="grid gap-8">
      {paperId && <input type="hidden" name="paper_id" value={paperId} />}
      <input type="hidden" name="plain_summary_source" value={summarySource} />

      <FormMessage ref={messageRef} tone="error">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      {/* 1. Onde encontrar */}
      <section
        aria-labelledby="passo-link"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <SectionTitle
          id="passo-link"
          step={1}
          description="Com o DOI, buscamos título, autoras, revista, ano e resumo no Crossref para você não digitar tudo."
        >
          Onde encontrar o paper
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field
            label="DOI"
            optional
            hint="Ex.: 10.1590/s0100-123 — pode colar o link https://doi.org/… também."
            error={errors?.doi}
          >
            <Input
              key={`doi-${v}`}
              name="doi"
              defaultValue={values.doi}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-[0.9375rem]"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleLookup();
                }
              }}
            />
          </Field>
          <Button
            variant="outline"
            onClick={handleLookup}
            loading={isLookingUp}
            loadingText="Buscando…"
            className="h-11"
          >
            <SearchCheck aria-hidden="true" />
            Buscar dados pelo DOI
          </Button>
        </div>
        <FormMessage tone={lookupNotice?.tone ?? "info"}>
          {lookupNotice && (
            <>
              {lookupNotice.text}
              {lookupNotice.existingPaperId && (
                <>
                  {" "}
                  <Link
                    href={`/papers/${lookupNotice.existingPaperId}`}
                    className="underline underline-offset-2"
                  >
                    Ver o paper na Vitrine
                  </Link>
                </>
              )}
            </>
          )}
        </FormMessage>
        <Field
          label="Link para o paper"
          optional
          hint="Página da revista, repositório institucional ou preprint. Obrigatório se não houver DOI."
          error={errors?.url}
        >
          <Input
            key={`url-${v}`}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={values.url}
            placeholder="https://"
          />
        </Field>
        <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <span>
            Compartilhe só o link. A Vitrine não recebe PDFs: o texto completo fica com a revista ou
            o repositório, respeitando os direitos autorais.
          </span>
        </p>
      </section>

      {/* 2. Sobre o trabalho */}
      <section
        aria-labelledby="passo-trabalho"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <SectionTitle id="passo-trabalho" step={2}>
          Sobre o trabalho
        </SectionTitle>
        <Field label="Título" required error={errors?.title}>
          <Input
            key={`title-${v}`}
            name="title"
            defaultValue={values.title}
            maxLength={PAPER_LIMITS.titleMax}
          />
        </Field>
        <Field
          label="Autoras e autores"
          required
          hint="Na ordem do paper. Digite cada nome e tecle Enter."
          error={errors?.authors}
        >
          <KeywordInput
            key={`authors-${v}`}
            name="authors"
            defaultValue={values.authors}
            max={PAPER_LIMITS.authorsMax}
            maxLength={PAPER_LIMITS.authorNameMax}
            lowercase={false}
            placeholder="Nome e sobrenome, depois Enter"
          />
        </Field>
        <Field
          label="Resumo do paper (abstract)"
          required
          hint="Cole o resumo original, no idioma em que foi publicado."
          error={errors?.abstract}
        >
          <Textarea
            key={`abstract-${v}`}
            name="abstract"
            rows={8}
            defaultValue={values.abstract}
            maxLength={PAPER_LIMITS.abstractMax}
            showCount
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Revista, evento ou repositório" optional error={errors?.venue}>
            <Input
              key={`venue-${v}`}
              name="venue"
              defaultValue={values.venue}
              maxLength={PAPER_LIMITS.venueMax}
            />
          </Field>
          <Field label="Ano" optional error={errors?.year}>
            <Input
              key={`year-${v}`}
              name="year"
              inputMode="numeric"
              maxLength={4}
              defaultValue={values.year}
            />
          </Field>
        </div>
        <Field
          label="Área"
          required
          hint="Ajuda quem filtra a Vitrine e quem assina o boletim por área."
          error={errors?.area_id}
        >
          <AreaSelect
            key={`area-${v}`}
            areas={areas}
            mode="form"
            name="area_id"
            defaultValue={values.area_id}
            placeholder="Selecione a área…"
          />
        </Field>
        <Field
          label="Palavras-chave"
          optional
          hint="Até 15. Ajudam a encontrar o paper."
          error={errors?.keywords}
        >
          <KeywordInput
            key={`keywords-${v}`}
            name="keywords"
            defaultValue={values.keywords}
            max={PAPER_LIMITS.keywordsMax}
            maxLength={PAPER_LIMITS.keywordMax}
          />
        </Field>
      </section>

      {/* 3. Relação e confirmação */}
      <section
        aria-labelledby="passo-relacao"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <SectionTitle id="passo-relacao" step={3}>
          Sua relação com o trabalho
        </SectionTitle>
        <RadioGroup
          key={`relation-${v}`}
          name="submitter_relation"
          legend="Quem está indicando?"
          options={RELATION_OPTIONS}
          defaultValue={values.submitter_relation}
          variant="card"
          required
          error={errors?.submitter_relation}
        />
        <div className="grid gap-1.5">
          <Checkbox
            key={`women-${v}`}
            name="women_authorship_confirmed"
            defaultChecked={values.women_authorship_confirmed}
            required
            label={
              <>
                Confirmo que este trabalho tem autoria de mulheres
                <span aria-hidden="true" className="ml-0.5 text-danger">
                  *
                </span>
              </>
            }
            description="A Vitrine existe para dar visibilidade a pesquisas com autoria ou coautoria de destaque de mulheres. Indicações fora desse propósito podem ser removidas pela moderação."
            aria-invalid={errors?.women_authorship_confirmed ? true : undefined}
            aria-describedby={errors?.women_authorship_confirmed ? "erro-autoria" : undefined}
          />
          {errors?.women_authorship_confirmed && (
            <p
              id="erro-autoria"
              className="flex items-start gap-1.5 pl-8 text-sm font-medium text-danger"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
              {errors.women_authorship_confirmed[0]}
            </p>
          )}
        </div>
      </section>

      {/* 4. Resumo acessível */}
      <section
        aria-labelledby="passo-resumo"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <SectionTitle
          id="passo-resumo"
          step={4}
          description="Um resumo em linguagem simples aproxima a pesquisa de estudantes e de quem é de outra área."
        >
          Resumo acessível
        </SectionTitle>
        <Field
          label={
            <span className="inline-flex flex-wrap items-center gap-2">
              Resumo em linguagem simples
              {summarySource === "ai" && (
                <Badge variant="info">
                  <Sparkles aria-hidden="true" />
                  Gerado com IA
                </Badge>
              )}
            </span>
          }
          optional
          hint="Em 3 a 5 frases, sem jargão: qual problema, o que foi feito e o que foi encontrado."
          error={errors?.plain_summary}
        >
          <Textarea
            key={`summary-${v}`}
            name="plain_summary"
            rows={5}
            defaultValue={values.plain_summary}
            maxLength={PAPER_LIMITS.plainSummaryMax}
            showCount
            onChange={(event) => {
              if (event.currentTarget.value.trim() === "") setSummarySource("author");
            }}
          />
        </Field>
        {aiEnabled && (
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={handleSummary}
              loading={isSummarizing}
              loadingText="Gerando resumo…"
              className="justify-self-start"
            >
              <Sparkles aria-hidden="true" />
              Gerar resumo acessível com IA
            </Button>
            <p className="text-sm text-fg-subtle">
              Enviamos só o título, a área e o abstract (públicos) a um serviço de IA de terceiros —
              no plano gratuito do Google Gemini, esses dados podem ser usados para melhorar os
              produtos dele. O texto aparece marcado como gerado por IA e você pode editar antes de
              publicar.
            </p>
            <FormMessage tone={summaryNotice?.tone ?? "info"}>{summaryNotice?.text}</FormMessage>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <SubmitButton size="lg" pendingText={mode === "create" ? "Publicando…" : "Salvando…"}>
          <Send aria-hidden="true" />
          {mode === "create" ? "Publicar na Vitrine" : "Salvar alterações"}
        </SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost" size="lg">
          Cancelar
        </ButtonLink>
        <p className="w-full text-sm text-fg-subtle sm:w-auto">Campos com * são obrigatórios.</p>
      </div>
    </form>
  );

  if (!orcidImport) return form;
  return (
    <div className="grid gap-8">
      <OrcidImportPanel defaultOrcid={orcidImport.defaultOrcid} onPick={handleOrcidPick} />
      {form}
    </div>
  );
}
