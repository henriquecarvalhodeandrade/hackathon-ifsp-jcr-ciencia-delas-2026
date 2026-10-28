import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getConversation } from "@/lib/mentorship/conversation-queries";
import { firstName } from "@/lib/mentorship/presentation";

type Params = Promise<{ id: string }>;

const idSchema = z.guid();

/** Título com o nome da outra participante (ou "Conversa não encontrada", também no 404). */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { title: "Conversa da mentoria", robots: { index: false } };
  if (!isSupabaseConfigured()) return fallback;
  const user = await getCurrentUser();
  if (!user) return fallback;
  const missing: Metadata = { title: "Conversa não encontrada", robots: { index: false } };
  if (!idSchema.safeParse(id).success) return missing;
  const result = await getConversation(id, user.id);
  if (result.kind === "not-found") return missing;
  if (result.kind === "error") return fallback;
  const other = result.conversation.other.full_name;
  return { title: `Conversa com ${firstName(other) || other}`, robots: { index: false } };
}

/**
 * Checagem de acesso da conversa FORA da área de carregamento (o loading.tsx desta rota só
 * envolve a página): quem não participa da mentoria — inclusive a moderação — recebe um 404 de
 * verdade (status HTTP), decidido antes de a resposta começar a ser enviada. Por isso a /mentoria
 * fica no grupo (painel): o loading.tsx dela não envolve esta rota. O resultado da leitura é
 * reaproveitado pela página (`getConversation` usa `cache`).
 */
export default async function ConversationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mentoria/conversa/${id}`);
  if (!isSupabaseConfigured() || !idSchema.safeParse(id).success) notFound();
  const result = await getConversation(id, profile.id);
  if (result.kind === "not-found") notFound();
  return children;
}
