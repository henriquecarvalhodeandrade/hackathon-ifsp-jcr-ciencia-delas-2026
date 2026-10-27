import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Avatar, Badge, Button, ChipLink, EmptyState, Input, Pagination } from "@/components/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/admin/params";
import type { MembersPage } from "@/lib/admin/queries";
import { CAREER_STAGES } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import { RoleForm } from "./role-form";

const ROLE_VARIANT = { member: "neutral", moderator: "info", admin: "primary" } as const;

export function MembersPanel({
  data,
  q,
  role,
  page,
  isAdmin,
  currentProfileId,
}: {
  data: MembersPage;
  q: string;
  role: UserRole | null;
  page: number;
  isAdmin: boolean;
  currentProfileId: string;
}) {
  const roleLink = (r: UserRole | null) => {
    const params = new URLSearchParams({ aba: "membros" });
    if (q) params.set("q", q);
    if (r) params.set("papel", r);
    return `/admin?${params.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
        <form method="get" action="/admin" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="aba" value="membros" />
          {role && <input type="hidden" name="papel" value={role} />}
          <div className="grid flex-1 gap-1.5">
            <label htmlFor="busca-membras" className="text-sm font-semibold text-fg">
              Buscar por nome ou instituição
            </label>
            <Input id="busca-membras" name="q" defaultValue={q} leadingIcon={<Search />} placeholder="Ex.: Marina ou IFSP" />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar por papel" role="group">
          <ChipLink href={roleLink(null)} active={!role}>
            Todos os papéis
          </ChipLink>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <ChipLink key={r} href={roleLink(r)} active={role === r} count={data.roleCounts[r]}>
              {ROLE_LABELS[r]}s
            </ChipLink>
          ))}
        </div>
        {!isAdmin && (
          <p className="text-sm text-fg-subtle">
            Somente administradoras podem mudar papéis. Precisa de ajuda? Fale com a coordenação.
          </p>
        )}
      </div>

      {data.error ? (
        <EmptyState
          icon={<Users />}
          title="Não conseguimos carregar as membras"
          description="Recarregue a página em instantes."
        />
      ) : data.members.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Ninguém encontrado"
          description="Tente outro nome ou limpe os filtros."
          action={
            <Link href="/admin?aba=membros" className="font-semibold text-primary underline underline-offset-4">
              Limpar filtros
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-fg-muted" aria-live="polite">
            {formatNumber(data.total)} {data.total === 1 ? "pessoa encontrada" : "pessoas encontradas"}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
            {data.members.map((m) => {
              const name = m.full_name?.trim() || "Sem nome";
              const self = m.id === currentProfileId;
              return (
                <li key={m.id} className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={name} src={m.avatar_url} seed={m.id} size="md" />
                    <div className="grid min-w-0 gap-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/pesquisadoras/${m.id}`}
                          className="font-display font-semibold text-fg underline-offset-4 hover:underline"
                        >
                          {name}
                        </Link>
                        {self && <Badge variant="accent">Você</Badge>}
                        <Badge variant={ROLE_VARIANT[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        {m.is_mentor && <Badge variant="secondary">Mentora</Badge>}
                        {!m.onboarded_at && <Badge variant="warning">Perfil incompleto</Badge>}
                      </p>
                      <p className="truncate text-sm text-fg-muted">
                        {[m.career_stage ? CAREER_STAGES[m.career_stage].label : null, m.institution]
                          .filter(Boolean)
                          .join(" · ") || "Sem dados de perfil ainda"}
                      </p>
                      <p className="text-xs text-fg-subtle">Entrou em {formatDate(m.created_at)}</p>
                    </div>
                  </div>
                  {isAdmin && !self ? (
                    <RoleForm profileId={m.id} name={name} role={m.role} />
                  ) : isAdmin && self ? (
                    <p className="text-sm text-fg-subtle sm:max-w-48 sm:text-right">
                      Seu papel só pode ser alterado por outra administradora.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            basePath="/admin"
            searchParams={{ aba: "membros", q: q || undefined, papel: role ?? undefined }}
          />
        </>
      )}
    </div>
  );
}
