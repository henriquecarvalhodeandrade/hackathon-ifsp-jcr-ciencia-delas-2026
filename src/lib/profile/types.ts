/**
 * Tipos compartilhados entre Server Actions e formulários (cliente) de autenticação e perfil.
 * Contrato das actions: { ok: true, ... } | { ok: false, error, fieldErrors? } — sempre com os
 * valores enviados de volta (o React 19 reseta o <form> após cada action).
 */
import type { ProfileFieldErrors, ProfileFormValues, ProfileSection } from "./form-values";

export type ProfileActionState =
  | {
      ok: true;
      section: ProfileSection;
      message: string;
      values: Partial<ProfileFormValues>;
      /** Onboarding: próxima etapa (1–4). */
      nextStep?: number;
    }
  | {
      ok: false;
      section: ProfileSection;
      error: string;
      fieldErrors?: ProfileFieldErrors;
      values: Partial<ProfileFormValues>;
      /** Onboarding: etapa que precisa ser revista antes de concluir. */
      goToStep?: number;
    }
  | null;

export type AuthFieldErrors = Partial<
  Record<"full_name" | "email" | "password" | "password_confirm" | "terms", string[]>
>;

export interface AuthFormValues {
  full_name?: string;
  email?: string;
  /** Cadastro: aceite marcado (para não desmarcar quando outro campo falha). */
  terms?: boolean;
}

export type AuthActionState =
  | {
      ok: true;
      /** O que aconteceu, para a interface escolher a mensagem/estado. */
      kind:
        | "magic_link_sent"
        | "signup_email_sent"
        | "recovery_sent"
        | "confirmation_resent"
        | "password_updated";
      message: string;
      values: AuthFormValues;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: AuthFieldErrors;
      values: AuthFormValues;
      /** Login com e-mail ainda não confirmado: oferecer reenvio. */
      canResendConfirmation?: boolean;
    }
  | null;

export type AvatarActionResult =
  { ok: true; message: string; avatarUrl: string | null } | { ok: false; error: string };

export type DeleteAccountState = { ok: false; error: string } | null;
