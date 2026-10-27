import type { Metadata } from "next";
import Link from "next/link";
import { Eye, KeyRound, ShieldCheck } from "lucide-react";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { DeleteAccountDialog } from "@/components/profile/delete-account";
import { ProfileSectionForm } from "@/components/profile/profile-section-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { canSelfDeleteAccount } from "@/lib/profile/account";
import { groupAreas } from "@/lib/profile/areas";
import { profileToFormValues } from "@/lib/profile/form-values";
import { getProfileAreaIds, getResearchAreas } from "@/lib/profile/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false },
};

const SECTIONS = [
  { id: "foto", label: "Foto" },
  { id: "sobre", label: "Sobre você" },
  { id: "pesquisa", label: "Sua pesquisa" },
  { id: "mentoria", label: "Mentoria" },
  { id: "privacidade", label: "Privacidade e IA" },
  { id: "conta", label: "Conta e segurança" },
] as const;

function SectionCard({
  id,
  title,
  description,
  children,
  aside,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Card as="section" id={id} aria-labelledby={`${id}-titulo`} padding="lg" className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id={`${id}-titulo`} className="font-display text-xl font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export default async function PerfilPage() {
  const profile = await requireOnboardedProfile("/perfil");
  const [areas, areaIds, user] = await Promise.all([
    getResearchAreas(),
    getProfileAreaIds(profile.id),
    getCurrentUser(),
  ]);
  const values = profileToFormValues(profile, areaIds);
  const areaGroups = groupAreas(areas);
  const selfDelete = canSelfDeleteAccount();

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        description="O que você escreve aqui aparece para as membros da comunidade e orienta as sugestões de mentoria."
        actions={
          <ButtonLink href={`/pesquisadoras/${profile.id}`} variant="outline">
            <Eye aria-hidden="true" />
            Ver meu perfil público
          </ButtonLink>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Seções do perfil" className="hidden lg:block">
          <ul className="sticky top-24 grid gap-1 border-l border-border">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <Link
                  href={`#${section.id}`}
                  className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm font-semibold text-fg-muted transition-colors hover:border-primary hover:text-fg"
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          <SectionCard id="foto" title="Foto" description="Opcional. Sem foto, mostramos suas iniciais.">
            <AvatarUploader userId={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} />
          </SectionCard>

          <SectionCard id="sobre" title="Sobre você">
            <ProfileSectionForm section="sobre" initialValues={values} />
          </SectionCard>

          <SectionCard id="pesquisa" title="Sua pesquisa" description="Áreas, palavras-chave, apresentação e links.">
            <ProfileSectionForm section="pesquisa" initialValues={values} areaGroups={areaGroups} />
          </SectionCard>

          <SectionCard
            id="mentoria"
            title="Mentoria"
            description="Quer orientação, quer orientar — ou as duas coisas."
            aside={
              <ButtonLink href="/mentoria" variant="link" size="sm">
                Ir para a mentoria
              </ButtonLink>
            }
          >
            <ProfileSectionForm section="mentoria" initialValues={values} />
          </SectionCard>

          <SectionCard
            id="privacidade"
            title="Privacidade e IA"
            aside={
              profile.ai_consent ? (
                <Badge variant="success" size="md">
                  <ShieldCheck aria-hidden="true" />
                  IA autorizada
                  {profile.ai_consent_at ? ` em ${formatDate(profile.ai_consent_at)}` : ""}
                </Badge>
              ) : (
                <Badge variant="neutral" size="md">
                  IA não autorizada
                </Badge>
              )
            }
          >
            <ProfileSectionForm section="privacidade" initialValues={values} submitLabel="Salvar preferência" />
          </SectionCard>

          <SectionCard id="conta" title="Conta e segurança">
            <div className="grid gap-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-0.5">
                  <dt className="text-sm text-fg-subtle">E-mail de acesso</dt>
                  <dd className="font-semibold break-all text-fg">{user?.email ?? "—"}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-sm text-fg-subtle">Membro desde</dt>
                  <dd className="font-semibold text-fg">{formatDate(profile.created_at, { dateStyle: "long" })}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/redefinir-senha" variant="outline">
                  <KeyRound aria-hidden="true" />
                  Trocar senha
                </ButtonLink>
              </div>

              <div className="grid gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-danger-soft-fg sm:p-5">
                <h3 className="font-display text-lg font-semibold">Excluir minha conta</h3>
                <p className="text-sm">
                  Pela LGPD, você pode pedir a exclusão dos seus dados a qualquer momento. Tudo o que está ligado à
                  sua conta é apagado — veja os detalhes na{" "}
                  <Link href="/privacidade" className="font-semibold underline underline-offset-2">
                    política de privacidade
                  </Link>
                  .
                </p>
                {selfDelete ? (
                  <div>
                    <DeleteAccountDialog />
                  </div>
                ) : (
                  <Alert variant="info" title="Exclusão feita pela equipe">
                    Neste ambiente a exclusão automática está desligada. Escreva para a equipe pelos contatos da página
                    de Privacidade e faremos a exclusão em até 15 dias.
                  </Alert>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </Container>
  );
}
