import Link from "next/link";
import { Users, CalendarDays, CircleDot } from "lucide-react";
import { WomanBadge } from "@/components/common/WomanBadge";
import { firstProfile, type ProjectListRow } from "@/lib/types/explore";

export function ProjectCard({ project }: { project: ProjectListRow }) {
  const creator = firstProfile(project.profiles);
  const accepted = project.project_interests.filter(
    (i) => i.status === "accepted"
  ).length;
  const isFull = accepted >= project.slots;

  return (
    <Link
      href={`/explore/${project.id}`}
      className="group flex flex-col p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/20">
          {project.area}
        </span>
        {project.is_open && !isFull ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CircleDot className="w-3 h-3" />
            Vagas abertas
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <CircleDot className="w-3 h-3" />
            Encerrado
          </span>
        )}
      </div>

      <h3 className="font-heading font-bold text-foreground group-hover:text-primary transition-colors leading-snug mb-2">
        {project.title}
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
        {project.description}
      </p>

      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border"
            >
              #{tag}
            </span>
          ))}
          {project.tags.length > 5 && (
            <span className="px-1 py-0.5 text-[10px] text-muted-foreground">
              +{project.tags.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-border/60 flex items-center justify-between gap-2">
        {creator ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              {creator.full_name}
            </span>
            {creator.is_self_declared_woman && <WomanBadge size="xs" showLabel={false} />}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Criadora desconhecida</span>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {accepted}/{project.slots}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {new Date(project.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
