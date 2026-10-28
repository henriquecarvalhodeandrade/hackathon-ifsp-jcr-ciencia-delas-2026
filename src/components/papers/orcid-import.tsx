"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CircleAlert, FileSearch, Search } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from "@/components/ui";
import { orcidWorkTypeLabel } from "@/lib/papers/orcid";
import {
  searchOrcidWorks,
  type OrcidSearchState,
  type OrcidWorkItem,
} from "@/lib/papers/orcid-actions";

export interface OrcidImportPanelProps {
  /** ORCID iD do perfil da membra (já normalizado) ou "". */
  defaultOrcid: string;
  /**
   * Preenche o formulário com o trabalho escolhido. Devolve true quando algo foi aplicado.
   * Quem chama mostra o resultado no passo 1 (a mesma mensagem da busca pelo DOI).
   */
  onPick: (work: OrcidWorkItem) => Promise<boolean>;
}

const PAGE = 10;
const FILTER_FROM = 6;

function workKey(work: OrcidWorkItem, index: number) {
  return work.putCode !== null ? `w${work.putCode}` : `i${index}-${work.doi ?? work.title}`;
}

function matches(work: OrcidWorkItem, query: string) {
  const haystack = [work.title, work.journal, work.doi, work.year, orcidWorkTypeLabel(work.type)]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
  return query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Painel "Importar do ORCID" de /papers/novo: lista as publicações públicas de um ORCID iD
 * (Server Action `searchOrcidWorks`) e entrega a escolhida para o formulário do paper.
 * Fica fora do <form> do paper (formulários não se aninham) e tem o próprio <form>.
 */
export function OrcidImportPanel({ defaultOrcid, onPick }: OrcidImportPanelProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [state, formAction] = useActionState<OrcidSearchState, FormData>(searchOrcidWorks, null);
  const [lastState, setLastState] = useState<OrcidSearchState>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [isPicking, startPicking] = useTransition();

  // Nova busca: zera filtro, paginação e seleção; o campo remonta com o iD normalizado.
  if (state !== lastState) {
    setLastState(state);
    setVersion((n) => n + 1);
    setQuery("");
    setLimit(PAGE);
    setPickedKey(null);
  }

  const orcidValue = state?.values.orcid ?? defaultOrcid;
  const fieldError = state && !state.ok ? state.fieldError : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  // iD recusado (dígito verificador, 404): o foco volta ao campo, que anuncia o erro ligado a ele
  // por aria-describedby. Sem isso, o leitor de tela não dizia nada e o foco ia para o <body>.
  useEffect(() => {
    if (state && !state.ok && state.fieldError) inputRef.current?.focus();
  }, [state]);
  const works = useMemo(() => (state?.ok ? state.works : []), [state]);
  const keyed = useMemo(
    () => works.map((work, index) => ({ work, key: workKey(work, index) })),
    [works],
  );
  const filtered = useMemo(
    () => (query.trim() ? keyed.filter(({ work }) => matches(work, query)) : keyed),
    [keyed, query],
  );
  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  function pick(work: OrcidWorkItem, key: string) {
    setPickingKey(key);
    startPicking(async () => {
      const applied = await onPick(work);
      setPickingKey(null);
      if (applied) setPickedKey(key);
    });
  }

  const message = state
    ? state.ok
      ? {
          tone: state.works.length > 0 ? ("success" as const) : ("info" as const),
          text: state.message,
        }
      : fieldError
        ? null
        : { tone: "error" as const, text: state.error }
    : null;

  return (
    <section
      aria-labelledby={`${uid}-titulo`}
      className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="hidden size-10 shrink-0 place-items-center rounded-control bg-secondary-soft text-secondary-soft-fg sm:grid [&_svg]:size-5"
        >
          <FileSearch />
        </span>
        <div className="grid gap-1">
          <p className="eyebrow text-secondary">Atalho opcional</p>
          <h2 id={`${uid}-titulo`} className="font-display text-xl font-semibold text-fg">
            Importar do ORCID
          </h2>
          <p className="text-[0.9375rem] text-fg-muted">
            Veja as publicações públicas de um ORCID iD e escolha uma para preencher o formulário.
            Com DOI, completamos autoras e resumo pelo Crossref.
          </p>
        </div>
      </div>

      {/* O erro fica abaixo da linha (e não dentro do Field) para o botão continuar alinhado
          ao campo; aria-invalid e aria-describedby são repassados pelo Field ao Input. */}
      <form
        action={formAction}
        noValidate
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <Field
          label="ORCID iD"
          hint={
            defaultOrcid ? (
              "Preenchido com o iD do seu perfil. Você também pode buscar o de outra pesquisadora."
            ) : (
              <>
                16 dígitos, como 0000-0002-1825-0097 — pode colar o link do orcid.org.{" "}
                <Link href="/perfil#pesquisa" className="font-semibold text-primary underline">
                  Salvar meu ORCID no perfil
                </Link>
              </>
            )
          }
        >
          <Input
            key={`orcid-${version}`}
            ref={inputRef}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${uid}-erro` : undefined}
            name="orcid"
            defaultValue={orcidValue}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            placeholder="0000-0000-0000-0000"
            className="font-mono text-[0.9375rem]"
          />
        </Field>
        <SubmitButton
          variant="outline"
          pendingText="Buscando…"
          className="order-last h-11 sm:order-none"
        >
          <Search aria-hidden="true" />
          Buscar publicações
        </SubmitButton>
        {fieldError && (
          <p
            id={`${uid}-erro`}
            className="-mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger sm:col-span-2 sm:row-start-2"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {fieldError}
          </p>
        )}
      </form>

      <FormMessage tone={message?.tone ?? "info"}>{message?.text}</FormMessage>

      {works.length > 0 && (
        <div className="grid gap-3">
          {works.length > FILTER_FROM && (
            <Field label="Filtrar a lista" hint="Por título, revista, ano ou DOI.">
              <Input
                type="search"
                size="sm"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setLimit(PAGE);
                }}
                leadingIcon={<Search />}
                autoComplete="off"
              />
            </Field>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
              Nenhuma publicação desta lista combina com “{query.trim()}”. Tente outra palavra.
            </p>
          ) : (
            <ul
              aria-label={`Publicações públicas no ORCID ${state?.ok ? state.orcid : ""}`}
              className="grid divide-y divide-border overflow-hidden rounded-control border border-border"
            >
              {visible.map(({ work, key }) => {
                const titleId = `${uid}-${key}`;
                const meta = [work.year, work.journal, orcidWorkTypeLabel(work.type)].filter(
                  Boolean,
                );
                return (
                  <li
                    key={key}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="grid min-w-0 gap-1">
                      <p id={titleId} className="font-serif leading-snug font-semibold text-fg">
                        {work.title}
                      </p>
                      {meta.length > 0 && (
                        <p className="text-sm text-fg-muted">{meta.join(" · ")}</p>
                      )}
                      {work.doi ? (
                        <p className="font-mono text-sm break-all text-fg-subtle">
                          <span className="sr-only">DOI </span>
                          {work.doi}
                        </p>
                      ) : (
                        <p className="text-sm text-fg-subtle">
                          Sem DOI: preenchemos título, ano e revista.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {work.existingPaperId ? (
                        <>
                          <Badge variant="info">Já está na Vitrine</Badge>
                          <ButtonLink
                            href={`/papers/${work.existingPaperId}`}
                            variant="link"
                            size="sm"
                          >
                            Ver o paper<span className="sr-only"> na Vitrine: {work.title}</span>
                          </ButtonLink>
                        </>
                      ) : (
                        <>
                          {pickedKey === key && (
                            <Badge variant="success">
                              <Check aria-hidden="true" />
                              No formulário
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pick(work, key)}
                            loading={pickingKey === key}
                            loadingText="Preenchendo…"
                            disabled={isPicking && pickingKey !== key}
                          >
                            Usar esta<span className="sr-only"> publicação: {work.title}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {remaining > 0 && (
            <Button
              variant="ghost"
              className="justify-self-start"
              onClick={() => setLimit((n) => n + PAGE * 2)}
            >
              Mostrar mais {Math.min(remaining, PAGE * 2)} de {remaining}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
