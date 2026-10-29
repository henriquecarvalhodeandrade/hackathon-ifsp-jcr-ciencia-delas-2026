#!/usr/bin/env node
/**
 * Artemis — ajuste pós-geração de src/lib/database.types.ts
 *
 * `supabase gen types` (postgres-meta) não sabe quais colunas de uma função
 * `returns table (...)` podem vir NULL e marca todas como não nulas. Este script
 * acrescenta `| null` nas colunas de RPC que, de fato, podem ser NULL — assim o
 * TypeScript obriga o app a tratar esses casos (ex.: similarity sem embedding).
 *
 * Uso: node scripts/db/patch-types.mjs [caminho]   (padrão: src/lib/database.types.ts)
 * É idempotente: rodar duas vezes não duplica `| null`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** RPC → colunas do retorno que podem ser NULL. */
const NULLABLE_RETURN_COLUMNS = {
  get_mentor_candidates: [
    "avatar_url",
    "headline",
    "institution",
    "state",
    "career_stage",
    "mentoring_offer",
    "similarity",
    "existing_request_status",
  ],
  get_community_leaderboard: ["avatar_url", "career_stage"],
  // Reconhecimento (docs/15): declaração revogada não devolve nomes, período nem temas.
  verify_mentorship_declaration: [
    "mentee_name",
    "mentor_name",
    "period_start",
    "period_end",
    "themes",
    "issued_at",
  ],
  // Pergunte a uma cientista (docs/16).
  get_public_question_status: ["question_id", "answer_count", "reject_reason"],
  list_public_questions: ["stage", "area_id"],
  list_public_answers: ["author_name", "author_stage", "author_is_mentor"],
  list_pending_public_questions: ["stage", "area_id"],
  get_paper_ranking: [
    "venue",
    "year",
    "doi",
    "url",
    "area_id",
    "area_slug",
    "area_name",
    "plain_summary",
  ],
  // Rede social (docs/18).
  get_connection_suggestions: ["avatar_url", "headline", "institution", "career_stage"],
};

/** RPCs escalares cujo retorno pode ser NULL. */
const NULLABLE_SCALAR_RETURNS = [
  "reveal_anonymous_author",
  // NULL enquanto falta o consentimento da outra pessoa (docs/15).
  "consent_mentorship_declaration",
];

const file = resolve(process.argv[2] ?? "src/lib/database.types.ts");
let source = readFileSync(file, "utf8");
const problems = [];

function findBlock(text, header, from = 0) {
  const start = text.indexOf(header, from);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + header.length - 1; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  return null;
}

const functionsBlock = findBlock(source, "    Functions: {");
if (!functionsBlock) {
  console.error(`[patch-types] Bloco "Functions" não encontrado em ${file}`);
  process.exit(1);
}

let functions = source.slice(functionsBlock.start, functionsBlock.end);

for (const [fn, columns] of Object.entries(NULLABLE_RETURN_COLUMNS)) {
  const fnBlock = findBlock(functions, `      ${fn}: {`);
  if (!fnBlock) {
    problems.push(`função ${fn} não encontrada`);
    continue;
  }
  let body = functions.slice(fnBlock.start, fnBlock.end);
  const returnsAt = body.indexOf("Returns: {");
  if (returnsAt === -1) {
    problems.push(`retorno de ${fn} não é uma tabela`);
    continue;
  }
  const head = body.slice(0, returnsAt);
  const lines = body.slice(returnsAt).split("\n");
  for (const column of columns) {
    const start = lines.findIndex((line) => new RegExp(`^\\s+${column}\\??:`).test(line));
    if (start === -1) {
      problems.push(`coluna ${fn}.${column} não encontrada`);
      continue;
    }
    // Na saída formatada pelo Prettier o tipo pode quebrar em várias linhas, sempre
    // mais indentadas que a linha da propriedade.
    const indent = lines[start].search(/\S/);
    let end = start;
    while (
      end + 1 < lines.length &&
      lines[end + 1].trim() !== "" &&
      lines[end + 1].search(/\S/) > indent
    ) {
      end++;
    }
    if (/\bnull\b/.test(lines.slice(start, end + 1).join(" "))) continue;
    lines[end] = lines[end].replace(/(;?)(\s*)$/, " | null$1$2");
  }
  const returns = lines.join("\n");
  body = head + returns;
  functions = functions.slice(0, fnBlock.start) + body + functions.slice(fnBlock.end);
}

for (const fn of NULLABLE_SCALAR_RETURNS) {
  const fnBlock = findBlock(functions, `      ${fn}: {`);
  if (!fnBlock) {
    problems.push(`função ${fn} não encontrada`);
    continue;
  }
  const body = functions.slice(fnBlock.start, fnBlock.end);
  const patched = body.replace(/Returns: ([^;\n{}]+?)(;?)(\s*\n|\s*})/, (all, type, semi, rest) =>
    /\bnull\b/.test(type) ? all : `Returns: ${type} | null${semi}${rest}`,
  );
  functions = functions.slice(0, fnBlock.start) + patched + functions.slice(fnBlock.end);
}

source = source.slice(0, functionsBlock.start) + functions + source.slice(functionsBlock.end);
writeFileSync(file, source);

if (problems.length > 0) {
  console.error(`[patch-types] Atenção:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`[patch-types] ${file} ajustado (colunas anuláveis das RPCs).`);
