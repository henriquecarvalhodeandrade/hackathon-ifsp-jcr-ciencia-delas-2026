import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleDot, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";
import { InterestButton, type InterestState } from "@/components/explore/InterestButton";
import {
  InterestRequestsPanel,
  type PendingRequestItem,
} from "@/components/explore/InterestRequestsPanel";
import { InviteUserDialog } from "@/components/explore/InviteUserDialog";
import { InviteResponseBanner } from "@/components/explore/InviteResponseBanner";
import { DeleteProjectButton } from "@/components/explore/DeleteProjectButton";
import { ParticipantsList } from "@/components/explore/ParticipantsList";
import { firstProfile, type ProjectDetailRow } from "@/lib/types/explore";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, title, description, area, tags, slots, is_open, created_at, creator_id,
       profiles!projects_creator_id_fkey (id, username, full_name, avatar_url, is_self_declared_woman),
       project_interests (
         id, project_id, user_id, origin, message, status, created_at,
         profiles!project_interests_user_id_fkey (id, username, full_name, avatar_url, is_self_declared_woman)
       )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("Erro ao carregar projeto:", error);
  if (!data) notFound();

  const project = data as unknown as ProjectDetailRow;
  const creator = firstProfile(project.profiles);
  const isCreator = project.creator_id === user.id;

  const interests = project.project_interests.map((i) => ({
    ...i,
    profile: firstProfile(i.profiles),
  }));

  const acceptedInterests = interests.filter((i) => i.status === "accepted");
  const acceptedCount = acceptedInterests.length;
  const isFull = acceptedCount >= project.slots;

  const participants = acceptedInterests
    .filter((i) => i.profile && i.profile.id !== project.creator_id)
    .map((i) => ({ profile: i.profile!, interestId: i.id }));

  const myRequest = isCreator
    ? undefined
    : interests.find((i) => i.user_id === user.id && i.origin === "user_request");
  const myInvite = interests.find(
    (i) => i.user_id === user.id && i.origin === "creator_invite" && i.status === "pending"
  );

  let interestState: InterestState = "none";
  if (myRequest?.status === "accepted") interestState = "accepted";
  else if (myRequest?.status === "pending") interestState = "pending";

  let blockedReason: string | null = null;
  if (!isCreator) {
    if (myInvite) blockedReason = "Responda o convite acima antes de solicitar.";
    else if (!project.is_open) blockedReason = "As inscrições estão encerradas.";
    else if (isFull) blockedReason = "Todas as vagas já foram preenchidas.";
  }

  const pendingRequests: PendingRequestItem[] = interests
    .filter((i) => i.origin === "user_request" && i.status === "pending" && i.profile)
    .map((i) => ({
      id: i.id,
      message: i.message,
      created_at: i.created_at,
      profile: i.profile!,
    }));

  const inviteProjectName = project.title;
  const inviteInviterName = creator?.full_name ?? "A criadora do projeto";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Voltar */}
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Explorar
      </Link>

      {/* Convite pendente para mim */}
      {myInvite && myInvite.status === "pending" && (
        <InviteResponseBanner
          interestId={myInvite.id}
          projectName={inviteProjectName}
          inviterName={inviteInviterName}
        />
      )}

      {/* Cabeçalho do projeto */}
      <header className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                {project.area}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  project.is_open && !isFull
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                <CircleDot className="w-3 h-3" />
                {project.is_open && !isFull
                  ? `Vagas abertas — ${acceptedCount}/${project.slots}`
                  : isFull
                    ? "Vagas preenchidas"
                    : "Inscrições encerradas"}
              </span>
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-foreground leading-tight">
              {project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {creator && (
                <Link
                  href={`/profile/${creator.username}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {creator.full_name}
                  {creator.is_self_declared_woman && (
                    <WomanBadge size="xs" showLabel={false} />
                  )}
                </Link>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {new Date(project.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {isCreator && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  SEU PROJETO
                </span>
              )}
            </div>
          </div>

          {!isCreator && (
            <InterestButton
              projectId={project.id}
              state={interestState}
              blockedReason={blockedReason}
            />
          )}
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Descrição */}
      <section className="p-6 rounded-2xl bg-card border border-border shadow-xs">
        <h2 className="font-heading font-bold text-foreground mb-3">Sobre o projeto</h2>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {project.description}
        </p>
      </section>

      {/* Painel do criador */}
      {isCreator && (
        <div className="space-y-6">
          {/* Gerenciar projeto: editar / excluir */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
            <span className="text-sm font-semibold text-foreground">
              Você é a pessoa criadora desta IC
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/explore/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold text-xs text-foreground transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar IC
              </Link>
              <DeleteProjectButton projectId={project.id} />
            </div>
          </div>

          <InterestRequestsPanel
            requests={pendingRequests}
            acceptedCount={acceptedCount}
            slots={project.slots}
          />
          <div>
            <InviteUserDialog projectId={project.id} />
          </div>
        </div>
      )}

      {/* Participantes */}
      <ParticipantsList
        creator={creator}
        participants={participants}
        acceptedCount={acceptedCount}
        slots={project.slots}
        canManage={isCreator}
      />
    </div>
  );
}
