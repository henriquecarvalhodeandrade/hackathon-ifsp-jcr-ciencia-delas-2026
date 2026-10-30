import { requireModerator } from "@/lib/auth";

/**
 * Guarda de toda a árvore /admin (defesa em profundidade: qualquer subpágina futura já
 * nasce protegida). A página também chama requireModerator() — o resultado é memoizado
 * por requisição, então não há consulta extra.
 * Obs.: como o app tem um loading.tsx na raiz, o 404 é enviado já em streaming (status 200
 * com a tela "não encontrada" e meta noindex); nenhum dado da moderação chega ao HTML.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireModerator();
  return children;
}
