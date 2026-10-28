import { Building2, Footprints, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardLink } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CAREER_STAGES } from "@/lib/constants";
import type { DirectoryProfile } from "@/lib/profile/queries";
import { trajectoryChipLabels, trajectoryMark } from "@/lib/trajectory/catalog";
import { MentorStatus } from "./mentor-status";

export interface ProfileCardProps {
  profile: DirectoryProfile;
  /** Vagas abertas da mentora (null = sem vagas ou desconhecido). */
  openSlots: number | null;
  isSelf?: boolean;
  /** Marca de trajetória a mostrar primeiro (o filtro ?trajetoria= do diretório). */
  trajectoryFirst?: string | null;
}

const MAX_AREAS = 3;
/** No cartão, a trajetória é discreta: no máximo 2 marcas (o perfil mostra todas). */
const MAX_TRAJECTORY = 2;

export function formatPlace(city: string | null, state: string | null): string | null {
  const uf = state?.trim();
  if (city && uf) return `${city}, ${uf}`;
  return city || uf || null;
}

/** Cartão do diretório: o cartão inteiro leva ao perfil (link esticado no nome). */
export function ProfileCard({
  profile,
  openSlots,
  isSelf = false,
  trajectoryFirst = null,
}: ProfileCardProps) {
  const place = formatPlace(profile.city, profile.state);
  const extraAreas = profile.areas.length - MAX_AREAS;
  const firstMark =
    trajectoryFirst && profile.trajectory_tags.includes(trajectoryFirst)
      ? trajectoryMark(trajectoryFirst)?.chip
      : undefined;
  const marks = [
    ...(firstMark ? [firstMark] : []),
    ...trajectoryChipLabels(profile.trajectory_tags).filter((label) => label !== firstMark),
  ].slice(0, MAX_TRAJECTORY);
  return (
    <Card as="li" variant="interactive" padding="md" className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <Avatar name={profile.full_name} src={profile.avatar_url} seed={profile.id} size="lg" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 className="font-display text-lg leading-snug font-semibold text-fg">
            <CardLink href={`/pesquisadoras/${profile.id}`}>
              {profile.full_name || "Pesquisadora"}
            </CardLink>
            {profile.pronouns && (
              <span className="ml-2 align-middle text-xs font-medium text-fg-subtle">
                ({profile.pronouns})
              </span>
            )}
          </h3>
          {profile.headline && (
            <p className="line-clamp-2 text-sm text-fg-muted">{profile.headline}</p>
          )}
        </div>
      </div>

      {(profile.institution || place) && (
        <div className="grid gap-1 text-sm text-fg-subtle">
          {profile.institution && (
            <p className="flex items-start gap-1.5">
              <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="line-clamp-1">{profile.institution}</span>
            </p>
          )}
          {place && (
            <p className="flex items-start gap-1.5">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{place}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {profile.career_stage && (
          <Badge variant="outline">{CAREER_STAGES[profile.career_stage].label}</Badge>
        )}
        <MentorStatus
          isMentor={profile.is_mentor}
          available={profile.mentor_available}
          openSlots={openSlots}
        />
        {isSelf && <Badge variant="primary">Você</Badge>}
      </div>

      {(profile.areas.length > 0 || marks.length > 0) && (
        <div className="mt-auto grid gap-2">
          {profile.areas.length > 0 && (
            <ul aria-label="Áreas de pesquisa" className="flex flex-wrap gap-1.5">
              {profile.areas.slice(0, MAX_AREAS).map((area) => (
                <li key={area.id} className="max-w-full">
                  <Chip size="sm" variant="primary">
                    {area.name}
                  </Chip>
                </li>
              ))}
              {extraAreas > 0 && (
                <li>
                  <Chip size="sm" variant="neutral">
                    +{extraAreas}
                    <span className="sr-only"> outras áreas</span>
                  </Chip>
                </li>
              )}
            </ul>
          )}
          {marks.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Footprints aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-fg-subtle" />
              <ul aria-label="Trajetória" className="flex min-w-0 flex-wrap gap-1.5">
                {marks.map((mark) => (
                  <li key={mark} className="max-w-full">
                    <Chip size="sm" variant="outline">
                      {mark}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
