"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface KeywordInputProps {
  /** Nome do campo — cada palavra vira um <input type="hidden" name={name}>; leia com formData.getAll(name). */
  name: string;
  defaultValue?: readonly string[];
  /** Máximo de palavras-chave (padrão 10). */
  max?: number;
  /** Máximo de caracteres por palavra-chave (padrão 40). */
  maxLength?: number;
  /** Converte para minúsculas (padrão true — o banco guarda keywords em minúsculas). */
  lowercase?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string[]) => void;
  className?: string;
  // Recebidos de <Field> para acessibilidade:
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  required?: boolean;
}

/**
 * Campo de palavras-chave: digite e tecle Enter (ou vírgula) para adicionar.
 * Backspace com o campo vazio remove a última. Colar "a, b, c" adiciona várias.
 */
export function KeywordInput({
  name,
  defaultValue = [],
  max = 10,
  maxLength = 40,
  lowercase = true,
  placeholder = "Digite e tecle Enter",
  disabled,
  onValueChange,
  className,
  id,
  required,
  ...aria
}: KeywordInputProps) {
  const [tags, setTags] = useState<string[]>(() => [...defaultValue]);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const atLimit = tags.length >= max;
  const statusId = `${id ?? name}-status`;

  function commit(next: string[], message: string) {
    setTags(next);
    setAnnouncement(message);
    onValueChange?.(next);
  }

  function normalize(raw: string) {
    const clean = raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
    return lowercase ? clean.toLocaleLowerCase("pt-BR") : clean;
  }

  function addMany(raw: string) {
    const candidates = raw.split(/[,;\n]/).map(normalize).filter(Boolean);
    if (candidates.length === 0) return;
    const next = [...tags];
    const added: string[] = [];
    for (const candidate of candidates) {
      if (next.length >= max) break;
      if (next.some((t) => t.toLocaleLowerCase("pt-BR") === candidate.toLocaleLowerCase("pt-BR"))) continue;
      next.push(candidate);
      added.push(candidate);
    }
    if (added.length > 0) {
      commit(
        next,
        next.length >= max
          ? `Adicionada: ${added.join(", ")}. Limite de ${max} atingido.`
          : `Adicionada: ${added.join(", ")}.`,
      );
    } else if (next.length >= max) {
      setAnnouncement(`Limite de ${max} palavras-chave atingido.`);
    } else {
      setAnnouncement("Essa palavra-chave já está na lista.");
    }
    setDraft("");
  }

  function remove(tag: string) {
    commit(
      tags.filter((t) => t !== tag),
      `Removida: ${tag}.`,
    );
    inputRef.current?.focus();
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        className={cn(
          "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-control border border-border-strong bg-surface px-2 py-1.5",
          "transition-colors hover:border-fg-subtle",
          "has-focus-visible:border-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus",
          aria["aria-invalid"] && "border-danger",
          disabled && "cursor-not-allowed bg-surface-2 opacity-70",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <ul className="contents" aria-label="Palavras-chave adicionadas">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-pill bg-primary-soft pr-1 pl-2.5 text-sm font-medium text-primary-soft-fg"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  remove(tag);
                }}
                className="inline-flex size-5 items-center justify-center rounded-full transition-colors hover:bg-primary/15"
                aria-label={`Remover ${tag}`}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
              <input type="hidden" name={name} value={tag} />
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          // No limite o campo fica só-leitura (não desabilitado): assim o foco não se perde
          // e Backspace continua removendo a última palavra.
          readOnly={atLimit}
          maxLength={maxLength * 4}
          required={required && tags.length === 0}
          placeholder={atLimit ? `Limite de ${max} atingido` : placeholder}
          aria-describedby={[aria["aria-describedby"], statusId].filter(Boolean).join(" ")}
          aria-invalid={aria["aria-invalid"]}
          enterKeyHint="enter"
          autoComplete="off"
          className="h-8 min-w-[9rem] flex-1 bg-transparent px-1.5 text-base text-fg outline-none placeholder:text-fg-subtle read-only:cursor-default disabled:cursor-not-allowed"
          onChange={(event) => {
            if (atLimit) return;
            const v = event.currentTarget.value;
            if (/[,;]/.test(v)) addMany(v);
            else setDraft(v);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (atLimit) setAnnouncement(`Limite de ${max} palavras-chave atingido.`);
              else addMany(draft);
            } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
              event.preventDefault();
              remove(tags[tags.length - 1]!);
            }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              event.preventDefault();
              addMany(draft + text);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addMany(draft);
          }}
        />
      </div>
      <p id={statusId} className="flex justify-between gap-3 text-xs text-fg-subtle">
        <span>Enter ou vírgula para adicionar · Backspace remove a última</span>
        <span className="tabular shrink-0">
          {formatNumber(tags.length)}/{formatNumber(max)}
        </span>
      </p>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
