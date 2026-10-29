"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { Button, Checkbox, Dialog, FormMessage, toast } from "@/components/ui";
import { ActionMenu } from "@/components/network/action-menu";
import { handOffFocus } from "@/components/network/network-announcer";
import { deletePortfolioItem, sharePortfolioItemAction } from "@/lib/portfolio/actions";

const CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/**
 * Menu "⋯" do cartão do portfólio: Editar, Compartilhar no feed e Apagar. Apagar confirma num
 * diálogo; se o item foi compartilhado, "Apagar também a publicação no feed" vem marcado — sem
 * isso, a publicação ficaria no feed sem o anexo.
 */
export function PortfolioItemMenu({
  itemId,
  itemTitle,
  sharedPosts,
}: {
  itemId: string;
  itemTitle: string;
  /** Publicações minhas no feed que anexam este item. */
  sharedPosts: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deletePosts, setDeletePosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [, startShare] = useTransition();

  function share() {
    startShare(async () => {
      let result: Awaited<ReturnType<typeof sharePortfolioItemAction>>;
      try {
        result = await sharePortfolioItemAction(itemId);
      } catch {
        result = { ok: false, error: CONNECTION_ERROR };
      }
      if (!result.ok) {
        toast({ message: result.error, tone: "danger" });
        return;
      }
      toast({
        message: `“${itemTitle}” foi publicado no feed.`,
        action: { label: "Ver no feed", onClick: () => router.push("/feed") },
      });
    });
  }

  function remove() {
    setError(null);
    startDelete(async () => {
      let result: Awaited<ReturnType<typeof deletePortfolioItem>>;
      try {
        result = await deletePortfolioItem(itemId, { deletePosts: sharedPosts > 0 && deletePosts });
      } catch {
        result = { ok: false, error: CONNECTION_ERROR };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      toast({
        message:
          result.deletedPosts > 1
            ? `Item apagado, junto com as ${result.deletedPosts} publicações no feed.`
            : result.deletedPosts === 1
              ? "Item apagado, junto com a publicação no feed."
              : "Item apagado do seu portfólio.",
        tone: "info",
      });
      // O cartão (e o botão "⋯", para onde o diálogo devolveria o foco) some com a revalidação:
      // o foco vai para o título da lista — ou para o título da página, se a lista acabou.
      handOffFocus("itens-titulo", { leaving: `item-${itemId}` });
    });
  }

  return (
    <>
      <ActionMenu
        variant="ghost"
        size="sm"
        align="end"
        showChevron={false}
        label={`Mais ações: “${itemTitle}”`}
        className="size-8 px-0 pointer-coarse:size-11"
        items={[
          {
            label: "Editar",
            icon: <Pencil aria-hidden="true" />,
            onSelect: () => router.push(`/portfolio/${itemId}/editar`),
          },
          {
            label: "Compartilhar no feed",
            icon: <Send aria-hidden="true" />,
            onSelect: share,
          },
          {
            label: "Apagar",
            icon: <Trash2 aria-hidden="true" />,
            tone: "danger",
            onSelect: () => {
              setError(null);
              setDeletePosts(true);
              setConfirming(true);
            },
          },
        ]}
      >
        <MoreHorizontal aria-hidden="true" />
      </ActionMenu>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        size="sm"
        title="Apagar este item do portfólio?"
        description={`“${itemTitle}” sai do seu portfólio e do seu perfil. Não dá para desfazer.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isDeleting}>
              Voltar
            </Button>
            <Button variant="danger" onClick={remove} loading={isDeleting} loadingText="Apagando…">
              Sim, apagar
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {sharedPosts > 0 && (
            <Checkbox
              checked={deletePosts}
              onChange={(event) => setDeletePosts(event.currentTarget.checked)}
              label={
                sharedPosts === 1
                  ? "Apagar também a publicação no feed"
                  : `Apagar também as ${sharedPosts} publicações no feed`
              }
              description="Sem isso, a publicação continua no feed, sem o item anexado."
            />
          )}
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      </Dialog>
    </>
  );
}
