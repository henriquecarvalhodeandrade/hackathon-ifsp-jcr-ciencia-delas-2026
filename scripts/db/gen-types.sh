#!/usr/bin/env bash
# =============================================================================
# Artemis — gera src/lib/database.types.ts
#
# Modo padrão (Supabase local rodando com Docker):
#   scripts/db/gen-types.sh
#     → npx supabase gen types typescript --local --schema public
#
# Projeto na nuvem:
#   SUPABASE_PROJECT_REF=xxxx scripts/db/gen-types.sh --remote
#
# Sem Docker (Postgres local validado por scripts/db/validate-local.sh com KEEP_DB=1),
# usando o postgres-meta (o mesmo gerador que o CLI usa por baixo):
#   PG_META_SERVER=/caminho/@supabase/postgres-meta/dist/server/server.js \
#   PG_META_DB_URL=postgresql://postgres@127.0.0.1:54329/ciencia_delas_validate \
#   scripts/db/gen-types.sh --pg-meta
#
# Em todos os modos, depois roda scripts/db/patch-types.mjs, que marca como
# anuláveis as colunas de RPC que podem vir NULL (o gerador não sabe disso).
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${ROOT_DIR}/src/lib/database.types.ts"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

mode="${1:---local}"
cd "$ROOT_DIR"

case "$mode" in
  --local)
    npx supabase gen types typescript --local --schema public > "$TMP"
    ;;
  --remote)
    : "${SUPABASE_PROJECT_REF:?Defina SUPABASE_PROJECT_REF (Project Settings > General)}"
    npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > "$TMP"
    ;;
  --pg-meta)
    : "${PG_META_SERVER:?Defina PG_META_SERVER com o caminho do server.js do @supabase/postgres-meta}"
    : "${PG_META_DB_URL:?Defina PG_META_DB_URL (ex.: postgresql://postgres@127.0.0.1:54329/ciencia_delas_validate)}"
    PG_META_GENERATE_TYPES=typescript \
    PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public \
    PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true \
    PG_META_POSTGREST_VERSION="${PG_META_POSTGREST_VERSION:-13}" \
      node "$PG_META_SERVER" > "$TMP" 2> >(grep -v "MaxListenersExceededWarning\|trace-warnings" >&2)
    ;;
  *)
    echo "Uso: $0 [--local | --remote | --pg-meta]" >&2
    exit 1
    ;;
esac

if ! grep -q "export type Database" "$TMP"; then
  echo "A geração não produziu tipos válidos:" >&2
  head -20 "$TMP" >&2
  exit 1
fi

cp "$TMP" "$OUT"
# O CLI oficial gera o arquivo sem formatação; o patch espera o layout do prettier.
npx prettier --parser typescript --write "$OUT" > /dev/null
node "${ROOT_DIR}/scripts/db/patch-types.mjs" "$OUT"
# Mesmo estilo do resto do repositório (o `npm run format` não muda nada depois).
npx prettier --write "$OUT" > /dev/null || echo "Aviso: prettier não rodou em ${OUT}" >&2
echo "Tipos gerados em ${OUT#"${ROOT_DIR}/"}"
