"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RotateCw, SendHorizontal } from "lucide-react";
import { Avatar, Button, Spinner, Textarea, buttonVariants } from "@/components/ui";
import { createCommentAction, loadRecentCommentsAction } from "@/lib/feed/actions";
import { FEED_LIMITS } from "@/lib/feed/schema";
import type { FeedCommentView, FeedViewer } from "@/lib/feed/types";
import { CONNECTION_ERROR_KEEP_TEXT } from "@/lib/forum/client-action";
import { markdownToPlainText } from "@/lib/forum/text";
import { cn, formatDateTime, formatRelativeTime, pluralize, toIsoString } from "@/lib/utils";
import { announce } from "./dom";

type PanelComment = FeedCommentView & { pending?: boolean };

export interface CommentPanelProps {
  /** id do painel (o botão "Comentar" aponta para ele com aria-controls). */
  id: string;
  postId: string;
  /** Total de comentários (vem do servidor; a página revalidada o atualiza). */
  commentCount: number;
  viewer: FeedViewer;
}

const LOAD_ERROR = "Não conseguimos carregar os comentários agora.";

/**
 * Comentários dentro do cartão: os 2 mais recentes (lidos só quando o painel abre) e um campo de
 * uma linha que cresce com o texto. O comentário novo aparece na hora (otimista); se o envio
 * falhar, ele sai da lista, o texto volta para o campo e o erro aparece logo abaixo.
 */
export function CommentPanel({ id, postId, commentCount, viewer }: CommentPanelProps) {
  const fieldId = useId();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [comments, setComments] = useState<PanelComment[]>([]);
  const [optimistic, addOptimistic] = useOptimistic(comments, (list, next: PanelComment) => [
    ...list,
    next,
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Lê os comentários ao abrir o painel e a cada "Tentar de novo" (attempt muda).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadRecentCommentsAction(postId)
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        if (result?.ok) {
          setComments(result.comments);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [postId, attempt]);

  // Abrir o painel é pedir para comentar: o foco vai para o campo.
  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  function send() {
    const text = draft.trim();
    if (!text) {
      setError("Escreva seu comentário antes de enviar.");
      fieldRef.current?.focus();
      return;
    }
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("body", text);
    const temp: PanelComment = {
      id: `enviando-${Date.now()}`,
      postId,
      body: text,
      createdAt: new Date().toISOString(),
      edited: false,
      author: {
        id: viewer.id,
        full_name: viewer.name,
        avatar_url: viewer.avatarUrl,
        headline: null,
        career_stage: null,
      },
      isOwner: true,
      canDelete: true,
      pending: true,
    };
    setError(null);
    setDraft("");
    startTransition(async () => {
      addOptimistic(temp);
      const result = await createCommentAction(null, formData).catch(() => null);
      if (result?.ok) {
        startTransition(() =>
          setComments((list) => [...list, { ...temp, id: result.commentId, pending: false }]),
        );
        announce("Comentário publicado.");
        return;
      }
      // Desfaz: o otimista some ao fim da transição; o texto volta para o campo.
      setDraft(text);
      setError(
        result && !result.ok
          ? (result.fieldErrors?.body?.[0] ?? result.error)
          : CONNECTION_ERROR_KEEP_TEXT,
      );
      fieldRef.current?.focus();
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
    // Composição de texto (acentos, teclados asiáticos): Enter confirma a letra, não envia.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    // No celular (sem Shift), Enter quebra a linha; Ctrl/Cmd+Enter envia em qualquer aparelho.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    send();
  }

  const shown = optimistic.length;
  const hiddenCount = Math.max(0, commentCount - Math.min(shown, commentCount));
  const hintId = `${fieldId}-dica`;
  const errorId = `${fieldId}-erro`;
  const empty = !draft.trim();

  return (
    <div id={id} className="mt-2 grid gap-3 border-t border-border pt-3">
      {status === "loading" && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner size={16} decorative />
          Carregando comentários…
        </p>
      )}
      {status === "error" && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          {LOAD_ERROR}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        </p>
      )}

      {hiddenCount > 0 && status !== "loading" && (
        <Link
          href={`/feed/p/${postId}#comentarios`}
          className="w-fit rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver todos os {pluralize(commentCount, "comentário", "comentários")}
        </Link>
      )}

      {optimistic.length > 0 && (
        <ol aria-label="Comentários recentes" className="grid gap-3">
          {optimistic.map((comment) => (
            <PanelCommentItem key={comment.id} comment={comment} />
          ))}
        </ol>
      )}
      {status === "ready" && optimistic.length === 0 && commentCount === 0 && (
        <p className="text-sm text-fg-muted">Ainda não há comentários. Que tal ser a primeira?</p>
      )}

      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-start gap-2"
      >
        <Avatar
          name={viewer.name}
          src={viewer.avatarUrl}
          seed={viewer.id}
          size="sm"
          className="mt-1.5"
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor={fieldId} className="sr-only">
            Escreva um comentário
          </label>
          <Textarea
            ref={fieldRef}
            id={fieldId}
            name="body"
            rows={1}
            autoGrow
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            maxLength={FEED_LIMITS.commentMax}
            placeholder="Escreva um comentário…"
            aria-invalid={error ? true : undefined}
            aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(" ")}
            className="text-[0.9375rem]"
          />
          <p id={hintId} className="text-xs text-fg-subtle">
            <span className="pointer-coarse:hidden">
              Enter envia · Shift + Enter quebra a linha
            </span>
            <span className="hidden pointer-coarse:inline">Ctrl + Enter também envia</span>
          </p>
          <p
            id={errorId}
            aria-live="polite"
            className={cn("text-sm font-medium text-danger", !error && "sr-only")}
          >
            {error}
          </p>
        </div>
        <button
          type="submit"
          aria-label="Enviar comentário"
          aria-disabled={empty || undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "mt-0.5 text-primary pointer-coarse:size-11",
            empty && "text-fg-subtle",
          )}
        >
          <SendHorizontal aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function PanelCommentItem({ comment }: { comment: PanelComment }) {
  const name = comment.author?.full_name || "Pesquisadora";
  return (
    <li
      id={comment.pending ? undefined : `painel-comentario-${comment.id}`}
      className={cn("flex items-start gap-2.5", comment.pending && "opacity-70")}
    >
      <Avatar
        name={name}
        src={comment.author?.avatar_url}
        seed={comment.author?.id ?? comment.id}
        size="sm"
      />
      <div className="grid min-w-0 flex-1 gap-0.5 rounded-control bg-surface-2 px-3 py-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {comment.author ? (
            <Link
              href={`/pesquisadoras/${comment.author.id}`}
              className="font-semibold text-fg underline-offset-4 hover:text-primary hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="font-semibold text-fg-muted">{name}</span>
          )}
          <span className="text-xs text-fg-subtle">
            {comment.pending ? (
              "Enviando…"
            ) : (
              <time
                dateTime={toIsoString(comment.createdAt)}
                title={formatDateTime(comment.createdAt)}
              >
                {formatRelativeTime(comment.createdAt)}
              </time>
            )}
          </span>
        </p>
        <p className="line-clamp-4 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line text-fg">
          {markdownToPlainText(comment.body) || comment.body}
        </p>
      </div>
    </li>
  );
}
