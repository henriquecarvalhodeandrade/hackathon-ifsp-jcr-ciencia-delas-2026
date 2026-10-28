import Link from "next/link";
import { ChevronRight, FileSignature, MessageSquareText } from "lucide-react";
import { Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { firstName } from "@/lib/mentorship/presentation";
import { loadRecognitionTodos } from "@/lib/recognition/queries";
import { createClient } from "@/lib/supabase/server";
import { completionHref } from "./recognition-panel";

/**
 * Pendências do reconhecimento para o /painel: declarações esperando a autorização dela e
 * mentorias concluídas nos últimos 30 dias sem o retorno dela. Não renderiza nada sem pendências.
 */
export async function RecognitionTodos({
  userId,
  headingLevel: Heading = "h2",
  className,
}: {
  userId: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const todos = await loadRecognitionTodos(supabase, userId);
  if (todos.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="pendencias-mentoria" className={className}>
      <div className="grid gap-1 p-5 pb-3 sm:px-6">
        <Heading id="pendencias-mentoria" className="font-display text-lg font-semibold text-fg">
          Para fechar suas mentorias
        </Heading>
        <p className="text-sm text-fg-muted">Nada aqui é obrigatório, mas faz diferença.</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {todos.map((todo) => {
          const name = firstName(todo.otherName) || todo.otherName;
          const consent = todo.kind === "consent";
          return (
            <li key={`${todo.kind}-${todo.requestId}`} className="relative">
              <Link
                href={completionHref(todo.requestId, consent ? "declaracao" : "retorno")}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2 sm:px-6"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-[1.125rem]"
                >
                  {consent ? <FileSignature /> : <MessageSquareText />}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold text-fg group-hover:text-primary">
                    {consent
                      ? `${name} pediu a declaração da mentoria de vocês`
                      : `Conte como foi a mentoria com ${name}`}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {consent
                      ? "Autorize seu nome para emiti-la."
                      : "Privado: só você vê. Leva uns 30 segundos."}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
