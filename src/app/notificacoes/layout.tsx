import { requireUser } from "@/lib/auth";

/**
 * Guarda de toda a árvore /notificacoes (o proxy já faz a checagem otimista; aqui é a
 * garantia no servidor). O route handler /notificacoes/abrir/[id] não passa por layouts
 * e confere a sessão sozinho.
 */
export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/notificacoes");
  return children;
}
