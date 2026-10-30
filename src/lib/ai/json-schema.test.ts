import { describe, expect, it } from "vitest";
import { z } from "zod";
import { explainResponseSchema } from "@/lib/matching/pseudonymize";
import { editionIntroSchema, plainSummarySchema } from "./tasks/prompts";
import {
  StrictSchemaError,
  extractJson,
  parseModelJson,
  stripNullFields,
  toStrictJsonSchema,
  zodToStrictJsonSchema,
  type JsonSchema,
} from "./json-schema";

const ALLOWED = new Set([
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

/** Verifica recursivamente as regras do modo estrito (Groq/OpenAI) e do Gemini. */
function assertStrict(schema: JsonSchema, path = "$"): void {
  for (const key of Object.keys(schema)) {
    expect(ALLOWED.has(key), `${path}: palavra-chave não permitida "${key}"`).toBe(true);
  }
  const type = schema.type;
  const isObject = type === "object" || (Array.isArray(type) && type.includes("object"));
  if (isObject) {
    const props = schema.properties as Record<string, JsonSchema>;
    expect(props, `${path}: objeto sem properties`).toBeTypeOf("object");
    expect(schema.additionalProperties, `${path}: additionalProperties`).toBe(false);
    expect([...(schema.required as string[])].sort()).toEqual(Object.keys(props).sort());
    for (const [k, v] of Object.entries(props)) assertStrict(v, `${path}.${k}`);
  }
  if (schema.items) assertStrict(schema.items as JsonSchema, `${path}[]`);
  if (Array.isArray(schema.anyOf)) {
    (schema.anyOf as JsonSchema[]).forEach((s, i) => assertStrict(s, `${path}.anyOf[${i}]`));
  }
}

describe("zodToStrictJsonSchema", () => {
  const schema = z.object({
    title: z.string().min(3).max(100).describe("Título"),
    score: z.number().int().min(0).max(100),
    tags: z.array(z.string().min(1)).min(1).max(5),
    kind: z.enum(["a", "b"]),
    fixed: z.literal("x"),
    note: z.string().optional(),
    maybe: z.string().nullable(),
    nested: z.object({ ok: z.boolean(), extra: z.number().optional() }),
    list: z.array(z.object({ id: z.string(), v: z.number().nullish() })),
  });

  it("gera um esquema compatível com o modo estrito e com o Gemini", () => {
    const json = zodToStrictJsonSchema(schema);
    assertStrict(json);
    expect(json).not.toHaveProperty("$schema");
    expect(JSON.stringify(json)).not.toMatch(
      /minLength|maxLength|minimum|maximum|minItems|maxItems|const/,
    );
  });

  it("mantém descrições, enums e converte literal em enum", () => {
    const json = zodToStrictJsonSchema(schema);
    const props = json.properties as Record<string, JsonSchema>;
    expect(props.title).toEqual({ type: "string", description: "Título" });
    expect(props.kind).toEqual({ type: "string", enum: ["a", "b"] });
    expect(props.fixed).toEqual({ type: "string", enum: ["x"] });
    expect(props.score).toEqual({ type: "integer" });
  });

  it("campos opcionais viram obrigatórios e anuláveis", () => {
    const json = zodToStrictJsonSchema(schema);
    const props = json.properties as Record<string, JsonSchema>;
    expect(json.required).toContain("note");
    expect(props.note).toEqual({ type: ["string", "null"] });
    const nested = props.nested as JsonSchema;
    expect(nested.required).toEqual(["ok", "extra"]);
    expect((nested.properties as Record<string, JsonSchema>).extra).toEqual({
      type: ["number", "null"],
    });
  });

  it("os esquemas reais da aplicação são estritos", () => {
    for (const s of [explainResponseSchema, plainSummarySchema, editionIntroSchema]) {
      assertStrict(zodToStrictJsonSchema(s));
    }
  });

  it("recusa records, z.any e raiz que não é objeto", () => {
    expect(() => zodToStrictJsonSchema(z.object({ r: z.record(z.string(), z.number()) }))).toThrow(
      StrictSchemaError,
    );
    expect(() => toStrictJsonSchema({ type: "object", properties: { a: {} } })).toThrow(
      StrictSchemaError,
    );
    expect(() => zodToStrictJsonSchema(z.array(z.string()))).toThrow(StrictSchemaError);
    expect(() => toStrictJsonSchema({ type: "array" })).toThrow(StrictSchemaError);
  });

  it("normaliza esquemas escritos à mão (oneOf → anyOf, completa required)", () => {
    const json = toStrictJsonSchema({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        a: { type: "string", maxLength: 10 },
        b: { oneOf: [{ type: "string" }, { type: "number" }] },
      },
      required: ["a"],
    });
    assertStrict(json);
    const props = json.properties as Record<string, JsonSchema>;
    expect(props.a).toEqual({ type: "string" });
    expect(props.b).toEqual({ anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] });
  });
});

describe("parse da resposta do modelo", () => {
  const schema = z.object({ name: z.string(), extra: z.string().optional() });

  it("extrai JSON puro, com cerca de código ou com texto em volta", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Claro! Aqui está: {"a": {"b": 2}} Espero ter ajudado.')).toEqual({
      a: { b: 2 },
    });
    expect(extractJson("não é json")).toBeUndefined();
    expect(extractJson("")).toBeUndefined();
  });

  it("aceita null em campo opcional (modo estrito) removendo-o antes do zod", () => {
    expect(parseModelJson('{"name":"x","extra":null}', schema)).toEqual({
      ok: true,
      data: { name: "x" },
    });
  });

  it("aponta JSON inválido e JSON fora do esquema", () => {
    expect(parseModelJson("{nope", schema)).toEqual({ ok: false, reason: "invalid_json" });
    const res = parseModelJson('{"nome":"x"}', schema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid_response");
  });

  it("stripNullFields é recursivo e preserva arrays", () => {
    expect(stripNullFields({ a: null, b: [{ c: null, d: 1 }], e: { f: null } })).toEqual({
      b: [{ d: 1 }],
      e: {},
    });
  });
});
