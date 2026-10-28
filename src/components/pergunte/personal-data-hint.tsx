"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { describeMatches, findPersonalData, type PersonalDataMatch } from "@/lib/pergunte/pii";

/** Espera curta depois da última tecla: o aviso não pisca (nem é lido) a cada letra. */
const DEBOUNCE_MS = 300;

/**
 * Confere o texto enquanto a pessoa digita (mesmas expressões do servidor e do banco) e guarda o
 * que foi encontrado. Devolve os achados e o `onChange` para o Textarea.
 */
export function usePersonalDataCheck({ allowLinks = false }: { allowLinks?: boolean } = {}) {
  const [matches, setMatches] = useState<PersonalDataMatch[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const check = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const found = findPersonalData(text, { allowLinks });
        setMatches((current) =>
          JSON.stringify(current) === JSON.stringify(found) ? current : found,
        );
      }, DEBOUNCE_MS);
    },
    [allowLinks],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMatches([]);
  }, []);

  return { matches, check, reset };
}

export interface PersonalDataHintProps {
  matches: readonly PersonalDataMatch[];
  /** Pergunta (estudante, anônima) ou resposta (cientista, pública). */
  context: "pergunta" | "resposta";
}

/**
 * Aviso ao vivo (região polite sempre montada) com o tipo e o trecho encontrados. Quando o "link"
 * é só uma frase sem espaço depois do ponto ("anos.Me"), o aviso diz como resolver.
 */
export function PersonalDataHint({ matches, context }: PersonalDataHintProps) {
  const hasLink = matches.some((match) => match.kind === "link");
  return (
    <p aria-live="polite" className="text-sm">
      {matches.length > 0 && (
        <span className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-warning-soft-fg">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {context === "pergunta"
              ? `Parece que o texto tem ${describeMatches(matches)}. Tire antes de enviar: assim ninguém consegue identificar você.`
              : `Parece que a resposta tem ${describeMatches(matches)}. Tire antes de publicar: quem perguntou pode ter menos de 18 anos, e contatos privados ficam fora daqui.`}
            {hasLink && " Se não for um link, coloque um espaço depois do ponto."}
          </span>
        </span>
      )}
    </p>
  );
}
