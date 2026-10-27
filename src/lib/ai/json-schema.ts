import { z } from "zod";

/**
 * JSON Schema compatível ao mesmo tempo com:
 *  - Gemini `generationConfig.responseJsonSchema`, e
 *  - Groq/OpenRouter `response_format: { type: "json_schema", json_schema: { strict: true } }`.
 *
 * O modo estrito exige: toda propriedade listada em `required`, `additionalProperties: false`
 * em todo objeto e apenas um subconjunto de palavras-chave. Por isso o esquema gerado pelo zod
 * passa por uma "allow-list": validações finas (minLength, maxLength, minimum, maxItems...) são
 * removidas aqui e SEMPRE revalidadas com zod depois que a resposta chega.
 *
 * Campos opcionais viram obrigatórios-e-anuláveis (`["string", "null"]`), que é a forma
 * recomendada pelo modo estrito; `parseModelJson` remove esses `null` antes de validar com zod.
 */

export type JsonSchema = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Palavras-chave mantidas. Todo o resto é descartado. */
const ALLOWED_KEYS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "anyOf",
  "description",
  "$defs",
  "$ref",
]);

export class StrictSchemaError extends Error {
  override readonly name = "StrictSchemaError";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addNull(schema: JsonSchema): JsonSchema {
  if (Array.isArray(schema.anyOf)) {
    const hasNull = schema.anyOf.some((s) => isPlainObject(s) && s.type === "null");
    return hasNull ? schema : { ...schema, anyOf: [...schema.anyOf, { type: "null" }] };
  }
  const { type } = schema;
  if (typeof type === "string") {
    if (type === "null") return schema;
    const next: JsonSchema = { ...schema, type: [type, "null"] };
    if (Array.isArray(schema.enum) && !schema.enum.includes(null)) next.enum = [...schema.enum, null];
    return next;
  }
  if (Array.isArray(type)) {
    if (type.includes("null")) return schema;
    const next: JsonSchema = { ...schema, type: [...type, "null"] };
    if (Array.isArray(schema.enum) && !schema.enum.includes(null)) next.enum = [...schema.enum, null];
    return next;
  }
  // `$ref` ou esquema sem tipo explícito: envolve em anyOf.
  return { anyOf: [schema, { type: "null" }] };
}

function normalizeNode(input: unknown, path: string): JsonSchema {
  if (!isPlainObject(input)) {
    throw new StrictSchemaError(`Esquema inválido em ${path}: esperado um objeto JSON Schema.`);
  }

  if ("allOf" in input || "not" in input || "if" in input) {
    throw new StrictSchemaError(
      `Esquema em ${path} usa allOf/not/if, que não são suportados no modo estrito.`,
    );
  }
  if ("prefixItems" in input) {
    throw new StrictSchemaError(`Esquema em ${path} usa tuplas (prefixItems); use arrays simples.`);
  }

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "oneOf") {
      // oneOf não é suportado pelo modo estrito; anyOf tem a mesma utilidade aqui.
      out.anyOf = (value as unknown[]).map((s, i) => normalizeNode(s, `${path}.oneOf[${i}]`));
      continue;
    }
    if (key === "const") {
      out.enum = [value as JsonValue];
      continue;
    }
    if (!ALLOWED_KEYS.has(key)) continue;

    switch (key) {
      case "anyOf":
        out.anyOf = (value as unknown[]).map((s, i) => normalizeNode(s, `${path}.anyOf[${i}]`));
        break;
      case "items":
        if (Array.isArray(value)) {
          throw new StrictSchemaError(`Esquema em ${path} usa items em forma de tupla.`);
        }
        out.items = normalizeNode(value, `${path}.items`);
        break;
      case "$defs": {
        const defs: JsonSchema = {};
        for (const [name, def] of Object.entries(value as Record<string, unknown>)) {
          defs[name] = normalizeNode(def, `${path}.$defs.${name}`);
        }
        out.$defs = defs;
        break;
      }
      case "properties":
      case "required":
      case "additionalProperties":
        // Tratados abaixo, junto com o objeto.
        break;
      default:
        out[key] = value as JsonValue;
    }
  }

  const types = Array.isArray(input.type) ? input.type : [input.type];
  const isObject = types.includes("object") || isPlainObject(input.properties);
  const isArray = types.includes("array");

  if (isObject) {
    const properties = isPlainObject(input.properties) ? input.properties : {};
    if (
      Object.keys(properties).length === 0 &&
      input.additionalProperties !== undefined &&
      input.additionalProperties !== false
    ) {
      throw new StrictSchemaError(
        `Objeto em ${path} tem chaves dinâmicas (record/map). O modo estrito exige propriedades fixas.`,
      );
    }
    const originallyRequired = new Set(
      Array.isArray(input.required) ? (input.required as string[]) : [],
    );
    const normalizedProps: JsonSchema = {};
    for (const [name, propSchema] of Object.entries(properties)) {
      const normalized = normalizeNode(propSchema, `${path}.properties.${name}`);
      normalizedProps[name] = originallyRequired.has(name) ? normalized : addNull(normalized);
    }
    out.type = "object";
    out.properties = normalizedProps;
    out.required = Object.keys(normalizedProps);
    out.additionalProperties = false;
  }

  if (isArray && out.items === undefined) {
    throw new StrictSchemaError(`Array em ${path} sem "items": declare o tipo dos elementos.`);
  }

  if (out.type === undefined && out.anyOf === undefined && out.$ref === undefined && out.enum === undefined) {
    throw new StrictSchemaError(
      `Esquema em ${path} não declara tipo (z.any/z.unknown?). O modo estrito exige tipos explícitos.`,
    );
  }

  return out;
}

/**
 * Pós-processa um JSON Schema qualquer (gerado pelo zod ou escrito à mão) para o subconjunto
 * aceito pelo Gemini e pelo modo estrito do Groq/OpenRouter. Lança `StrictSchemaError` se o
 * esquema usar algo impossível de representar (records, tuplas, z.any...).
 */
export function toStrictJsonSchema(schema: object): JsonSchema {
  const normalized = normalizeNode(schema, "$");
  if (normalized.type !== "object") {
    throw new StrictSchemaError("A raiz do esquema de resposta precisa ser um objeto (z.object).");
  }
  return normalized;
}

/** Converte um esquema zod (v4) no JSON Schema estrito usado nas chamadas aos provedores. */
export function zodToStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "throw",
    reused: "inline",
  });
  return toStrictJsonSchema(raw);
}

/** Remove recursivamente chaves de objetos cujo valor é `null` (campos opcionais no modo estrito). */
export function stripNullFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullFields);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === null) continue;
      out[key] = stripNullFields(v);
    }
    return out;
  }
  return value;
}

/**
 * Extrai JSON do texto devolvido pelo modelo. Tolera cercas de código (```json) e texto
 * antes/depois do objeto — alguns modelos gratuitos do OpenRouter fazem isso.
 * Retorna `undefined` se não houver JSON válido.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    // continua
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continua
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export type ParseModelJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "invalid_json" | "invalid_response"; issues?: string };

/**
 * Faz o parse do texto do modelo e valida com zod. Tenta primeiro o objeto como veio; se
 * falhar, tenta de novo sem os campos `null` (opcionais no modo estrito).
 */
export function parseModelJson<T>(text: string, schema: z.ZodType<T>): ParseModelJsonResult<T> {
  const json = extractJson(text);
  if (json === undefined) return { ok: false, reason: "invalid_json" };

  const first = schema.safeParse(json);
  if (first.success) return { ok: true, data: first.data };

  const second = schema.safeParse(stripNullFields(json));
  if (second.success) return { ok: true, data: second.data };

  const issues = first.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
    .join("; ");
  return { ok: false, reason: "invalid_response", issues };
}
