import Form from "next/form";
import { Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { SEARCH_MAX_LENGTH } from "@/lib/forum/text";
import { cn } from "@/lib/utils";

/**
 * Busca por título e texto dos tópicos (GET ?q=). Usa next/form: navegação no cliente
 * e funciona sem JavaScript.
 */
export function ForumSearch({
  action,
  defaultValue,
  placeholder = "Buscar por título ou texto",
  className,
}: {
  /** Caminho da listagem (ex.: "/forum" ou "/forum/c/carreira"). */
  action: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Form
      action={action}
      role="search"
      aria-label="Buscar no fórum"
      className={cn("flex gap-2", className)}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="busca-forum" className="sr-only">
          Buscar no fórum
        </label>
        <Input
          id="busca-forum"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={SEARCH_MAX_LENGTH}
          leadingIcon={<Search />}
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="outline" className="h-11">
        Buscar
      </Button>
    </Form>
  );
}
