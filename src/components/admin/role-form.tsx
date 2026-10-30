"use client";

import { useActionState, useId } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeMemberRole } from "@/lib/admin/actions";
import type { ActionState } from "@/lib/admin/action-state";
import { ROLE_LABELS, type UserRole } from "@/lib/admin/params";
import { announce } from "./flash";

const OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

/** Troca de papel (somente admins). O servidor confere de novo se quem pede é admin. */
export function RoleForm({
  profileId,
  name,
  role,
}: {
  profileId: string;
  name: string;
  role: UserRole;
}) {
  const selectId = useId();
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await changeMemberRole(prev, formData);
    if (result?.ok) announce(result.message);
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-1.5">
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor={selectId} className="sr-only">
        Papel de {name}
      </label>
      <div className="flex items-center gap-2">
        <Select
          key={role}
          id={selectId}
          name="role"
          size="sm"
          defaultValue={role}
          options={OPTIONS}
          className="w-44"
        />
        <SubmitButton variant="outline" size="sm" pendingText="Salvando…">
          Salvar
        </SubmitButton>
      </div>
      <FormMessage tone="error" className="max-w-xs">
        {state && !state.ok ? state.error : null}
      </FormMessage>
    </form>
  );
}
