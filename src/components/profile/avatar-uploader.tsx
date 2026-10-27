"use client";

import { useId, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage, type FormMessageTone } from "@/components/ui/form-message";
import { removeAvatarAction, saveAvatarAction } from "@/app/perfil/actions";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  avatarFileProblem,
  avatarObjectPath,
  isAvatarMimeType,
} from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/client";
import { prepareAvatar } from "./prepare-avatar";

export interface AvatarUploaderProps {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Foto de perfil: o navegador recorta/reduz a imagem e envia direto ao Storage (pasta da
 * própria usuária — o RLS garante); depois a Server Action valida a URL e grava no perfil.
 */
export function AvatarUploader({ userId, name, avatarUrl }: AvatarUploaderProps) {
  const inputId = useId();
  const hintId = `${inputId}-dica`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [status, setStatus] = useState<{ tone: FormMessageTone; text: string } | null>(null);

  async function upload(file: File) {
    const problem = avatarFileProblem(file);
    if (problem) {
      setStatus({ tone: "error", text: problem });
      return;
    }
    setBusy("upload");
    setStatus({ tone: "info", text: "Preparando e enviando sua foto…" });
    try {
      const prepared = await prepareAvatar(file);
      const type = isAvatarMimeType(prepared.type) ? prepared.type : isAvatarMimeType(file.type) ? file.type : null;
      if (!type) {
        setStatus({ tone: "error", text: "Use uma imagem PNG, JPG ou WebP." });
        return;
      }
      if (prepared.size > AVATAR_MAX_BYTES) {
        setStatus({ tone: "error", text: "A imagem precisa ter até 2 MB. Tente uma foto menor." });
        return;
      }

      const supabase = createClient();
      const path = avatarObjectPath(userId, type);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, prepared, { contentType: type, cacheControl: "31536000", upsert: false });
      if (uploadError) {
        setStatus({ tone: "error", text: "Não conseguimos enviar a foto. Verifique sua conexão e tente de novo." });
        return;
      }

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const result = await saveAvatarAction(data.publicUrl);
      if (!result.ok) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path]);
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setPreview(result.avatarUrl);
      setStatus({ tone: "success", text: result.message });
    } catch {
      setStatus({ tone: "error", text: "Algo deu errado ao enviar a foto. Tente de novo em instantes." });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      const result = await removeAvatarAction();
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setPreview(null);
      setStatus({ tone: "success", text: result.message });
    } catch {
      setStatus({ tone: "error", text: "Não conseguimos remover a foto agora. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Avatar name={name} src={preview} seed={userId} size="2xl" alt={preview ? `Sua foto de perfil` : undefined} />
      <div className="grid flex-1 gap-3">
        <p id={hintId} className="text-sm text-fg-muted">
          PNG, JPG ou WebP. Recortamos um quadrado central de até 512 px e removemos os dados escondidos da foto (como
          a localização).
        </p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor={inputId} className="sr-only">
            Escolher foto de perfil
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-describedby={hintId}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            variant="outline"
            loading={busy === "upload"}
            loadingText="Enviando…"
            disabled={busy !== null}
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden="true" />
            {preview ? "Trocar foto" : "Enviar foto"}
          </Button>
          {preview && (
            <Button
              variant="ghost"
              loading={busy === "remove"}
              loadingText="Removendo…"
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden="true" />
              Remover foto
            </Button>
          )}
        </div>
        <FormMessage tone={status?.tone ?? "info"}>{status?.text}</FormMessage>
      </div>
    </div>
  );
}
