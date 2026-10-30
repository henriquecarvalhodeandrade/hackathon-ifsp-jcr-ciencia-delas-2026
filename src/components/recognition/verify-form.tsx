import { Search } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { DECLARATION_CODE_EXAMPLE } from "@/lib/recognition/code";

/**
 * "Código da declaração": formulário GET nativo para /verificar (funciona sem JavaScript); a
 * página normaliza o código e redireciona para /verificar/<código>.
 */
export function VerifyForm({
  defaultValue,
  error,
  autoFocus,
}: {
  defaultValue?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/verificar" method="get" className="grid gap-4">
      <Field
        label="Código da declaração"
        hint={`Fica abaixo do QR code, na própria declaração. Ex.: ${DECLARATION_CODE_EXAMPLE}`}
        error={error}
      >
        <Input
          name="codigo"
          defaultValue={defaultValue}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          autoFocus={autoFocus}
          className="font-mono tracking-wide uppercase placeholder:normal-case"
        />
      </Field>
      <Button type="submit" className="w-fit">
        <Search aria-hidden="true" />
        Verificar
      </Button>
    </form>
  );
}
