"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Save } from "lucide-react";
import {
  ButtonLink,
  Checkbox,
  Field,
  FormMessage,
  Input,
  KeywordInput,
  revealFormMessage,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { savePortfolioItemAction, type PortfolioFormState } from "@/lib/portfolio/actions";
import { PORTFOLIO_KIND_OPTIONS, PORTFOLIO_LIMITS } from "@/lib/portfolio/presentation";
import type { PortfolioFormValues } from "@/lib/portfolio/schema";

export interface PortfolioFormProps {
  mode: "create" | "edit";
  itemId?: string;
  initialValues: PortfolioFormValues;
  cancelHref?: string;
}

/**
 * Formulário de item do portfólio (adicionar/editar). Campos não controlados: quando a action
 * devolve os valores (erro de validação), a `version` muda e os campos remontam com eles.
 * Na criação, "Compartilhar no feed" vem marcado.
 */
export function PortfolioForm({
  mode,
  itemId,
  initialValues,
  cancelHref = "/portfolio",
}: PortfolioFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState<PortfolioFormState, FormData>(
    savePortfolioItemAction,
    null,
  );
  const [lastState, setLastState] = useState<PortfolioFormState>(null);
  const [source, setSource] = useState({ values: initialValues, version: 0 });

  if (state !== lastState) {
    setLastState(state);
    if (state) setSource((s) => ({ values: state.values, version: s.version + 1 }));
  }

  // Depois de um envio com erro: foco no primeiro campo inválido; erro do formulário inteiro
  // (ex.: portfólio cheio, CD066) aparece no topo — rola até a mensagem.
  useEffect(() => {
    if (!state) return;
    const invalid = state.fieldErrors
      ? formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  const values = source.values;
  const v = source.version;
  const errors = state?.fieldErrors;

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-8">
      {itemId && <input type="hidden" name="item_id" value={itemId} />}

      <FormMessage ref={messageRef} tone="error">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      <section
        aria-labelledby="portfolio-sobre"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="portfolio-sobre" className="font-display text-xl font-semibold text-fg">
          Sobre o item
        </h2>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Field label="Tipo" required error={errors?.kind}>
            <Select
              key={`kind-${v}`}
              name="kind"
              defaultValue={values.kind}
              placeholder="Selecione…"
              options={PORTFOLIO_KIND_OPTIONS}
            />
          </Field>
          <Field label="Título" required error={errors?.title}>
            <Input
              key={`title-${v}`}
              name="title"
              defaultValue={values.title}
              maxLength={PORTFOLIO_LIMITS.titleMax}
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            label="Onde"
            optional
            hint="Revista, evento, instituição ou programa. Ex.: SBPC 2025."
            error={errors?.venue}
          >
            <Input
              key={`venue-${v}`}
              name="venue"
              defaultValue={values.venue}
              maxLength={PORTFOLIO_LIMITS.venueMax}
            />
          </Field>
          <Field label="Ano" optional error={errors?.year}>
            <Input
              key={`year-${v}`}
              name="year"
              inputMode="numeric"
              maxLength={4}
              defaultValue={values.year}
              placeholder="2026"
            />
          </Field>
        </div>
        <Field
          label="Descrição"
          optional
          hint="O que você fez, com quem e o que encontrou ou aprendeu."
          error={errors?.description}
        >
          <Textarea
            key={`description-${v}`}
            name="description"
            rows={5}
            defaultValue={values.description}
            maxLength={PORTFOLIO_LIMITS.descriptionMax}
            showCount
          />
        </Field>
        <Field
          label="Link"
          optional
          hint="Artigo, repositório, slides ou certificado — o endereço completo, começando com https://."
          error={errors?.url}
        >
          <Input
            key={`url-${v}`}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={values.url}
            maxLength={PORTFOLIO_LIMITS.urlMax}
            placeholder="https://"
          />
        </Field>
        <Field label="Tags" optional hint="Até 8 temas. Digite e tecle Enter." error={errors?.tags}>
          <KeywordInput
            key={`tags-${v}`}
            name="tags"
            defaultValue={values.tags}
            max={PORTFOLIO_LIMITS.tagsMax}
            maxLength={PORTFOLIO_LIMITS.tagMax}
          />
        </Field>
      </section>

      <section
        aria-labelledby="portfolio-onde-aparece"
        className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="portfolio-onde-aparece" className="font-display text-xl font-semibold text-fg">
          Onde aparece
        </h2>
        <Checkbox
          key={`pinned-${v}`}
          name="pinned"
          defaultChecked={values.pinned}
          label="Destacar no topo"
          description="Itens em destaque aparecem primeiro no seu portfólio e no seu perfil."
        />
        {mode === "create" && (
          <Checkbox
            key={`share-${v}`}
            name="share_to_feed"
            defaultChecked={values.share_to_feed}
            label="Compartilhar no feed"
            description="Publicamos no feed um aviso curto (“Adicionei ao meu portfólio: …”) com o item anexado, para quem segue você. Dá para apagar a publicação depois."
          />
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <SubmitButton size="lg" pendingText={mode === "create" ? "Adicionando…" : "Salvando…"}>
          {mode === "create" ? <Plus aria-hidden="true" /> : <Save aria-hidden="true" />}
          {mode === "create" ? "Adicionar ao portfólio" : "Salvar alterações"}
        </SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost" size="lg">
          Cancelar
        </ButtonLink>
        <p className="w-full text-sm text-fg-subtle sm:w-auto">Campos com * são obrigatórios.</p>
      </div>
    </form>
  );
}
